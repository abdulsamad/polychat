import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { enabledModelsType } from 'utils';
import { enqueuePersistence } from '@/store';
import { median, tokensPerSecond, type ResultCost } from '@/utils/compare-metrics';
import {
  clearCompareVotes,
  getActiveWorkspaceAccount,
  getCompareVotes,
  type ICompareVote,
  type ICompareVoteResult,
} from '@/utils/lforage';

const ELO_START = 1000;
const ELO_K = 32;
/** Below this many pairwise matches a rating is shown as provisional. */
export const PROVISIONAL_MATCHES = 10;

export interface CompareTallyRow {
  model: enabledModelsType;
  /** Elo-style rating from pairwise outcomes, starting at 1000. */
  rating: number;
  /** Pairwise comparisons that moved the rating. */
  matches: number;
  isProvisional: boolean;
  wins: number;
  /** Runs where this model produced an answer. */
  appearances: number;
  winRate: number;
  medianTtftMs?: number;
  medianSpeed?: number;
  avgCost?: ResultCost;
  /** Share of all runs that failed or came back empty. */
  failureRate: number;
  /** Share of answers cut off by the output token limit. */
  cutOffRate: number;
  /** Mean rubric score (1-5) across rated answers. */
  avgScore?: number;
}

/** Pairwise record from the row model's point of view. */
export interface HeadToHeadRecord {
  wins: number;
  losses: number;
  ties: number;
}

const pairKey = (a: string, b: string) => `${a}\u0001${b}`;

const expectedScore = (rating: number, opponent: number) =>
  1 / (1 + 10 ** ((opponent - rating) / 400));

const rubricAverage = ({ rubric }: ICompareVoteResult) => {
  const scores = Object.values(rubric ?? {}).filter((score) => typeof score === 'number');
  return scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : undefined;
};

const toTimedResult = ({ ttftMs, totalMs, usage, costUsd }: ICompareVoteResult) => ({
  ttftMs: ttftMs ?? undefined,
  totalMs: totalMs ?? undefined,
  usage,
  costUsd,
});

/**
 * Elo over votes in time order. A winner beats every other answered model, a tie draws every
 * pair, and "none" carries no ranking signal. Deltas within one vote use the ratings from before
 * that vote, so the order of opponents does not matter.
 */
const computeRatings = (votes: readonly ICompareVote[]) => {
  const ratings = new Map<string, number>();
  const matches = new Map<string, number>();
  const pairs = new Map<string, HeadToHeadRecord>();
  const rating = (model: string) => ratings.get(model) ?? ELO_START;
  const record = (a: string, b: string) => {
    const key = pairKey(a, b);
    const existing = pairs.get(key) ?? { wins: 0, losses: 0, ties: 0 };
    pairs.set(key, existing);
    return existing;
  };

  for (const vote of votes.slice().sort((a, b) => a.timestamp - b.timestamp)) {
    if (vote.winner === 'none') continue;
    const players = [
      ...new Set(vote.results.filter(({ failed }) => !failed).map(({ model }) => model)),
    ];
    if (players.length < 2) continue;

    const outcomes: Array<[string, string, number]> =
      vote.winner === 'tie'
        ? players.flatMap((a, index) =>
            players.slice(index + 1).map((b): [string, string, number] => [a, b, 0.5])
          )
        : players.includes(vote.winner)
          ? players
              .filter((model) => model !== vote.winner)
              .map((loser): [string, string, number] => [vote.winner, loser, 1])
          : [];

    const deltas = new Map<string, number>();
    for (const [a, b, score] of outcomes) {
      const change = ELO_K * (score - expectedScore(rating(a), rating(b)));
      deltas.set(a, (deltas.get(a) ?? 0) + change);
      deltas.set(b, (deltas.get(b) ?? 0) - change);
      matches.set(a, (matches.get(a) ?? 0) + 1);
      matches.set(b, (matches.get(b) ?? 0) + 1);
      if (score === 0.5) {
        record(a, b).ties += 1;
        record(b, a).ties += 1;
      } else {
        record(a, b).wins += 1;
        record(b, a).losses += 1;
      }
    }
    for (const [model, change] of deltas) ratings.set(model, rating(model) + change);
  }

  return { rating, matches, pairs };
};

/** Loads locally stored compare votes for the active workspace and derives per-model results. */
const useCompareVotes = (
  isWorkspaceReady: boolean,
  getResultCost?: (result: ICompareVoteResult) => ResultCost | undefined
) => {
  const [votes, setVotes] = useState<ICompareVote[] | null>(null);
  const mountedRef = useRef(true);
  /** Bumped by every refresh and clear; a load that finishes under an older generation is dropped. */
  const generationRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
    const accountId = getActiveWorkspaceAccount();
    const isCurrent = () =>
      mountedRef.current &&
      generationRef.current === generation &&
      getActiveWorkspaceAccount() === accountId;
    try {
      // Reads go through the persistence queue, so they observe every queued vote or clear.
      const storedVotes = await enqueuePersistence(getCompareVotes);
      if (isCurrent()) setVotes(storedVotes);
    } catch (error) {
      console.error('Failed to load compare votes', error);
      if (isCurrent()) setVotes([]);
    }
  }, []);

  useEffect(() => {
    if (!isWorkspaceReady) {
      setVotes(null);
      return;
    }
    void refresh();
  }, [isWorkspaceReady, refresh]);

  const clear = useCallback(async () => {
    // Invalidate any in-flight refresh so it cannot restore the votes being cleared.
    const generation = ++generationRef.current;
    await enqueuePersistence(clearCompareVotes);
    if (mountedRef.current && generationRef.current === generation) setVotes([]);
  }, []);

  const summary = useMemo(() => {
    let ties = 0;
    let none = 0;
    const resultsByModel = new Map<enabledModelsType, ICompareVoteResult[]>();
    const winsByModel = new Map<enabledModelsType, number>();
    /** Runs where the model answered in at least one column; variants count once per run. */
    const appearancesByModel = new Map<enabledModelsType, number>();

    for (const vote of votes || []) {
      if (vote.winner === 'tie') ties += 1;
      else if (vote.winner === 'none') none += 1;
      else winsByModel.set(vote.winner, (winsByModel.get(vote.winner) ?? 0) + 1);

      for (const result of vote.results) {
        const results = resultsByModel.get(result.model) ?? [];
        results.push(result);
        resultsByModel.set(result.model, results);
      }
      const answeredModels = new Set(
        vote.results.filter(({ failed }) => !failed).map(({ model }) => model)
      );
      for (const model of answeredModels) {
        appearancesByModel.set(model, (appearancesByModel.get(model) ?? 0) + 1);
      }
    }

    const { rating, matches, pairs } = computeRatings(votes || []);

    const tally = [...resultsByModel].map(([model, results]): CompareTallyRow => {
      // Failed or empty results never had a chance to win, so they are not appearances.
      const answered = results.filter(({ failed }) => !failed);
      const wins = winsByModel.get(model) ?? 0;
      const appearances = appearancesByModel.get(model) ?? 0;
      const costs = answered.flatMap((result) => getResultCost?.(result) ?? []);
      const scores = answered.flatMap((result) => rubricAverage(result) ?? []);
      const modelMatches = matches.get(model) ?? 0;
      return {
        model,
        rating: Math.round(rating(model)),
        matches: modelMatches,
        isProvisional: modelMatches < PROVISIONAL_MATCHES,
        wins,
        appearances,
        winRate: appearances ? wins / appearances : 0,
        medianTtftMs: median(answered.flatMap(({ ttftMs }) => (ttftMs === null ? [] : ttftMs))),
        medianSpeed: median(
          answered.flatMap((result) => tokensPerSecond(toTimedResult(result)) ?? [])
        ),
        avgCost: costs.length
          ? {
              usd: costs.reduce((sum, { usd }) => sum + usd, 0) / costs.length,
              isEstimate: costs.some(({ isEstimate }) => isEstimate),
            }
          : undefined,
        failureRate: results.length ? (results.length - answered.length) / results.length : 0,
        cutOffRate: answered.length
          ? answered.filter(({ finishReason }) => finishReason === 'length').length /
            answered.length
          : 0,
        avgScore: scores.length
          ? scores.reduce((sum, score) => sum + score, 0) / scores.length
          : undefined,
      };
    });

    tally.sort(
      (a, b) =>
        b.rating - a.rating ||
        b.wins - a.wins ||
        b.winRate - a.winRate ||
        b.appearances - a.appearances
    );

    const getHeadToHead = (model: string, opponent: string) => pairs.get(pairKey(model, opponent));

    return { tally, ties, none, total: votes?.length ?? 0, getHeadToHead };
  }, [getResultCost, votes]);

  return { ...summary, isLoading: votes === null, refresh, clear };
};

export default useCompareVotes;

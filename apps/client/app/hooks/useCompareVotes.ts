import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { enabledModelsType } from 'utils';
import { enqueuePersistence } from '@/store';
import {
  clearCompareVotes,
  getActiveWorkspaceAccount,
  getCompareVotes,
  type ICompareVote,
} from '@/utils/lforage';

export interface CompareTallyRow {
  model: enabledModelsType;
  wins: number;
  appearances: number;
  winRate: number;
}

/** Loads locally stored compare votes for the active workspace and derives per-model results. */
const useCompareVotes = (isWorkspaceReady: boolean) => {
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
    const rows = new Map<enabledModelsType, CompareTallyRow>();
    let ties = 0;
    let none = 0;

    for (const vote of votes || []) {
      if (vote.winner === 'tie') ties += 1;
      else if (vote.winner === 'none') none += 1;

      // Failed or empty results never had a chance to win, so they are not appearances.
      for (const { model, failed } of vote.results) {
        if (failed) continue;
        const row = rows.get(model) || { model, wins: 0, appearances: 0, winRate: 0 };
        row.appearances += 1;
        if (vote.winner === model) row.wins += 1;
        rows.set(model, row);
      }
    }

    const tally = [...rows.values()]
      .map((row) => ({ ...row, winRate: row.appearances ? row.wins / row.appearances : 0 }))
      .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.appearances - a.appearances);

    return { tally, ties, none, total: votes?.length ?? 0 };
  }, [votes]);

  return { ...summary, isLoading: votes === null, refresh, clear };
};

export default useCompareVotes;

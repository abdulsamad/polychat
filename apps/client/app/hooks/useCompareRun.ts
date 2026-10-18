import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useAuth, useUser } from '@clerk/react-router';
import { toast } from 'sonner';

import { getDefaultModelConfig } from 'utils';
import { configAtom, enqueuePersistence } from '@/store';
import { getGeneratedText, type ChatStreamPart } from '@/utils/api-calls';
import { providerForModel } from '@/utils/byok-providers';
import { getProviderKey, isProviderConfiguredSync } from '@/utils/byok-vault';
import {
  getAnonymousWorkspaceAccount,
  saveCompareRun,
  saveCompareVote,
  type CompareRubric,
  type CompareRubricCriterion,
  type CompareWinner,
  type ICompareRun,
  type ICompareRunColumn,
  type ICompareVote,
} from '@/utils/lforage';
import type { ModelOption } from './useByokModelAvailability';

/** Matches the chat stream throttle so four parallel streams do not re-render per chunk. */
const STREAM_UPDATE_INTERVAL_MS = 60;

export const MIN_COMPARE_MODELS = 2;
export const MAX_COMPARE_MODELS = 4;

export type CompareColumnStatus = 'waiting' | 'streaming' | 'done' | 'failed' | 'stopped';

/** A live column: the stored shape plus in-flight statuses and the thinking flag. */
export interface CompareColumnState extends Omit<ICompareRunColumn, 'status'> {
  status: CompareColumnStatus;
  isThinking: boolean;
}

export interface CompareRunState {
  id: string;
  prompt: string;
  timestamp: number;
  /** performance.now() when the run started, for live elapsed timers. 0 for saved runs. */
  startedAt: number;
  columns: CompareColumnState[];
  winner: CompareWinner | null;
  /** True when the run was reopened from history rather than streamed in this session. */
  isFromHistory?: boolean;
  /** Columns were shuffled and model names stay hidden until a vote is cast. */
  blind?: boolean;
}

export const isSettledStatus = (status: CompareColumnStatus) =>
  status === 'done' || status === 'failed' || status === 'stopped';

const isSettledColumn = (
  column: CompareColumnState
): column is CompareColumnState & { status: ICompareRunColumn['status'] } =>
  isSettledStatus(column.status);

const toRunRecord = ({
  id,
  timestamp,
  prompt,
  columns,
  winner,
  blind,
}: CompareRunState): ICompareRun => ({
  id,
  timestamp,
  prompt,
  winner,
  ...(blind ? { blind } : {}),
  columns: columns.filter(isSettledColumn).map(({ isThinking: _isThinking, ...column }) => column),
});

/** Everything about a settled run that the history copy must reflect. */
const getHistorySignature = ({ winner, columns }: CompareRunState) =>
  JSON.stringify([winner, columns.map(({ rubric }) => rubric ?? null)]);

const toVoteRecord = (run: CompareRunState, winner: CompareWinner): ICompareVote => ({
  id: run.id,
  timestamp: run.timestamp,
  prompt: run.prompt,
  winner,
  ...(run.blind ? { blind: true } : {}),
  results: run.columns.map((column) => ({
    model: column.model,
    provider: column.provider,
    ttftMs: column.ttftMs ?? null,
    totalMs: column.totalMs ?? null,
    ...(column.usage ? { usage: column.usage } : {}),
    ...(column.costUsd !== undefined ? { costUsd: column.costUsd } : {}),
    ...(column.finishReason ? { finishReason: column.finishReason } : {}),
    ...(column.rubric && Object.keys(column.rubric).length ? { rubric: column.rubric } : {}),
    failed: column.status === 'failed' || !column.content.trim(),
  })),
});

/** Fisher-Yates, so every order is equally likely in a blind run. */
const shuffle = <T>(items: readonly T[]) => {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
};

/** Hides the served id when it is just a dated or namespaced form of the picked model. */
const getServedModelId = (picked: string, served?: string) =>
  served && !served.toLowerCase().includes(picked.toLowerCase()) ? served : undefined;

const toErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return 'Something went wrong.';
  // fetch and stream reads reject with a TypeError on network failure ("Failed to fetch",
  // "Load failed", "network error"); an AbortError without our abort means the connection
  // was dropped. Provider and server messages are shown as they are.
  if (error instanceof TypeError || error.name === 'AbortError') {
    return 'Connection closed while waiting for the response.';
  }
  return error.message || 'Something went wrong.';
};

/**
 * Runs one prompt against several text models in parallel. Each column owns its
 * AbortController, so one failure or stop never affects the other columns. Runs
 * are ephemeral; only the vote is persisted.
 */
const useCompareRun = ({
  onVoteSaved,
  onRunSaved,
}: { onVoteSaved?: () => void; onRunSaved?: () => void } = {}) => {
  const config = useAtomValue(configAtom);
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const accountId = user?.id ?? getAnonymousWorkspaceAccount();
  const [run, setRun] = useState<CompareRunState | null>(null);
  const runRef = useRef(run);
  runRef.current = run;

  const runIdRef = useRef<string | null>(null);
  const columnsRef = useRef<CompareColumnState[]>([]);
  const controllersRef = useRef<AbortController[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const onVoteSavedRef = useRef(onVoteSaved);
  onVoteSavedRef.current = onVoteSaved;
  const onRunSavedRef = useRef(onRunSaved);
  onRunSavedRef.current = onRunSaved;
  /** The history signature last written per run, so each settled state is saved once. */
  const persistedRunsRef = useRef(new Map<string, string>());
  /** The last winner that was actually written for a run, used to roll back a failed change. */
  const savedVoteRef = useRef<{ runId: string; winner: CompareWinner } | null>(null);

  const flush = useCallback(() => {
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (!mountedRef.current) return;

    const runId = runIdRef.current;
    const columns = columnsRef.current.slice();
    setRun((current) => (current && current.id === runId ? { ...current, columns } : current));
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current === null) {
      flushTimerRef.current = setTimeout(flush, STREAM_UPDATE_INTERVAL_MS);
    }
  }, [flush]);

  const abortAll = useCallback(() => {
    controllersRef.current.forEach((controller) => controller.abort());
  }, []);

  /** Aborts every request and detaches the current run, so late stream updates are ignored. */
  const detachRun = useCallback(() => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current = [];
    runIdRef.current = null;
    columnsRef.current = [];
    if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
  }, []);

  // Unmount only: leaving the route aborts every request and drops pending renders. Under
  // StrictMode the simulated unmount runs this too; the remount flips mountedRef back.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      detachRun();
    };
  }, [detachRun]);

  // Account switch: a different account must never see or continue the previous run. The
  // reset runs in the effect body (while mounted), never in a cleanup.
  const accountRef = useRef(accountId);
  useEffect(() => {
    if (accountRef.current === accountId) return;
    accountRef.current = accountId;
    detachRun();
    setRun(null);
  }, [accountId, detachRun]);

  // History: save a run once every column has settled, and again whenever its vote or rubric
  // scores change (including a rolled-back vote). Writes are queued, so they never overtake.
  useEffect(() => {
    if (!run || !run.columns.every(({ status }) => isSettledStatus(status))) return;
    const persisted = persistedRunsRef.current;
    const signature = getHistorySignature(run);
    if (persisted.get(run.id) === signature) return;
    persisted.set(run.id, signature);

    const record = toRunRecord(run);
    enqueuePersistence(() => saveCompareRun(record))
      .then((saved) => {
        if (saved) onRunSavedRef.current?.();
      })
      .catch((error) => {
        console.error('Failed to save compare run', error);
        persisted.delete(record.id);
        toast.error('Could not save this comparison to history.');
      });
  }, [run]);

  const runColumn = useCallback(
    async (runId: string, index: number, prompt: string, signal: AbortSignal) => {
      const startedAt = performance.now();
      const update = (patch: Partial<CompareColumnState>, immediate = false) => {
        if (runIdRef.current !== runId) return;
        const columns = columnsRef.current;
        columns[index] = { ...columns[index], ...patch };
        if (immediate) flush();
        else scheduleFlush();
      };
      const elapsed = () => Math.round(performance.now() - startedAt);
      const { model, provider } = columnsRef.current[index];

      let reader: ReadableStreamDefaultReader<ChatStreamPart> | undefined;
      let content = '';
      let hasFirstPart = false;
      let settled = false;
      const settle = (patch: Partial<CompareColumnState>) => {
        if (settled) return;
        settled = true;
        update({ ...patch, isThinking: false, totalMs: elapsed() }, true);
      };
      // Settle immediately on Stop, even if a provider stream is slow to reject after abort.
      const onAbort = () => {
        void reader?.cancel().catch(() => undefined);
        settle({ status: 'stopped' });
      };
      signal.addEventListener('abort', onAbort, { once: true });

      try {
        const apiKey = getProviderKey(accountId, provider);
        const result = await getGeneratedText({
          prompt,
          model,
          provider,
          // The neutral profile keeps every model on the same system prompt. Custom
          // instructions only apply to the custom profile, matching the chat flow.
          profile: 'normal',
          language: config.language,
          modelConfig: getDefaultModelConfig(model),
          getToken,
          apiKey,
          signal,
        });

        if ('success' in result) {
          throw Object.assign(new Error(result.err), { status: result.status });
        }

        reader = result.getReader();
        if (signal.aborted) {
          onAbort();
          return;
        }
        while (true) {
          const { value, done } = await reader.read();
          if (signal.aborted) break;
          if (done) break;

          if (!hasFirstPart) {
            hasFirstPart = true;
            update({ status: 'streaming' }, true);
          }

          if (value.type === 'text') {
            content += value.text;
            const isFirstToken = columnsRef.current[index].ttftMs === undefined;
            update(
              { content, isThinking: false, ...(isFirstToken ? { ttftMs: elapsed() } : {}) },
              isFirstToken
            );
          } else if (value.type === 'reasoning') {
            if (!content) {
              const isFirstReasoning = columnsRef.current[index].reasoningStartMs === undefined;
              update({
                isThinking: true,
                ...(isFirstReasoning ? { reasoningStartMs: elapsed() } : {}),
              });
            }
          } else if (value.type === 'reasoning-end') {
            update({ isThinking: false });
          } else if (value.type === 'metadata') {
            const { usage, finishReason, costUsd, modelId } = value.metadata;
            update({
              usage,
              finishReason,
              costUsd,
              servedModelId: getServedModelId(model, modelId),
            });
          } else if (value.type === 'error') {
            throw new Error(value.error);
          }
        }

        if (signal.aborted) {
          onAbort();
          return;
        }

        settle({
          status: 'done',
          ...(content.trim() ? {} : { error: 'The model returned an empty response.' }),
        });
      } catch (error) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        void reader?.cancel().catch(() => undefined);
        console.error(error);
        settle({ status: 'failed', error: toErrorMessage(error) });
      } finally {
        signal.removeEventListener('abort', onAbort);
      }
    },
    [accountId, config.language, flush, getToken, scheduleFlush]
  );

  /** Returns false when the run could not start, so the caller can keep the prompt. */
  const start = useCallback(
    (rawPrompt: string, models: readonly ModelOption[], { blind = false } = {}) => {
      const prompt = rawPrompt.trim();
      if (!prompt || models.length < MIN_COMPARE_MODELS) return false;

      const picked = models.slice(0, MAX_COMPARE_MODELS);
      // Blind runs shuffle the picker order, so a column's position says nothing about its model.
      const columns = (blind ? shuffle(picked) : picked).map((model): CompareColumnState => ({
        id: crypto.randomUUID(),
        model: model.name,
        modelLabel: model.text,
        provider: providerForModel(model.name, model.provider),
        status: 'waiting',
        content: '',
        isThinking: false,
      }));

      // Mirror the chat composer: a configured but locked vault key must be unlocked first.
      const lockedProviders = [
        ...new Set(
          columns
            .map(({ provider }) => provider)
            .filter(
              (provider) =>
                isProviderConfiguredSync(accountId, provider) &&
                !getProviderKey(accountId, provider)
            )
        ),
      ];
      if (lockedProviders.length) {
        toast.error(`Unlock your ${lockedProviders.join(', ')} BYOK vault key before comparing.`);
        return false;
      }
      const needsSignIn = columns.some(({ provider }) => !getProviderKey(accountId, provider));
      if (needsSignIn && !isSignedIn) {
        toast.error('Sign in or add a BYOK key to use the shared models.');
        return false;
      }

      abortAll();
      const runId = crypto.randomUUID();
      const controllers = columns.map(() => new AbortController());
      runIdRef.current = runId;
      columnsRef.current = columns;
      controllersRef.current = controllers;
      if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;

      setRun({
        id: runId,
        prompt,
        timestamp: Date.now(),
        startedAt: performance.now(),
        columns: columns.slice(),
        winner: null,
        ...(blind ? { blind } : {}),
      });
      columns.forEach((_, index) => {
        void runColumn(runId, index, prompt, controllers[index].signal);
      });
      return true;
    },
    [abortAll, accountId, isSignedIn, runColumn]
  );

  const stopColumn = useCallback((columnId: string) => {
    const index = columnsRef.current.findIndex(({ id }) => id === columnId);
    if (index !== -1) controllersRef.current[index]?.abort();
  }, []);

  const vote = useCallback(async (winner: CompareWinner) => {
    const run = runRef.current;
    if (!run || !run.columns.every(({ status }) => isSettledStatus(status))) return;

    const record = toVoteRecord(run, winner);
    setRun((current) => (current?.id === run.id ? { ...current, winner } : current));
    try {
      const saved = await enqueuePersistence(() => saveCompareVote(record));
      if (!saved) throw new Error('No active workspace');
      savedVoteRef.current = { runId: run.id, winner };
      onVoteSavedRef.current?.();
    } catch (error) {
      console.error('Failed to save compare vote', error);
      toast.error('Could not save your vote locally.');
      if (mountedRef.current) {
        const savedWinner =
          savedVoteRef.current?.runId === run.id ? savedVoteRef.current.winner : null;
        setRun((current) =>
          current?.id === run.id && current.winner === winner
            ? { ...current, winner: savedWinner }
            : current
        );
      }
    }
  }, []);

  /**
   * Sets or clears (score undefined, or the same score again) one rubric score. A run that was
   * already voted on also updates its vote, so the leaderboard sees the new scores.
   */
  const rate = useCallback(
    (columnId: string, criterion: CompareRubricCriterion, score?: number) => {
      const run = runRef.current;
      if (!run || !run.columns.every(({ status }) => isSettledStatus(status))) return;

      const columns = run.columns.map((column) => {
        if (column.id !== columnId) return column;
        const rubric: CompareRubric = { ...column.rubric };
        if (score === undefined || rubric[criterion] === score) delete rubric[criterion];
        else rubric[criterion] = score;
        return { ...column, rubric };
      });
      // Keep the ref current, so a second tap before the next render builds on this one.
      runRef.current = { ...run, columns };
      setRun((current) => (current?.id === run.id ? { ...current, columns } : current));

      const winner = run.winner;
      if (!winner || savedVoteRef.current?.runId !== run.id) return;
      enqueuePersistence(() => saveCompareVote(toVoteRecord({ ...run, columns }, winner)))
        .then((saved) => {
          if (saved) onVoteSavedRef.current?.();
        })
        .catch((error) => {
          console.error('Failed to save compare rubric', error);
          toast.error('Could not save your rating locally.');
        });
    },
    []
  );

  /** Shows a saved run read-only (votes can still change). Any live run is aborted first. */
  const open = useCallback(
    (stored: ICompareRun) => {
      detachRun();
      const run: CompareRunState = {
        ...stored,
        startedAt: 0,
        isFromHistory: true,
        columns: stored.columns.map((column) => ({ ...column, isThinking: false })),
      };
      persistedRunsRef.current.set(stored.id, getHistorySignature(run));
      savedVoteRef.current = stored.winner ? { runId: stored.id, winner: stored.winner } : null;
      setRun(run);
    },
    [detachRun]
  );

  const close = useCallback(() => {
    detachRun();
    setRun(null);
  }, [detachRun]);

  const isRunning = Boolean(run?.columns.some(({ status }) => !isSettledStatus(status)));
  const canVote = Boolean(
    run && !isRunning && run.columns.some(({ content }) => content.trim().length > 0)
  );

  return { run, isRunning, canVote, start, stop: abortAll, stopColumn, vote, rate, open, close };
};

export default useCompareRun;

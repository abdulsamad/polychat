import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useAuth, useUser } from '@clerk/react-router';
import { toast } from 'sonner';

import {
  getDefaultModelConfig,
  type ChatResponseMetadata,
  type enabledModelsType,
  type modelProviderType,
} from 'utils';
import { configAtom, enqueuePersistence } from '@/store';
import { getGeneratedText, type ChatStreamPart } from '@/utils/api-calls';
import { providerForModel } from '@/utils/byok-providers';
import { getProviderKey, isProviderConfiguredSync } from '@/utils/byok-vault';
import {
  getAnonymousWorkspaceAccount,
  saveCompareVote,
  type CompareWinner,
  type ICompareVote,
} from '@/utils/lforage';
import type { ModelOption } from './useByokModelAvailability';

/** Matches the chat stream throttle so four parallel streams do not re-render per chunk. */
const STREAM_UPDATE_INTERVAL_MS = 60;

export const MIN_COMPARE_MODELS = 2;
export const MAX_COMPARE_MODELS = 4;

export type CompareColumnStatus = 'waiting' | 'streaming' | 'done' | 'failed' | 'stopped';

export interface CompareColumnState {
  id: string;
  model: enabledModelsType;
  modelLabel: string;
  provider: modelProviderType;
  status: CompareColumnStatus;
  content: string;
  isThinking: boolean;
  error?: string;
  ttftMs?: number;
  totalMs?: number;
  usage?: ChatResponseMetadata['usage'];
}

export interface CompareRunState {
  id: string;
  prompt: string;
  timestamp: number;
  columns: CompareColumnState[];
  winner: CompareWinner | null;
}

export const isSettledStatus = (status: CompareColumnStatus) =>
  status === 'done' || status === 'failed' || status === 'stopped';

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
const useCompareRun = ({ onVoteSaved }: { onVoteSaved?: () => void } = {}) => {
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
            if (!content) update({ isThinking: true });
          } else if (value.type === 'reasoning-end') {
            update({ isThinking: false });
          } else if (value.type === 'metadata') {
            update({ usage: value.metadata.usage });
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
    (rawPrompt: string, models: readonly ModelOption[]) => {
      const prompt = rawPrompt.trim();
      if (!prompt || models.length < MIN_COMPARE_MODELS) return false;

      const columns = models.slice(0, MAX_COMPARE_MODELS).map((model): CompareColumnState => ({
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

      setRun({ id: runId, prompt, timestamp: Date.now(), columns: columns.slice(), winner: null });
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

    const record: ICompareVote = {
      id: run.id,
      timestamp: run.timestamp,
      prompt: run.prompt,
      winner,
      results: run.columns.map((column) => ({
        model: column.model,
        provider: column.provider,
        ttftMs: column.ttftMs ?? null,
        totalMs: column.totalMs ?? null,
        ...(column.usage ? { usage: column.usage } : {}),
        failed: column.status === 'failed' || !column.content.trim(),
      })),
    };

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

  const isRunning = Boolean(run?.columns.some(({ status }) => !isSettledStatus(status)));
  const canVote = Boolean(
    run && !isRunning && run.columns.some(({ content }) => content.trim().length > 0)
  );

  return { run, isRunning, canVote, start, stop: abortAll, stopColumn, vote };
};

export default useCompareRun;

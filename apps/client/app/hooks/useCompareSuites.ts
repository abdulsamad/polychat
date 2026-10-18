import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { enqueuePersistence } from '@/store';
import {
  deleteCompareSuite,
  getActiveWorkspaceAccount,
  getCompareSuites,
  saveCompareSuite,
  type CompareSuiteTag,
  type ICompareSuite,
} from '@/utils/lforage';
import type { CompareRunState } from './useCompareRun';

/** Saved prompt suites for the active workspace, newest first. */
export const useCompareSuites = (isWorkspaceReady: boolean) => {
  const [suites, setSuites] = useState<ICompareSuite[] | null>(null);
  const mountedRef = useRef(true);
  /** Bumped by every refresh; a load that finishes under an older generation is dropped. */
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
    try {
      const stored = await enqueuePersistence(getCompareSuites);
      if (
        mountedRef.current &&
        generationRef.current === generation &&
        getActiveWorkspaceAccount() === accountId
      ) {
        setSuites(stored);
      }
    } catch (error) {
      console.error('Failed to load compare suites', error);
      if (mountedRef.current && generationRef.current === generation) setSuites([]);
    }
  }, []);

  useEffect(() => {
    if (!isWorkspaceReady) {
      setSuites(null);
      return;
    }
    void refresh();
  }, [isWorkspaceReady, refresh]);

  const save = useCallback(
    async (suite: ICompareSuite) => {
      const saved = await enqueuePersistence(() => saveCompareSuite(suite));
      if (!saved) throw new Error('No active workspace');
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (suiteId: string) => {
      await enqueuePersistence(() => deleteCompareSuite(suiteId));
      await refresh();
    },
    [refresh]
  );

  return { suites: suites ?? [], isLoading: suites === null, save, remove };
};

interface ActiveSuite {
  suite: ICompareSuite;
  suiteRunId: string;
  /** Index of the prompt currently running. */
  index: number;
}

/** Starts one suite prompt; returns false when the run could not start. */
type LaunchPrompt = (prompt: string, tag: CompareSuiteTag) => boolean;

/**
 * Runs a suite's prompts one after another. The next prompt starts as soon as the previous run
 * settles; stopping (or a prompt that cannot start) ends the suite and keeps finished runs.
 */
export const useSuiteRunner = (run: CompareRunState | null, isRunning: boolean) => {
  const [active, setActive] = useState<ActiveSuite | null>(null);
  const launchRef = useRef<LaunchPrompt | null>(null);

  const launch = useCallback((next: ActiveSuite) => {
    const tag: CompareSuiteTag = {
      suiteId: next.suite.id,
      suiteName: next.suite.name,
      suiteRunId: next.suiteRunId,
      index: next.index,
      total: next.suite.prompts.length,
    };
    if (launchRef.current?.(next.suite.prompts[next.index], tag)) {
      setActive(next);
    } else {
      setActive(null);
      toast.error(`Suite "${next.suite.name}" stopped: a prompt could not start.`);
    }
  }, []);

  const startSuite = useCallback(
    (suite: ICompareSuite, launchPrompt: LaunchPrompt) => {
      if (!suite.prompts.length) return;
      launchRef.current = launchPrompt;
      launch({ suite, suiteRunId: crypto.randomUUID(), index: 0 });
    },
    [launch]
  );

  /** Ends the suite after the current run; call before aborting so a stop never advances. */
  const stopSuite = useCallback(() => {
    setActive(null);
    launchRef.current = null;
  }, []);

  useEffect(() => {
    if (!active || !run || isRunning) return;
    if (run.suite?.suiteRunId !== active.suiteRunId || run.suite.index !== active.index) return;

    const nextIndex = active.index + 1;
    if (nextIndex >= active.suite.prompts.length) {
      setActive(null);
      launchRef.current = null;
      toast.success(
        `Suite "${active.suite.name}" finished: ${active.suite.prompts.length} runs saved to History.`
      );
      return;
    }
    launch({ ...active, index: nextIndex });
  }, [active, isRunning, launch, run]);

  return { activeSuite: active, startSuite, stopSuite };
};

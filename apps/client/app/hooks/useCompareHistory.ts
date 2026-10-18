import { useCallback, useEffect, useRef, useState } from 'react';

import { enqueuePersistence } from '@/store';
import {
  clearCompareRuns,
  deleteCompareRun,
  getActiveWorkspaceAccount,
  getCompareRuns,
  saveCompareRun,
  type ICompareRun,
} from '@/utils/lforage';

/** Loads saved compare runs (answers included) for the active workspace, newest first. */
const useCompareHistory = (isWorkspaceReady: boolean) => {
  const [runs, setRuns] = useState<ICompareRun[] | null>(null);
  const [error, setError] = useState(false);
  const mountedRef = useRef(true);
  /** Bumped by every refresh and write; a load that finishes under an older generation is dropped. */
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
      // Reads go through the persistence queue, so they observe every queued save or delete.
      const storedRuns = await enqueuePersistence(getCompareRuns);
      if (isCurrent()) {
        setRuns(storedRuns);
        setError(false);
      }
    } catch (loadError) {
      console.error('Failed to load compare history', loadError);
      if (isCurrent()) {
        setRuns([]);
        setError(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!isWorkspaceReady) {
      setRuns(null);
      return;
    }
    void refresh();
  }, [isWorkspaceReady, refresh]);

  const remove = useCallback(
    async (runId: string) => {
      await enqueuePersistence(() => deleteCompareRun(runId));
      await refresh();
    },
    [refresh]
  );

  /** Puts a deleted run back (undo). */
  const restore = useCallback(
    async (run: ICompareRun) => {
      await enqueuePersistence(() => saveCompareRun(run));
      await refresh();
    },
    [refresh]
  );

  const clear = useCallback(async () => {
    // Invalidate any in-flight refresh so it cannot restore the runs being cleared.
    const generation = ++generationRef.current;
    await enqueuePersistence(clearCompareRuns);
    if (mountedRef.current && generationRef.current === generation) setRuns([]);
  }, []);

  return { runs: runs ?? [], isLoading: runs === null, error, refresh, remove, restore, clear };
};

export default useCompareHistory;

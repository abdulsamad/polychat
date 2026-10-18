import { useCallback, useEffect, useState } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { useAuth, useUser } from '@clerk/react-router';

import {
  clearSelectedMessagesAtom,
  clearThreadMessagesAtom,
  configAtom,
  defaultConfig,
  hydrateThreadMessagesAtom,
  interruptPendingRequests,
  resetChatQueueAtom,
  threadAtom,
  threadSettingsOpenAtom,
  userSettingsOpenAtom,
  waitForPersistence,
  workspaceReadyAtom,
} from '@/store';
import { abortAllStreams } from '@/utils/chat-stream-registry';
import {
  getActiveWorkspaceAccount,
  getAnonymousWorkspaceAccount,
  getConfig,
  getMessages,
  setActiveWorkspaceAccount,
} from '@/utils/lforage';

/**
 * The home route owns the full workspace load. When /compare is opened directly,
 * this loads only what the compare page and sidebar need: the active account,
 * saved config, and stored messages (so the message save effect never writes an
 * empty snapshot). Threads are not selected and no demo workspace is created.
 */
const useCompareWorkspace = () => {
  const { isLoaded } = useAuth();
  const { user } = useUser();
  const accountId = user?.id ?? getAnonymousWorkspaceAccount();
  const workspaceReady = useAtomValue(workspaceReadyAtom);
  const setWorkspaceReady = useSetAtom(workspaceReadyAtom);
  const setConfig = useSetAtom(configAtom);
  const setThread = useSetAtom(threadAtom);
  const hydrateThreadMessages = useSetAtom(hydrateThreadMessagesAtom);
  const clearThreadMessages = useSetAtom(clearThreadMessagesAtom);
  const clearSelectedMessages = useSetAtom(clearSelectedMessagesAtom);
  const resetChatQueue = useSetAtom(resetChatQueueAtom);
  const setThreadSettingsOpen = useSetAtom(threadSettingsOpenAtom);
  const setUserSettingsOpen = useSetAtom(userSettingsOpenAtom);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Ready means the shared workspace flag is set for this exact account, whoever loaded it.
  const isReady = isLoaded && workspaceReady && getActiveWorkspaceAccount() === accountId;

  useEffect(() => {
    if (!isLoaded) return;
    if (workspaceReady && getActiveWorkspaceAccount() === accountId) {
      setError(null);
      return;
    }

    let cancelled = false;
    const loadWorkspace = async () => {
      setError(null);
      const previousAccountId = getActiveWorkspaceAccount();

      if (previousAccountId && previousAccountId !== accountId) {
        // Same isolation as the home route: never carry one account's state into another.
        setWorkspaceReady(false);
        abortAllStreams();
        resetChatQueue();
        setThreadSettingsOpen(false);
        setUserSettingsOpen(false);
        setThread(null);
        clearSelectedMessages();
        clearThreadMessages();
        setConfig(defaultConfig);
        try {
          await waitForPersistence();
        } catch (error) {
          console.error('Failed to finish saving the previous workspace', error);
        }
        if (cancelled) return;
      }

      setActiveWorkspaceAccount(accountId);
      try {
        const [messages, savedConfig] = await Promise.all([getMessages(), getConfig()]);
        if (cancelled) return;
        setConfig({ ...defaultConfig, ...savedConfig });
        hydrateThreadMessages(interruptPendingRequests(messages || {}));
        setWorkspaceReady(true);
      } catch (loadError) {
        console.error('Failed to load the workspace for compare', loadError);
        if (!cancelled) setError('Your local workspace could not be loaded.');
      }
    };

    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [
    accountId,
    clearSelectedMessages,
    clearThreadMessages,
    hydrateThreadMessages,
    isLoaded,
    resetChatQueue,
    setConfig,
    setThread,
    setThreadSettingsOpen,
    setUserSettingsOpen,
    setWorkspaceReady,
    workspaceReady,
    attempt,
  ]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  return { isReady, error, retry, accountId };
};

export default useCompareWorkspace;

import { useEffect, useRef, useState, Suspense } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useAuth, useClerk, useUser } from '@clerk/react-router';
import { useNavigate } from 'react-router';

import {
  getDefaultThread,
  getDefaultThreadName,
  configAtom,
  configSaveEffect,
  defaultConfig,
  clearThreadMessagesAtom,
  clearSelectedMessagesAtom,
  hydrateThreadMessagesAtom,
  replaceMessagesAtom,
  messageSaveEffect,
  resetChatQueueAtom,
  selectedMessageIdsAtom,
  threadAtom,
  threadMessagesAtom,
  threadSettingsOpenAtom,
  threadSaveEffect,
  userSettingsOpenAtom,
  waitForPersistence,
  workspaceReadyAtom,
} from '@/store';
import {
  getConfig,
  getActiveWorkspaceAccount,
  getAnonymousWorkspaceAccount,
  getMessages,
  getThreads,
  getUserSettings,
  hasDismissedDemoThreads,
  removeDemoThreads,
  setMessages,
  setActiveWorkspaceAccount,
  setThreads,
  hasSeenStartedToast,
} from '@/utils/lforage';
import { createDemoWorkspace } from '@/utils/demo-threads';
import { getProviderKey } from '@/utils/byok-vault';
import { providerForModel } from '@/utils/byok-providers';
import { abortAllStreams } from '@/utils/chat-stream-registry';
import Input from '@/components/Input';
import MessageSelectionBar from '@/components/MessageSelectionBar';
import Thread from '@/components/Thread';
import Loading from '@/loading';
import { Button } from '@/components/ui/button';
import { ArrowRightIcon, SparklesIcon } from 'lucide-react';

import type { Route } from './+types/home';

export const meta = ({}: Route.MetaArgs) => [
  { title: 'PolyChat - The AI Chat App' },
  { name: 'description', content: 'Welcome to PolyChat!' },
];

const Home = ({ params: { threadId } }: Route.ComponentProps) => {
  const setThread = useSetAtom(threadAtom);
  const thread = useAtomValue(threadAtom);
  const hydrateThreadMessages = useSetAtom(hydrateThreadMessagesAtom);
  const clearThreadMessages = useSetAtom(clearThreadMessagesAtom);
  const clearSelectedMessages = useSetAtom(clearSelectedMessagesAtom);
  const replaceMessages = useSetAtom(replaceMessagesAtom);
  const messagesByThread = useAtomValue(threadMessagesAtom);
  const selectedMessageIds = useAtomValue(selectedMessageIdsAtom);
  const setConfig = useSetAtom(configAtom);
  const resetChatQueue = useSetAtom(resetChatQueueAtom);
  const setThreadSettingsOpen = useSetAtom(threadSettingsOpenAtom);
  const setUserSettingsOpen = useSetAtom(userSettingsOpenAtom);
  const setWorkspaceReady = useSetAtom(workspaceReadyAtom);
  const [isWorkspaceLoaded, setIsWorkspaceLoaded] = useState(false);
  const messagesByThreadRef = useRef(messagesByThread);

  messagesByThreadRef.current = messagesByThread;

  const { isLoaded } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const workspaceAccountId = user?.id ?? getAnonymousWorkspaceAccount();
  const hasByokKey = Boolean(
    thread &&
      getProviderKey(
        workspaceAccountId,
        providerForModel(thread.settings.model, thread.settings.modelProvider)
      )
  );

  // Subscribe to thread, message side effects to save changes locally
  useAtom(threadSaveEffect, { delay: 1000 });
  useAtom(messageSaveEffect, { delay: 1000 });
  useAtom(configSaveEffect, { delay: 1000 });

  const navigate = useNavigate();

  const startFromDemo = async () => {
    const newThread = getDefaultThread((await getUserSettings()) || undefined);
    const storedThreads = (await getThreads()) || [];
    await setThreads([newThread, ...storedThreads.filter(({ id }) => id !== newThread.id)]);
    setThread(newThread);
    replaceMessages([]);
    navigate(`/${newThread.id}`, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;

    if (!isLoaded) {
      const previousAccountId = getActiveWorkspaceAccount();
      setWorkspaceReady(false);
      abortAllStreams();
      resetChatQueue();
      setThreadSettingsOpen(false);
      setUserSettingsOpen(false);
      setConfig(defaultConfig);
      setThread(null);
      clearSelectedMessages();
      clearThreadMessages();
      setIsWorkspaceLoaded(false);

      void waitForPersistence().then(
        () => {
          if (!cancelled && getActiveWorkspaceAccount() === previousAccountId) {
            setActiveWorkspaceAccount(null);
          }
        },
        (error) => {
          console.error('Failed to finish saving the previous workspace', error);
          if (!cancelled && getActiveWorkspaceAccount() === previousAccountId) {
            setActiveWorkspaceAccount(null);
          }
        }
      );
      return () => {
        cancelled = true;
      };
    }

    const loadWorkspace = async () => {
      const previousAccountId = getActiveWorkspaceAccount();
      const isAccountChange = previousAccountId !== workspaceAccountId;
      const isInitialWorkspaceLoad = !isWorkspaceLoaded;
      if (isAccountChange || isInitialWorkspaceLoad) {
        setWorkspaceReady(false);
        setThread(null);
        setIsWorkspaceLoaded(false);
      }
      clearSelectedMessages();

      if (isAccountChange) {
        abortAllStreams();
        resetChatQueue();
        setThreadSettingsOpen(false);
        setUserSettingsOpen(false);
        clearThreadMessages();
        setConfig(defaultConfig);

        try {
          await waitForPersistence();
        } catch (error) {
          console.error('Failed to finish saving the previous workspace', error);
        }
        if (cancelled) return;
      }
      setActiveWorkspaceAccount(workspaceAccountId);

      try {
        const [threads, messages, userSettings, savedConfig] = await Promise.all([
          getThreads(),
          getMessages(),
          getUserSettings(),
          getConfig(),
        ]);
        if (cancelled) return;

        let storedThreads = threads || [];
        let storedMessages = Object.fromEntries(
          Object.entries(messages || {}).map(([id, threadMessages]) => [
            id,
            threadMessages.map((message) =>
              message.metadata.requestState === 'queued' ||
              message.metadata.requestState === 'streaming'
                ? {
                    ...message,
                    metadata: { ...message.metadata, requestState: 'interrupted' as const },
                  }
                : message
            ),
          ])
        );

        if (
          !storedThreads.length &&
          !(await hasSeenStartedToast()) &&
          !(await hasDismissedDemoThreads())
        ) {
          const demoWorkspace = createDemoWorkspace();
          storedThreads = demoWorkspace.threads;
          storedMessages = demoWorkspace.messages;
          await Promise.all([setThreads(storedThreads), setMessages(storedMessages)]);
        }
        const threadData = threadId
          ? storedThreads.find((thread) => thread.id === threadId) || null
          : (() => {
              const latestThread = [...storedThreads].sort(
                (a, b) => b.metadata.timestamp - a.metadata.timestamp
              )[0];
              const latestMessages = latestThread
                ? messagesByThreadRef.current[latestThread.id] ||
                  storedMessages[latestThread.id] ||
                  []
                : [];
              const shouldReuseLatest =
                latestThread?.metadata.nameSource === 'default' && !latestMessages.length;

              return shouldReuseLatest
                ? {
                    ...latestThread,
                    metadata: {
                      ...latestThread.metadata,
                      name: getDefaultThreadName(),
                      timestamp: Date.now(),
                    },
                  }
                : getDefaultThread(userSettings || undefined);
            })();

        if (!threadData) {
          navigate('/', { replace: true });
          return;
        }

        if (!threadId) {
          const existingThreadIndex = storedThreads.findIndex(
            (thread) => thread.id === threadData.id
          );
          const nextThreads =
            existingThreadIndex === -1
              ? [threadData, ...storedThreads]
              : storedThreads.map((thread, index) =>
                  index === existingThreadIndex ? threadData : thread
                );
          await setThreads(nextThreads);
        }

        if (cancelled) return;
        setConfig({ ...defaultConfig, ...savedConfig });
        hydrateThreadMessages(storedMessages);
        setThread(threadData);
        setWorkspaceReady(true);
        setIsWorkspaceLoaded(true);

        if (!threadId) navigate(`/${threadData.id}`, { replace: true });
      } catch {
        if (cancelled) return;

        const threadData = getDefaultThread();
        setThread(threadData);
        replaceMessages([]);
        setWorkspaceReady(true);
        setIsWorkspaceLoaded(true);
        navigate(`/${threadData.id}`, { replace: true });
      }
    };

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [
    isLoaded,
    navigate,
    clearThreadMessages,
    clearSelectedMessages,
    hydrateThreadMessages,
    replaceMessages,
    resetChatQueue,
    setConfig,
    setThread,
    setThreadSettingsOpen,
    setUserSettingsOpen,
    setWorkspaceReady,
    isWorkspaceLoaded,
    threadId,
    user?.id,
    workspaceAccountId,
  ]);

  if (!isLoaded) {
    return <Loading />;
  }

  if (!isWorkspaceLoaded) return <Loading />;

  return (
    <Suspense fallback={<Loading />}>
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <section className="min-h-0 min-w-0 flex-1">
          <Thread className="h-full" />
        </section>
        <section className="shrink-0 border-t border-border/70 bg-background/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:px-5 sm:pt-4">
          <div className="mx-auto w-full max-w-4xl">
            {selectedMessageIds.length > 0 ? (
              <MessageSelectionBar />
            ) : thread?.metadata.isDemo ? (
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/[0.04] px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <SparklesIcon className="size-4 shrink-0 text-primary" />
                  <p className="text-sm text-muted-foreground">
                    This is a read-only demo. Start a new chat to try it yourself.
                  </p>
                </div>
                <Button type="button" className="shrink-0" onClick={() => void startFromDemo()}>
                  Start chatting
                  <ArrowRightIcon className="ml-2 size-4" />
                </Button>
              </div>
            ) : !user?.id && !hasByokKey ? (
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/[0.04] px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Sign in to start a chat with the models you configure.
                </p>
                <Button type="button" className="shrink-0" onClick={() => void clerk.redirectToSignIn()}>
                  Sign in to chat
                  <ArrowRightIcon className="ml-2 size-4" />
                </Button>
              </div>
            ) : (
              <Input />
            )}
          </div>
        </section>
      </div>
    </Suspense>
  );
};

export default Home;

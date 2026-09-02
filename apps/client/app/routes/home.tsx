import { useEffect, useRef, useState, Suspense } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useAuth, useUser, RedirectToSignIn } from '@clerk/react-router';
import { useNavigate } from 'react-router';

import {
  getDefaultThread,
  getDefaultThreadName,
  configAtom,
  configSaveEffect,
  defaultConfig,
  clearThreadMessagesAtom,
  hydrateThreadMessagesAtom,
  replaceMessagesAtom,
  messageSaveEffect,
  threadAtom,
  threadMessagesAtom,
  threadSaveEffect,
  workspaceReadyAtom,
} from '@/store';
import {
  getConfig,
  getMessages,
  getThreads,
  getUserSettings,
  setActiveWorkspaceAccount,
  setThreads,
} from '@/utils/lforage';
import Input from '@/components/Input';
import Thread from '@/components/Thread';
import Loading from '@/loading';

import type { Route } from './+types/home';

export const meta = ({}: Route.MetaArgs) => [
  { title: 'PolyChat - The AI Chat App' },
  { name: 'description', content: 'Welcome to PolyChat!' },
];

const Home = ({ params: { threadId } }: Route.ComponentProps) => {
  const setThread = useSetAtom(threadAtom);
  const hydrateThreadMessages = useSetAtom(hydrateThreadMessagesAtom);
  const clearThreadMessages = useSetAtom(clearThreadMessagesAtom);
  const replaceMessages = useSetAtom(replaceMessagesAtom);
  const messagesByThread = useAtomValue(threadMessagesAtom);
  const setConfig = useSetAtom(configAtom);
  const setWorkspaceReady = useSetAtom(workspaceReadyAtom);
  const [isWorkspaceLoaded, setIsWorkspaceLoaded] = useState(false);
  const workspaceAccountRef = useRef<string | null>(null);
  const messagesByThreadRef = useRef(messagesByThread);

  messagesByThreadRef.current = messagesByThread;

  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();

  // Subscribe to thread, message side effects to save changes locally
  useAtom(threadSaveEffect, { delay: 1000 });
  useAtom(messageSaveEffect, { delay: 1000 });
  useAtom(configSaveEffect, { delay: 1000 });

  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) {
      workspaceAccountRef.current = null;
      setWorkspaceReady(false);
      setActiveWorkspaceAccount(null);
      setConfig(defaultConfig);
      setThread(null);
      clearThreadMessages();
      setIsWorkspaceLoaded(false);
      return;
    }

    let cancelled = false;

    const loadWorkspace = async () => {
      const isAccountChange = workspaceAccountRef.current !== user.id;
      setWorkspaceReady(false);
      setThread(null);
      setIsWorkspaceLoaded(false);
      setActiveWorkspaceAccount(user.id);

      if (isAccountChange) {
        clearThreadMessages();
        setConfig(defaultConfig);
      }

      try {
        const [threads, messages, userSettings, savedConfig] = await Promise.all([
          getThreads(),
          getMessages(),
          getUserSettings(),
          getConfig(),
        ]);
        if (cancelled) return;

        const storedThreads = threads || [];
        const storedMessages = Object.fromEntries(
          Object.entries(messages || {}).map(([id, threadMessages]) => [
            id,
            threadMessages.map((message) =>
              isAccountChange &&
              (message.metadata.requestState === 'queued' ||
                message.metadata.requestState === 'streaming')
                ? {
                    ...message,
                    metadata: { ...message.metadata, requestState: 'interrupted' as const },
                  }
                : message
            ),
          ])
        );
        const threadData = threadId
          ? storedThreads.find((thread) => thread.id === threadId) || null
          : (() => {
              const latestThread = [...storedThreads].sort(
                (a, b) => b.metadata.timestamp - a.metadata.timestamp
              )[0];
              const shouldReuseLatest =
                latestThread?.metadata.nameSource === 'default' &&
                !(messagesByThreadRef.current[latestThread.id] || storedMessages[latestThread.id])
                  ?.length;

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
          const existingThreadIndex = storedThreads.findIndex((thread) => thread.id === threadData.id);
          const nextThreads =
            existingThreadIndex === -1
              ? [threadData, ...storedThreads]
              : storedThreads.map((thread, index) =>
                  index === existingThreadIndex ? threadData : thread
                );
          await setThreads(nextThreads);
        }

        if (cancelled) return;
        workspaceAccountRef.current = user.id;
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
    isSignedIn,
    navigate,
    clearThreadMessages,
    hydrateThreadMessages,
    replaceMessages,
    setConfig,
    setThread,
    setWorkspaceReady,
    threadId,
    user?.id,
  ]);

  if (!isLoaded) {
    return <Loading />;
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />;
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
            <Input />
          </div>
        </section>
      </div>
    </Suspense>
  );
};

export default Home;

import { useEffect, Suspense } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { useAuth, RedirectToSignIn } from '@clerk/react-router';
import { useNavigate } from 'react-router';

import {
  getDefaultThread,
  getDefaultThreadName,
  replaceMessagesAtom,
  messageSaveEffect,
  threadAtom,
  threadSaveEffect,
} from '@/store';
import {
  getMessages,
  getThreads,
  getUserSettings,
  lforage,
  threadsKey,
} from '@/utils/lforage';
import Input from '@/components/Input';
import Thread from '@/components/Thread';
import Loading from '@/loading';

import type { Route } from './+types/home';

export const meta = ({}: Route.MetaArgs) => [
  { title: 'PolyChat - The AI Chat App' },
  { name: 'description', content: 'Welcome to PolyChat!' },
];

export const clientLoader = async ({ params: { threadId } }: Route.ClientLoaderArgs) => {
  try {
    const threads = (await getThreads()) || [];
    const messages = (await getMessages()) || {};
    const userSettings = await getUserSettings();

    if (!threadId) {
      const latestThread = [...threads].sort(
        (a, b) => b.metadata.timestamp - a.metadata.timestamp
      )[0];
      const shouldReuseLatest =
        latestThread?.metadata.nameSource === 'default' && !messages[latestThread.id]?.length;
      const threadData = shouldReuseLatest
        ? {
            ...latestThread,
            metadata: {
              ...latestThread.metadata,
              name: getDefaultThreadName(),
              timestamp: Date.now(),
            },
          }
        : getDefaultThread(userSettings || undefined);

      // The route is changed to /:threadId immediately after this loader returns.
      // Persist first so that follow-up load can resolve the same thread instead
      // of treating its URL as invalid and creating another empty one.
      const existingThreadIndex = threads.findIndex(({ id }) => id === threadData.id);
      const nextThreads =
        existingThreadIndex === -1
          ? [threadData, ...threads]
          : threads.map((thread, index) => (index === existingThreadIndex ? threadData : thread));

      await lforage.setItem(threadsKey, nextThreads);

      return { threadData, messageData: messages[threadData.id] || [] };
    }

    const threadData = threads.find(({ id }) => id === threadId) || null;
    const messageData = messages[threadId] || [];

    return { threadData, messageData };
  } catch (err) {
    return { threadData: getDefaultThread(), messageData: [] };
  }
};

const Home = ({ params: { threadId }, loaderData }: Route.ComponentProps) => {
  const setThread = useSetAtom(threadAtom);
  const replaceMessages = useSetAtom(replaceMessagesAtom);

  const { isSignedIn, isLoaded } = useAuth();

  // Subscribe to thread, message side effects to save changes locally
  useAtom(threadSaveEffect, { delay: 1000 });
  useAtom(messageSaveEffect, { delay: 1000 });

  const navigate = useNavigate();

  useEffect(() => {
    const { threadData } = loaderData;

    if (!threadData) {
      setThread(getDefaultThread());
      replaceMessages([]);
      navigate('/', { replace: true });
      return;
    }

    setThread(threadData);
    replaceMessages(loaderData.messageData);

    // Give every active thread a canonical URL, including a newly-created thread.
    if (!threadId) {
      navigate(`/${threadData.id}`, { replace: true });
    }
  }, [loaderData, threadId]);

  if (!isLoaded) {
    return <Loading />;
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

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

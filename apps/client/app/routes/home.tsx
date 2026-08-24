import { useEffect, Suspense } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { useAuth, RedirectToSignIn } from '@clerk/react-router';
import { useNavigate } from 'react-router';

import {
  getDefaultThread,
  replaceMessagesAtom,
  messageSaveEffect,
  threadAtom,
  threadSaveEffect,
} from '@/store';
import { getMessages, getThreads } from '@/utils/lforage';
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

    if (!threadId) {
      const emptyThread = threads.find((thread) => !messages[thread.id]?.length);
      const threadData = emptyThread || getDefaultThread();

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
      <section>
        <Thread className="h-[calc(100svh-152px)]" />
      </section>
      <section className="flex flex-col p-5">
        <Input />
      </section>
    </Suspense>
  );
};

export default Home;

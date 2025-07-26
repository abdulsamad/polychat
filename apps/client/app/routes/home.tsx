import { useEffect, Suspense } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { useAuth, RedirectToSignIn } from '@clerk/react-router';
import { useNavigate } from 'react-router';

import {
  getDefaultThread,
  messagesAtom,
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
      return { threadData: emptyThread || getDefaultThread(), messageData: [] };
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
  const setMessages = useSetAtom(messagesAtom);

  const { isSignedIn, isLoaded } = useAuth();

  // Subscribe to thread, message side effects to save changes locally
  useAtom(threadSaveEffect, { delay: 1000 });
  useAtom(messageSaveEffect, { delay: 1000 });

  const navigate = useNavigate();

  useEffect(() => {
    const { threadData } = loaderData;

    if (!threadData) return;

    // Only set thread if we have threadId or it's a new thread
    if (threadId || threadData.id) {
      setThread(threadData);
      setMessages(loaderData.messageData as any, true as any);
    } else {
      // For new threads, navigate after setting state
      setThread(threadData);
      setMessages([] as any, true as any);
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

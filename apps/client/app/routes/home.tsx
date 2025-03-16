import { useEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useAuth, RedirectToSignIn } from '@clerk/react-router';

import {
  getDefaultThread,
  messagesAtom,
  messageSaveEffect,
  threadAtom,
  threadSaveEffect,
  configAtom,
} from '@/store';
import { IS_SPEECH_RECOGNITION_SUPPORTED } from '@/utils';
import { getMessages, getThreads } from '@/utils/lforage';
import Text from '@/components/Inputs/Text';
import Voice from '@/components/Inputs/Voice';
import Thread from '@/components/Thread';
import Loading from '@/loading';

import type { Route } from './+types/home';

export const meta = ({}: Route.MetaArgs) => [
  { title: 'PolyChat - The AI Chat App' },
  { name: 'description', content: 'Welcome to PolyChat!' },
];

export const clientLoader = async ({ params: { threadId } }: Route.ClientLoaderArgs) => {
  try {
    const threads = await getThreads();
    const messages = await getMessages();

    if (!threadId) {
      // Look for an existing empty thread
      const emptyThread = threads?.find((thread) => !messages?.[thread.id]?.length);

      // If no empty thread exists, return null (will create new thread in component)
      return { threadData: emptyThread || null };
    }

    return {
      threadData: threads?.find(({ id }) => id === threadId) || null,
    };
  } catch (err) {
    return { threadData: null };
  }
};

const Home = ({ params: { threadId }, loaderData }: Route.ComponentProps) => {
  const { textInput } = useAtomValue(configAtom);
  const setThread = useSetAtom(threadAtom);
  const setMessages = useSetAtom(messagesAtom);

  const { isSignedIn, isLoaded } = useAuth();

  const { threadData } = loaderData;

  // Subscribe to thread, message side effects to save changes locally
  useAtom(threadSaveEffect);
  useAtom(messageSaveEffect);

  useEffect(() => {
    (async () => {
      // If we have threadData, use it, otherwise create a new thread
      const newThread = threadData ?? getDefaultThread();

      // Clear messages when switching threads or creating a new thread
      setMessages([] as any, true as any);
      setThread(newThread);

      if (threadId) {
        const messages = await getMessages();
        if (messages?.[threadId]?.length) {
          setMessages(messages[threadId] as any, true as any);
        }
      }
    })();
  }, [setThread, threadData, threadId]);

  if (!isLoaded) {
    return <Loading />;
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

  return (
    <>
      <Thread />
      <section className="flex flex-col justify-end">
        <div className="flex flex-col">
          {!textInput && IS_SPEECH_RECOGNITION_SUPPORTED() ? <Voice /> : <Text />}
        </div>
      </section>
    </>
  );
};

export default Home;

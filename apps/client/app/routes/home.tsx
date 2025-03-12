import { Suspense, useEffect } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useAuth, RedirectToSignIn } from '@clerk/react-router';

import { threadAtom, currentThreadIdAtom } from '@/store';
import { getThreads } from '@/utils/lforage';
import { chatSaveEffect, configAtom } from '@/store';
import Text from '@/components/Inputs/Text';
import Voice from '@/components/Inputs/Voice';
import Thread from '@/components/Thread';
import Loading from '@/loading';
import { IS_SPEECH_RECOGNITION_SUPPORTED } from '@/utils';

import type { Route } from './+types/home';

export const meta = ({}: Route.MetaArgs) => {
  return [
    { title: 'PolyChat - The AI Chat App' },
    { name: 'description', content: 'Welcome to PolyChat!' },
  ];
};

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const threads = await getThreads();
  const threadData = threads?.find(({ id }) => id === params.threadId);
  return { threadData };
}

const Home = ({ params, loaderData }: Route.ComponentProps) => {
  const { textInput } = useAtomValue(configAtom);
  const setCurrentThreadId = useSetAtom(currentThreadIdAtom);
  const setThread = useSetAtom(threadAtom);

  const { isSignedIn, isLoaded } = useAuth();

  const threadId = params.threadId;
  const { threadData } = loaderData;

  // Subscribe to chat side effects
  useAtom(chatSaveEffect);

  useEffect(() => {
    if (!threadId) return;

    if (threadData) {
      setCurrentThreadId(threadData.id);
      setThread(threadData.thread as any, true as any);
    }
  }, [setThread, setCurrentThreadId, threadId]);

  if (!isLoaded) {
    return <Loading />;
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

  return (
    <Suspense>
      <Thread />
      <section className="flex flex-col justify-end">
        <div className="flex flex-col">
          {!textInput && IS_SPEECH_RECOGNITION_SUPPORTED() ? <Voice /> : <Text />}
        </div>
      </section>
    </Suspense>
  );
};

export default Home;

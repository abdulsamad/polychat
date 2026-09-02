import { useCallback } from 'react';
import { getTime } from 'date-fns';
import { useAtomValue, useSetAtom } from 'jotai';
import { toast } from 'sonner';

import { threadAtom, threadLoadingAtom, upsertMessageAtom } from '@/store';

import useHandleChatResponse from './useHandleChatResponse';

const useSubmitMessage = () => {
  const thread = useAtomValue(threadAtom);
  const isChatLoading = useAtomValue(threadLoadingAtom);
  const addChat = useSetAtom(upsertMessageAtom);
  const setIsChatResponseLoading = useSetAtom(threadLoadingAtom);
  const { handleChatResponse } = useHandleChatResponse();

  const submitMessage = useCallback(
    (rawPrompt: string) => {
      const prompt = rawPrompt.trim();

      if (!thread) {
        toast.error('This chat is not ready yet.');
        return false;
      }

      if (!prompt || isChatLoading) return false;

      addChat({
        id: crypto.randomUUID(),
        role: 'user',
        content: prompt,
        metadata: {
          model: thread.settings.model,
          profile: null,
          timestamp: getTime(new Date()),
        },
        type: 'text',
      });

      setIsChatResponseLoading(true);

      void handleChatResponse({ prompt })
        .catch((error) => {
          console.error(error);
          toast.error('The message could not be sent.');
        })
        .finally(() => setIsChatResponseLoading(false));

      return true;
    },
    [addChat, handleChatResponse, isChatLoading, setIsChatResponseLoading, thread]
  );

  return { isChatLoading, submitMessage };
};

export default useSubmitMessage;

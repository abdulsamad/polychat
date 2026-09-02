import { useCallback } from 'react';
import { getTime } from 'date-fns';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { toast } from 'sonner';

import { chatAbortControllerAtom, threadAtom, threadLoadingAtom, upsertMessageAtom } from '@/store';

import useHandleChatResponse from './useHandleChatResponse';

const useSubmitMessage = () => {
  const thread = useAtomValue(threadAtom);
  const isChatLoading = useAtomValue(threadLoadingAtom);
  const addChat = useSetAtom(upsertMessageAtom);
  const setIsChatResponseLoading = useSetAtom(threadLoadingAtom);
  const [abortController, setAbortController] = useAtom(chatAbortControllerAtom);
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

      const controller = new AbortController();
      setAbortController(controller);
      setIsChatResponseLoading(true);

      void handleChatResponse({ prompt, signal: controller.signal })
        .catch((error) => {
          if (!controller.signal.aborted) {
            console.error(error);
            toast.error('The message could not be sent.');
          }
        })
        .finally(() => {
          setAbortController((currentController) =>
            currentController === controller ? null : currentController
          );
          setIsChatResponseLoading(false);
        });

      return true;
    },
    [
      addChat,
      handleChatResponse,
      isChatLoading,
      setAbortController,
      setIsChatResponseLoading,
      thread,
    ]
  );

  const stopChat = useCallback(() => {
    abortController?.abort();
  }, [abortController]);

  return { isChatLoading, submitMessage, stopChat };
};

export default useSubmitMessage;

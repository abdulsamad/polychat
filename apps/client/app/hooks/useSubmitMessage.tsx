import { useCallback } from 'react';
import { getTime } from 'date-fns';
import { useAtomValue, useSetAtom } from 'jotai';
import { toast } from 'sonner';

import {
  anyThreadLoadingAtom,
  finishThreadActivityAtom,
  messagesAtom,
  startThreadActivityAtom,
  threadAtom,
  threadLoadingAtom,
  upsertThreadMessageAtom,
} from '@/store';
import {
  registerThreadStream,
  unregisterThreadStream,
  abortThreadStream,
} from '@/utils/stream-registry';

import useHandleChatResponse from './useHandleChatResponse';

const useSubmitMessage = () => {
  const thread = useAtomValue(threadAtom);
  const isChatLoading = useAtomValue(threadLoadingAtom);
  const addThreadMessage = useSetAtom(upsertThreadMessageAtom);
  const startThreadActivity = useSetAtom(startThreadActivityAtom);
  const finishThreadActivity = useSetAtom(finishThreadActivityAtom);
  const messages = useAtomValue(messagesAtom);
  const isAnyChatLoading = useAtomValue(anyThreadLoadingAtom);
  const { handleChatResponse } = useHandleChatResponse();

  const submitMessage = useCallback(
    (rawPrompt: string) => {
      const prompt = rawPrompt.trim();

      if (!thread) {
        toast.error('This chat is not ready yet.');
        return false;
      }

      if (!prompt || isChatLoading || isAnyChatLoading) return false;

      const threadId = thread.id;
      const controller = new AbortController();
      if (!registerThreadStream(threadId, controller)) return false;

      addThreadMessage({
        threadId,
        message: {
          id: crypto.randomUUID(),
          role: 'user',
          content: prompt,
          metadata: {
            model: thread.settings.model,
            profile: null,
            timestamp: getTime(new Date()),
          },
          type: 'text',
        },
      });

      startThreadActivity(threadId);

      void handleChatResponse({
        prompt,
        signal: controller.signal,
        thread,
        messages,
      })
        .catch((error) => {
          if (!controller.signal.aborted) {
            console.error(error);
            toast.error('The message could not be sent.');
          }
        })
        .finally(() => {
          unregisterThreadStream(threadId, controller);
          finishThreadActivity(threadId);
        });

      return true;
    },
    [
      addThreadMessage,
      finishThreadActivity,
      handleChatResponse,
      isChatLoading,
      isAnyChatLoading,
      messages,
      startThreadActivity,
      thread,
    ]
  );

  const stopChat = useCallback(() => {
    if (thread) abortThreadStream(thread.id);
  }, [thread]);

  return { isChatLoading, isAnyChatLoading, submitMessage, stopChat };
};

export default useSubmitMessage;

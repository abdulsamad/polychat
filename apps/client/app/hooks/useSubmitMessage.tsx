import { useCallback } from 'react';
import { getTime } from 'date-fns';
import { useAtomValue, useSetAtom } from 'jotai';
import { useUser } from '@clerk/react-router';
import { toast } from 'sonner';

import {
  cancelQueuedChatJobAtom,
  configAtom,
  enqueueChatJobAtom,
  messagesAtom,
  threadAtom,
  threadLoadingAtom,
  threadQueuedJobAtom,
} from '@/store';
import { abortThreadStream } from '@/utils/chat-stream-registry';

const useSubmitMessage = () => {
  const thread = useAtomValue(threadAtom);
  const messages = useAtomValue(messagesAtom);
  const config = useAtomValue(configAtom);
  const isChatLoading = useAtomValue(threadLoadingAtom);
  const queuedJob = useAtomValue(threadQueuedJobAtom);
  const enqueueChatJob = useSetAtom(enqueueChatJobAtom);
  const cancelQueuedChatJob = useSetAtom(cancelQueuedChatJobAtom);
  const { user } = useUser();

  const submitMessage = useCallback(
    (rawPrompt: string) => {
      const prompt = rawPrompt.trim();

      if (!thread || !user?.id) {
        toast.error('This chat is not ready yet.');
        return false;
      }

      if (!prompt) return false;

      const id = crypto.randomUUID();
      const assistantMessageId = crypto.randomUUID();
      const createdAt = getTime(new Date());
      return enqueueChatJob({
        id,
        accountId: user.id,
        threadId: thread.id,
        prompt,
        userMessageId: id,
        assistantMessageId,
        thread,
        messages,
        config,
        createdAt,
      });
    },
    [config, enqueueChatJob, messages, thread, user?.id]
  );

  const stopChat = useCallback(() => {
    if (thread) abortThreadStream(thread.id);
  }, [thread]);

  const cancelQueuedMessage = useCallback(() => {
    if (!thread) return null;
    return cancelQueuedChatJob(thread.id);
  }, [cancelQueuedChatJob, thread]);

  return {
    isChatLoading,
    isQueued: Boolean(queuedJob),
    submitMessage,
    stopChat,
    cancelQueuedMessage,
  };
};

export default useSubmitMessage;

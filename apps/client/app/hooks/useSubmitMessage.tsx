import { useCallback } from 'react';
import { getTime } from 'date-fns';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { toast } from 'sonner';

import {
  activeChatJobAtom,
  configAtom,
  messagesAtom,
  queuedChatJobsAtom,
  removeThreadMessageAtom,
  threadAtom,
  threadLoadingAtom,
  threadQueuedJobAtom,
  upsertThreadMessageAtom,
} from '@/store';
import { abortThreadStream } from '@/utils/chat-stream-registry';

const useSubmitMessage = () => {
  const thread = useAtomValue(threadAtom);
  const messages = useAtomValue(messagesAtom);
  const config = useAtomValue(configAtom);
  const isChatLoading = useAtomValue(threadLoadingAtom);
  const queuedJob = useAtomValue(threadQueuedJobAtom);
  const activeJob = useAtomValue(activeChatJobAtom);
  const [, setQueuedJobs] = useAtom(queuedChatJobsAtom);
  const upsertThreadMessage = useSetAtom(upsertThreadMessageAtom);
  const removeThreadMessage = useSetAtom(removeThreadMessageAtom);

  const submitMessage = useCallback(
    (rawPrompt: string) => {
      const prompt = rawPrompt.trim();

      if (!thread) {
        toast.error('This chat is not ready yet.');
        return false;
      }

      if (!prompt || isChatLoading || queuedJob) return false;

      const id = crypto.randomUUID();
      const createdAt = getTime(new Date());
      upsertThreadMessage({
        threadId: thread.id,
        message: {
          id,
          role: 'user',
          content: prompt,
          metadata: {
            model: thread.settings.model,
            profile: null,
            timestamp: createdAt,
            requestId: id,
            requestState: activeJob ? 'queued' : 'streaming',
          },
          type: 'text',
        },
      });

      setQueuedJobs((current) => [
        ...current,
        {
          id,
          threadId: thread.id,
          prompt,
          userMessageId: id,
          thread,
          messages,
          config,
          createdAt,
        },
      ]);

      return true;
    },
    [activeJob, config, isChatLoading, messages, queuedJob, setQueuedJobs, thread, upsertThreadMessage]
  );

  const stopChat = useCallback(() => {
    if (thread) abortThreadStream(thread.id);
  }, [thread]);

  const cancelQueuedMessage = useCallback(() => {
    if (!queuedJob || !thread) return null;

    setQueuedJobs((current) => current.filter((job) => job.id !== queuedJob.id));
    removeThreadMessage({ threadId: thread.id, id: queuedJob.userMessageId });
    return queuedJob.prompt;
  }, [queuedJob, removeThreadMessage, setQueuedJobs, thread]);

  return { isChatLoading, isQueued: Boolean(queuedJob), submitMessage, stopChat, cancelQueuedMessage };
};

export default useSubmitMessage;

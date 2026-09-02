import { useEffect, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import {
  activeChatJobAtom,
  dequeueNextChatJobAtom,
  queuedChatJobsAtom,
  resetChatQueueAtom,
  threadChatErrorsAtom,
  threadAtom,
  upsertThreadMessageAtom,
  type ChatJob,
} from '@/store';
import {
  abortAllStreams,
  clearActiveStream,
  isDiscardedStream,
  registerActiveStream,
} from '@/utils/chat-stream-registry';
import useHandleChatResponse from '@/hooks/useHandleChatResponse';

const ChatQueueProvider = () => {
  const [activeJob, setActiveJob] = useAtom(activeChatJobAtom);
  const queuedJobs = useAtomValue(queuedChatJobsAtom);
  const dequeueNextChatJob = useSetAtom(dequeueNextChatJobAtom);
  const resetChatQueue = useSetAtom(resetChatQueueAtom);
  const setErrors = useSetAtom(threadChatErrorsAtom);
  const selectedThread = useAtomValue(threadAtom);
  const upsertThreadMessage = useSetAtom(upsertThreadMessageAtom);
  const { handleChatResponse } = useHandleChatResponse();
  const handleChatResponseRef = useRef(handleChatResponse);
  const selectedThreadIdRef = useRef(selectedThread?.id);

  selectedThreadIdRef.current = selectedThread?.id;

  useEffect(() => {
    handleChatResponseRef.current = handleChatResponse;
  }, [handleChatResponse]);

  useEffect(() => {
    if (activeJob || !queuedJobs.length) return;
    dequeueNextChatJob();
  }, [activeJob, dequeueNextChatJob, queuedJobs.length]);

  useEffect(() => {
    if (!activeJob) return;

    const job = activeJob as ChatJob;
    const controller = new AbortController();
    registerActiveStream(job.threadId, controller);

    upsertThreadMessage({
      threadId: job.threadId,
      message: {
        id: job.userMessageId,
        role: 'user',
        content: job.prompt,
        type: 'text',
        metadata: {
          model: job.thread.settings.model,
          profile: null,
          timestamp: job.createdAt,
          requestId: job.id,
          requestState: 'streaming',
        },
      },
    });

    void handleChatResponseRef
      .current({ job, signal: controller.signal })
      .then((result) => {
        if (isDiscardedStream(controller.signal)) return;
        if (result.status === 'discarded') return;

        if (result.status === 'failed') {
          if (selectedThreadIdRef.current !== job.threadId) {
            setErrors((current) => ({ ...current, [job.threadId]: result.error }));
          }
          upsertThreadMessage({
            threadId: job.threadId,
            message: {
              id: job.userMessageId,
              role: 'user',
              content: job.prompt,
              type: 'text',
              metadata: {
                model: job.thread.settings.model,
                profile: null,
                timestamp: job.createdAt,
                requestId: job.id,
                requestState: 'failed',
              },
            },
          });
          return;
        }

        upsertThreadMessage({
          threadId: job.threadId,
          message: {
            id: job.userMessageId,
            role: 'user',
            content: job.prompt,
            type: 'text',
            metadata: {
              model: job.thread.settings.model,
              profile: null,
              timestamp: job.createdAt,
              requestId: job.id,
            },
          },
        });
      })
      .finally(() => {
        clearActiveStream(controller);
        setActiveJob((current) => (current?.id === job.id ? null : current));
      });
  }, [activeJob, setActiveJob, setErrors, upsertThreadMessage]);

  useEffect(
    () => () => {
      abortAllStreams();
      resetChatQueue();
    },
    [resetChatQueue]
  );

  return null;
};

export default ChatQueueProvider;

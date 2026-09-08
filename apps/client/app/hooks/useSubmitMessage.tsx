import { useCallback } from 'react';
import { getTime } from 'date-fns';
import { useAtomValue, useSetAtom } from 'jotai';
import { useUser } from '@clerk/react-router';
import { toast } from 'sonner';

import {
  cancelQueuedChatJobAtom,
  clearThreadChatErrorAtom,
  configAtom,
  enqueueChatJobAtom,
  messagesAtom,
  threadAtom,
  threadLoadingAtom,
  threadQueuedJobAtom,
} from '@/store';
import type { ImageAttachment } from 'utils';
import { abortThreadStream } from '@/utils/chat-stream-registry';
import { getProviderKey, isProviderConfiguredSync } from '@/utils/byok-vault';
import { providerForModel } from '@/utils/byok-providers';
import { useByokModelAvailability } from './useByokModelAvailability';

const useSubmitMessage = () => {
  const thread = useAtomValue(threadAtom);
  const messages = useAtomValue(messagesAtom);
  const config = useAtomValue(configAtom);
  const isChatLoading = useAtomValue(threadLoadingAtom);
  const queuedJob = useAtomValue(threadQueuedJobAtom);
  const enqueueChatJob = useSetAtom(enqueueChatJobAtom);
  const cancelQueuedChatJob = useSetAtom(cancelQueuedChatJobAtom);
  const clearThreadChatError = useSetAtom(clearThreadChatErrorAtom);
  const { user } = useUser();
  const { findModel } = useByokModelAvailability();

  const submitMessage = useCallback(
    (rawPrompt: string, imageAttachments: ImageAttachment[] = []) => {
      const prompt = rawPrompt.trim();

      if (!thread || !user?.id) {
        toast.error('This chat is not ready yet.');
        return false;
      }

      if (!prompt && imageAttachments.length === 0) return false;

      if (imageAttachments.length > 0 && !findModel(thread.settings.model)?.supportsVision) {
        toast.error('This model does not support image input.');
        return false;
      }

      clearThreadChatError(thread.id);

      const provider = providerForModel(thread.settings.model, thread.settings.modelProvider);
      if (isProviderConfiguredSync(user.id, provider) && !getProviderKey(user.id, provider)) {
        toast.error(`Unlock your ${provider} BYOK vault key before chatting.`);
        return false;
      }

      const id = crypto.randomUUID();
      const assistantMessageId = crypto.randomUUID();
      const createdAt = getTime(new Date());
      return enqueueChatJob({
        id,
        accountId: user.id,
        threadId: thread.id,
        prompt,
        imageAttachments,
        userMessageId: id,
        assistantMessageId,
        thread,
        messages,
        config,
        createdAt,
      });
    },
    [clearThreadChatError, config, enqueueChatJob, findModel, messages, thread, user?.id]
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

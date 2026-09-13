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
  refreshThreadsAtom,
  threadAtom,
  threadLoadingAtom,
  threadQueuedJobAtom,
} from '@/store';
import type { ImageAttachment } from 'utils';
import { abortThreadStream } from '@/utils/chat-stream-registry';
import { getProviderKey, isProviderConfiguredSync } from '@/utils/byok-vault';
import { providerForModel } from '@/utils/byok-providers';
import { getAnonymousWorkspaceAccount, removeDemoThreads } from '@/utils/lforage';
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
  const refreshThreads = useSetAtom(refreshThreadsAtom);
  const { user } = useUser();
  const accountId = user?.id ?? getAnonymousWorkspaceAccount();
  const { findModel } = useByokModelAvailability();

  const submitMessage = useCallback(
    (rawPrompt: string, imageAttachments: ImageAttachment[] = []) => {
      const prompt = rawPrompt.trim();

      if (!thread) {
        toast.error('This chat is not ready yet.');
        return false;
      }

      if (!prompt && imageAttachments.length === 0) return false;

      const model = findModel(thread.settings.model);
      if (model?.type === 'video' && !getProviderKey(accountId, 'openrouter')) {
        toast.error('Video generation requires an OpenRouter BYOK key.');
        return false;
      }
      const hasUnsupportedAttachment = imageAttachments.some((attachment) =>
        attachment.mediaType.startsWith('image/') ? !model?.supportsVision : !model?.supportsFiles
      );
      if (hasUnsupportedAttachment) {
        toast.error('This model does not support one or more attached files.');
        return false;
      }

      clearThreadChatError(thread.id);

      const provider = providerForModel(thread.settings.model, thread.settings.modelProvider);
      if (isProviderConfiguredSync(accountId, provider) && !getProviderKey(accountId, provider)) {
        toast.error(`Unlock your ${provider} BYOK vault key before chatting.`);
        return false;
      }

      const id = crypto.randomUUID();
      const assistantMessageId = crypto.randomUUID();
      const createdAt = getTime(new Date());
      const accepted = enqueueChatJob({
        id,
        accountId,
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

      if (accepted) {
        void removeDemoThreads().then((removed) => {
          if (removed) refreshThreads();
        });
      }
      return accepted;
    },
    [accountId, clearThreadChatError, config, enqueueChatJob, findModel, messages, refreshThreads, thread]
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

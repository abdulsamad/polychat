import { useCallback, useMemo } from 'react';
import { getTime } from 'date-fns';
import { useAtomValue, useSetAtom } from 'jotai';
import { useUser } from '@clerk/react-router';
import { toast } from 'sonner';

import {
  cancelQueuedChatJobAtom,
  clearThreadChatErrorAtom,
  configAtom,
  enqueueChatJobAtom,
  enqueuePersistence,
  messagesAtom,
  refreshThreadsAtom,
  removeThreadMessageAtom,
  threadAtom,
  threadLoadingAtom,
  threadQueuedJobAtom,
} from '@/store';
import type { IMessage } from '@/store';
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
  const removeThreadMessage = useSetAtom(removeThreadMessageAtom);
  const { user } = useUser();
  const accountId = user?.id ?? getAnonymousWorkspaceAccount();
  const { findModel } = useByokModelAvailability();

  /** Validates and queues a prompt; `history` is the conversation the request continues. */
  const enqueuePrompt = useCallback(
    (rawPrompt: string, imageAttachments: ImageAttachment[], history: IMessage[]) => {
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
      if (model?.type === 'video' && model.videoCapabilities) {
        const capabilities = model.videoCapabilities;
        const settings = thread.settings.modelConfig;
        const unsupported =
          (settings.duration !== undefined &&
            capabilities.durations?.length &&
            !capabilities.durations.includes(settings.duration)) ||
          (settings.resolution &&
            capabilities.resolutions?.length &&
            !capabilities.resolutions.includes(settings.resolution)) ||
          (settings.aspectRatio &&
            capabilities.aspectRatios?.length &&
            !capabilities.aspectRatios.includes(settings.aspectRatio)) ||
          (settings.generateAudio && capabilities.generateAudio === false);
        if (unsupported) {
          toast.error(
            'This video model does not support the selected settings. Update duration, resolution, aspect ratio, or audio in thread settings.'
          );
          return false;
        }
      }
      const hasUnsupportedAttachment = imageAttachments.some((attachment) =>
        attachment.mediaType.startsWith('image/')
          ? model?.type === 'text'
            ? !model.supportsVision
            : !model?.supportsImageReferences
          : attachment.mediaType.startsWith('video/')
            ? model?.type !== 'video' || !model.supportsVideoReferences
            : model?.type !== 'text' || !model.supportsFiles
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
        messages: history,
        config,
        createdAt,
      });

      if (accepted) {
        void enqueuePersistence(removeDemoThreads).then((removed) => {
          if (removed) refreshThreads();
        });
      }
      return accepted;
    },
    [accountId, clearThreadChatError, config, enqueueChatJob, findModel, refreshThreads, thread]
  );

  const submitMessage = useCallback(
    (rawPrompt: string, imageAttachments: ImageAttachment[] = []) =>
      enqueuePrompt(rawPrompt, imageAttachments, messages),
    [enqueuePrompt, messages]
  );

  /** The latest user message, when its request failed or was interrupted by a reload. */
  const retryableMessage = useMemo(() => {
    const lastUserMessage = messages.filter(({ role }) => role === 'user').at(-1);
    const state = lastUserMessage?.metadata.requestState;
    return state === 'failed' || state === 'interrupted' ? lastUserMessage : undefined;
  }, [messages]);

  /**
   * Sends the failed prompt again with the thread's current settings. The failed message and any
   * partial reply are replaced only once the new request is queued, so a rejected retry keeps them.
   */
  const retryMessage = useCallback(() => {
    if (!thread || !retryableMessage) return false;

    const index = messages.indexOf(retryableMessage);
    const staleMessages = messages.slice(index);
    const accepted = enqueuePrompt(
      retryableMessage.content,
      retryableMessage.imageAttachments ?? [],
      messages.slice(0, index)
    );
    if (accepted) {
      staleMessages.forEach(({ id }) => removeThreadMessage({ threadId: thread.id, id }));
    }
    return accepted;
  }, [enqueuePrompt, messages, removeThreadMessage, retryableMessage, thread]);

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
    canRetry: Boolean(retryableMessage) && !isChatLoading && !queuedJob,
    retryableMessageId: retryableMessage?.id,
    retryMessage,
    stopChat,
    cancelQueuedMessage,
  };
};

export default useSubmitMessage;

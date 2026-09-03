import { useTransition } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { getTime } from 'date-fns';
import { useAuth, useUser } from '@clerk/react-router';
import { toast } from 'sonner';
import axios from 'axios';
import useSound from 'use-sound';

import { supportedImageModels } from 'utils';
import { providerForModel } from '@/utils/byok-providers';
import { getProviderKey, isProviderConfigured } from '@/utils/byok-vault';

import {
  type ChatJob,
  type IMessage,
  upsertThreadMessageAtom,
  userSettingsOpenAtom,
  userSettingsScrollTargetAtom,
} from '@/store';
import { ChatStreamPart, getGeneratedText, getGeneratedImage } from '@/utils/api-calls';
import { isDiscardedStream } from '@/utils/chat-stream-registry';
import { markStartedToastAsSeen } from '@/utils/lforage';
import { Button } from '@/components/ui/button';
import useSpeechSynthesis from './useSpeechSynthesis';

const STREAM_UPDATE_INTERVAL_MS = 60;

const showResponseErrorToast = (
  message: string,
  isSharedApiRequest: boolean,
  openSettings: () => void,
  status?: number
) => {
  const shouldSuggestByok =
    isSharedApiRequest &&
    (status === undefined || status === 404 || status === 429 || status >= 500);

  if (!shouldSuggestByok) {
    toast.error(message);
    return;
  }

  toast.error('The shared server is for testing only', {
    description: (
      <>
        [Testing only] {message} This server is not intended for general use. Use Bring Your Own Key
        (BYOK) in{' '}
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-inherit underline underline-offset-2"
          onClick={openSettings}>
          Settings
        </Button>{' '}
        to connect your own provider and continue with your own key.
      </>
    ),
    action: { label: 'Open settings', onClick: openSettings },
    duration: 12000,
  });
};

const showStartedToastOnce = async (openSettings: () => void) => {
  try {
    if (await markStartedToastAsSeen()) {
      toast.info('Did you know you can use your own API key?', {
        description: (
          <>
            Add a provider key in{' '}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-inherit underline underline-offset-2"
              onClick={openSettings}>
              Settings
            </Button>{' '}
            to use your own provider.
          </>
        ),
        action: { label: 'Open settings', onClick: openSettings },
        duration: 10000,
      });
    }
  } catch (error) {
    console.error('Failed to save started toast state', error);
  }
};

interface handleChatResponseProps {
  job: ChatJob;
  signal?: AbortSignal;
}

const useHandleChatResponse = () => {
  const upsertThreadMessage = useSetAtom(upsertThreadMessageAtom);
  const setSettingsOpen = useSetAtom(userSettingsOpenAtom);
  const setSettingsScrollTarget = useSetAtom(userSettingsScrollTargetAtom);
  const [isPending, startTransition] = useTransition();

  const { getToken } = useAuth();
  const { user } = useUser();
  const [play] = useSound('notification.mp3');
  const { speak } = useSpeechSynthesis();
  const openByokSettings = () => {
    setSettingsScrollTarget('byok');
    setSettingsOpen(true);
  };

  const handleChatResponse = async ({ job, signal }: handleChatResponseProps) => {
    const { prompt, thread, messages, config } = job;
    const { imageSize, language, quality, style } = config;
    const customInstructions = config.customInstructions || '';
    let isSharedApiRequest = true;

    try {
      if (user?.id !== job.accountId) return { status: 'discarded' as const };

      const provider = providerForModel(thread.settings.model, thread.settings.modelProvider);
      const apiKey = user?.id ? getProviderKey(user.id, provider) : undefined;
      const isImageModel = supportedImageModels.some(({ name }) => name === thread.settings.model);
      isSharedApiRequest = !apiKey;
      if (isImageModel && !apiKey) {
        isSharedApiRequest = false;
        throw new Error(`Add your ${provider} BYOK key before using this image model.`);
      }
      const hasConfiguredProvider = user?.id
        ? await isProviderConfigured(user.id, provider)
        : false;
      if (hasConfiguredProvider && !apiKey) {
        isSharedApiRequest = false;
        throw new Error(`Unlock your ${provider} BYOK vault key before chatting.`);
      }
      if (signal?.aborted) return { status: 'cancelled' as const };

      if (isImageModel) {
        const imageResponse = await getGeneratedImage({
          prompt,
          model: thread.settings.model,
          provider,
          size: imageSize,
          quality,
          style,
          getToken,
          apiKey,
          signal,
        });

        if (!('b64_json' in imageResponse)) {
          throw Object.assign(new Error(imageResponse.err), { status: imageResponse.status });
        }
        if (signal?.aborted) return { status: 'cancelled' as const };

        const { b64_json } = imageResponse;

        startTransition(() => {
          upsertThreadMessage({
            threadId: thread.id,
            message: {
              id: job.assistantMessageId,
              content: ``,
              image_url: {
                url: `data:image/png;base64,${b64_json}`,
                alt: prompt,
                size: imageSize,
              },
              role: 'assistant',
              type: 'image_url',
              metadata: {
                model: thread.settings.model,
                profile: thread.settings.profile,
                timestamp: getTime(new Date()),
                requestId: job.id,
              },
            },
          });
          // Haptic feedback and sound
          navigator.vibrate(100);
          play();
        });

        await showStartedToastOnce(openByokSettings);

        return { status: 'completed' as const };
      } else {
        const stream = await getGeneratedText({
          ...(thread.settings.conversationContextMode === 'multi-turn'
            ? {
                messages: [
                  ...messages
                    .filter(({ type }) => type === 'text')
                    .map(({ role, content }) => ({ role, content })),
                  { role: 'user', content: prompt },
                ] as Array<Pick<IMessage, 'role' | 'content'>>,
              }
            : { prompt }),
          model: thread.settings.model,
          provider,
          profile: thread.settings.profile,
          language,
          customInstructions: thread.settings.profile === 'custom' ? customInstructions : undefined,
          getToken,
          apiKey,
          signal,
        });

        if (!stream) throw new Error();

        // Handle error response
        if ('success' in stream && !stream.success) {
          throw Object.assign(new Error(stream.err), { status: stream.status });
        }

        const reader = (stream as ReadableStream<ChatStreamPart>).getReader();
        const timestamp = getTime(new Date());
        let content = '';
        let responseMetadata: Extract<ChatStreamPart, { type: 'metadata' }> | undefined;
        let updateTimeoutId: ReturnType<typeof setTimeout> | null = null;

        const saveAssistantMessage = (finishReason?: string, cancelled = false) => {
          if (isDiscardedStream(signal)) return;

          upsertThreadMessage({
            threadId: thread.id,
            message: {
              id: job.assistantMessageId,
              content,
              metadata: {
                model: thread.settings.model,
                profile: thread.settings.profile,
                timestamp,
                requestId: job.id,
                ...(responseMetadata
                  ? {
                      usage: responseMetadata.metadata.usage,
                      finishReason: responseMetadata.metadata.finishReason,
                      responseId: responseMetadata.metadata.responseId,
                      responseModelId: responseMetadata.metadata.modelId,
                      responseTimestamp: responseMetadata.metadata.timestamp,
                    }
                  : {}),
                ...(finishReason ? { finishReason } : {}),
                ...(cancelled ? { cancelled: true } : {}),
              },
              role: 'assistant',
              type: 'text',
            },
          });
        };

        const updateMessage = () => {
          updateTimeoutId = null;
          if (isDiscardedStream(signal)) return;

          startTransition(() => {
            upsertThreadMessage({
              threadId: thread.id,
              message: {
                id: job.assistantMessageId,
                content,
                metadata: {
                  model: thread.settings.model,
                  timestamp,
                  profile: thread.settings.profile,
                  requestId: job.id,
                },
                role: 'assistant',
                type: 'text',
              },
            });
          });
        };

        // Keep network chunks responsive without reparsing Markdown on every
        // chunk. The final update below always flushes the complete response.
        const scheduleMessageUpdate = () => {
          if (updateTimeoutId === null) {
            updateTimeoutId = setTimeout(updateMessage, STREAM_UPDATE_INTERVAL_MS);
          }
        };

        try {
          while (true) {
            const { value, done } = await reader.read();

            if (signal?.aborted) {
              if (updateTimeoutId !== null) {
                clearTimeout(updateTimeoutId);
                updateTimeoutId = null;
              }
              if (content || responseMetadata) saveAssistantMessage('stop', true);
              return { status: 'cancelled' as const };
            }

            // Stream is completed
            if (done) {
              if (updateTimeoutId !== null) {
                clearTimeout(updateTimeoutId);
                updateTimeoutId = null;
              }

              saveAssistantMessage();

              // Feedback
              navigator.vibrate(100);
              play();
              console.log('%cDONE', 'font-size:12px;font-weight:bold;color:aqua');
              if (thread.settings.isTextToSpeechEnabled) {
                speak(content, language);
              }
              await showStartedToastOnce(openByokSettings);
              break;
            }

            const part = value as ChatStreamPart;
            if (part.type === 'text') {
              content += part.text;
              scheduleMessageUpdate();
            } else if (part.type === 'metadata') {
              responseMetadata = part;
            } else {
              throw new Error(part.error);
            }
          }
        } catch (error) {
          if (updateTimeoutId !== null) {
            clearTimeout(updateTimeoutId);
            updateTimeoutId = null;
          }

          try {
            await reader.cancel();
          } catch {
            // The request may already have closed the reader while aborting.
          }

          if (!signal?.aborted) {
            if (content || responseMetadata) saveAssistantMessage('error');
            throw error;
          }

          // Keep the generated portion visible after Stop. If the provider
          // finished before the abort reached the stream, retain its usage
          // and response details as well.
          if (content || responseMetadata) saveAssistantMessage('stop', true);
        }

        return { status: signal?.aborted ? ('cancelled' as const) : ('completed' as const) };
      }
    } catch (err) {
      if (signal?.aborted) return { status: 'cancelled' as const };

      console.error(err);

      if (axios.isAxiosError(err)) {
        showResponseErrorToast(
          err.response?.data.err || err.message,
          isSharedApiRequest,
          openByokSettings,
          err.response?.status
        );
        return { status: 'failed' as const, error: err.response?.data.err || err.message };
      }

      if (err instanceof Error) {
        showResponseErrorToast(
          err.message || 'Something went Wrong!',
          isSharedApiRequest,
          openByokSettings,
          'status' in err && typeof err.status === 'number' ? err.status : undefined
        );
        return { status: 'failed' as const, error: err.message || 'Something went Wrong!' };
      }

      showResponseErrorToast('Something went Wrong!', isSharedApiRequest, openByokSettings);
      return { status: 'failed' as const, error: 'Something went Wrong!' };
    }
  };

  return { handleChatResponse, isPending };
};

export default useHandleChatResponse;

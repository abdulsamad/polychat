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
  threadAtom,
  messagesAtom,
  upsertMessageAtom,
  threadLoadingAtom,
  configAtom,
  IMessage,
  userSettingsOpenAtom,
  userSettingsScrollTargetAtom,
} from '@/store';
import { ChatStreamPart, getGeneratedText, getGeneratedImage } from '@/utils/api-calls';
import { markStartedToastAsSeen } from '@/utils/lforage';
import { Button } from '@/components/ui/button';
import useSpeechSynthesis from './useSpeechSynthesis';

const STREAM_UPDATE_INTERVAL_MS = 120;

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
  prompt: string;
  signal?: AbortSignal;
  onTextMessageComplete?: (content: string) => void;
  onImageMessageComplete?: () => void;
}

const useHandleChatResponse = () => {
  const config = useAtomValue(configAtom);
  const { imageSize, language, quality, style } = config;
  const customInstructions = config.customInstructions || '';
  const thread = useAtomValue(threadAtom);
  const messages = useAtomValue(messagesAtom);
  const upsertMessage = useSetAtom(upsertMessageAtom);
  const setIsChatResponseLoading = useSetAtom(threadLoadingAtom);
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

  const handleChatResponse = async ({
    prompt,
    signal,
    onTextMessageComplete,
    onImageMessageComplete,
  }: handleChatResponseProps) => {
    let isSharedApiRequest = true;

    try {
      if (!thread) throw new Error('Thread not created');
      const provider = providerForModel(thread.settings.model);
      const apiKey = user?.id ? getProviderKey(user.id, provider) : undefined;
      isSharedApiRequest = !apiKey;
      const hasConfiguredProvider = user?.id
        ? await isProviderConfigured(user.id, provider)
        : false;
      if (hasConfiguredProvider && !apiKey) {
        isSharedApiRequest = false;
        throw new Error(`Unlock your ${provider} BYOK vault key before chatting.`);
      }

      if (supportedImageModels.map(({ name }) => name).includes(thread.settings.model)) {
        const imageResponse = await getGeneratedImage({
          prompt,
          model: thread.settings.model,
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

        const { b64_json } = imageResponse;

        startTransition(() => {
          upsertMessage({
            id: crypto.randomUUID(),
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
            },
          });

          setIsChatResponseLoading(false);
          // Haptic feedback and sound
          navigator.vibrate(100);
          play();
        });

        await showStartedToastOnce(openByokSettings);

        if (onImageMessageComplete) onImageMessageComplete();
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
          profile: thread.settings.profile,
          language,
          customInstructions:
            thread.settings.profile === 'custom' ? customInstructions : undefined,
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
        const uid = crypto.randomUUID();
        const timestamp = getTime(new Date());
        let content = '';
        let responseMetadata: Extract<ChatStreamPart, { type: 'metadata' }> | undefined;
        let updateTimeoutId: ReturnType<typeof setTimeout> | null = null;

        const updateMessage = () => {
          updateTimeoutId = null;
          startTransition(() => {
            upsertMessage({
              id: uid,
              content,
              metadata: {
                model: thread.settings.model,
                timestamp,
                profile: thread.settings.profile,
              },
              role: 'assistant',
              type: 'text',
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

        while (true) {
          const { value, done } = await reader.read();

          // Stream is completed
          if (done) {
            if (updateTimeoutId !== null) {
              clearTimeout(updateTimeoutId);
              updateTimeoutId = null;
            }

            upsertMessage({
              id: uid,
              content,
              metadata: {
                model: thread.settings.model,
                profile: thread.settings.profile,
                timestamp,
                ...(responseMetadata && responseMetadata.type === 'metadata'
                  ? {
                      usage: responseMetadata.metadata.usage,
                      finishReason: responseMetadata.metadata.finishReason,
                      responseId: responseMetadata.metadata.responseId,
                      responseModelId: responseMetadata.metadata.modelId,
                      responseTimestamp: responseMetadata.metadata.timestamp,
                    }
                  : {}),
              },
              role: 'assistant',
              type: 'text',
            });

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

        if (onTextMessageComplete) onTextMessageComplete(content);
      }
    } catch (err) {
      if (signal?.aborted) return;

      console.error(err);

      if (axios.isAxiosError(err)) {
        return showResponseErrorToast(
          err.response?.data.err || err.message,
          isSharedApiRequest,
          openByokSettings,
          err.response?.status
        );
      }

      if (err instanceof Error) {
        return showResponseErrorToast(
          err.message || 'Something went Wrong!',
          isSharedApiRequest,
          openByokSettings,
          'status' in err && typeof err.status === 'number' ? err.status : undefined
        );
      }

      showResponseErrorToast('Something went Wrong!', isSharedApiRequest, openByokSettings);
    }
  };

  return { handleChatResponse, isPending };
};

export default useHandleChatResponse;

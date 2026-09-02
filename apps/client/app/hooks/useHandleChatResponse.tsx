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
} from '@/store';
import { ChatStreamPart, getGeneratedText, getGeneratedImage } from '@/utils/api-calls';
import { markStartedToastAsSeen } from '@/utils/lforage';
import useSpeechSynthesis from './useSpeechSynthesis';

const STREAM_UPDATE_INTERVAL_MS = 120;

const showResponseErrorToast = (
  message: string,
  isSharedApiRequest: boolean,
  openSettings: () => void
) => {
  if (!isSharedApiRequest) {
    toast.error(message);
    return;
  }

  toast.error('API request failed', {
    description: `[Testing only] ${message} Use your own key. It is encrypted locally and sent directly to the provider - never PolyChat.`,
    action: { label: 'Open settings', onClick: openSettings },
    duration: 12000,
  });
};

const showStartedToastOnce = async (openSettings: () => void) => {
  try {
    if (await markStartedToastAsSeen()) {
      toast.info('Use your own API key', {
        description: 'Open Settings from the sidebar to add a provider key for this browser.',
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
  const [isPending, startTransition] = useTransition();

  const { getToken } = useAuth();
  const { user } = useUser();
  const [play] = useSound('notification.mp3');
  const { speak } = useSpeechSynthesis();

  const handleChatResponse = async ({
    prompt,
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
        });

        if (!('b64_json' in imageResponse)) {
          throw new Error(imageResponse.err);
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
              variation: thread.settings.variation,
              timestamp: getTime(new Date()),
            },
          });

          setIsChatResponseLoading(false);
          // Haptic feedback and sound
          navigator.vibrate(100);
          play();
        });

        await showStartedToastOnce(() => setSettingsOpen(true));

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
          variation: thread.settings.variation,
          language,
          customInstructions:
            thread.settings.variation === 'custom' ? customInstructions : undefined,
          getToken,
          apiKey,
        });

        if (!stream) throw new Error();

        // Handle error response
        if ('success' in stream && !stream.success) {
          throw new Error(stream.err);
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
                variation: thread.settings.variation,
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

        // Close Loader
        startTransition(() => {
          setIsChatResponseLoading(false);
        });

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
                variation: thread.settings.variation,
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
            await showStartedToastOnce(() => setSettingsOpen(true));
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
      console.error(err);

      if (axios.isAxiosError(err)) {
        return showResponseErrorToast(
          err.response?.data.err || err.message,
          isSharedApiRequest,
          () => setSettingsOpen(true)
        );
      }

      if (err instanceof Error) {
        return showResponseErrorToast(
          err.message || 'Something went Wrong!',
          isSharedApiRequest,
          () => setSettingsOpen(true)
        );
      }

      showResponseErrorToast('Something went Wrong!', isSharedApiRequest, () =>
        setSettingsOpen(true)
      );
    }
  };

  return { handleChatResponse, isPending };
};

export default useHandleChatResponse;

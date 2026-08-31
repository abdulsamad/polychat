import { useTransition } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { getTime } from 'date-fns';
import { useAuth } from '@clerk/react-router';
import { toast } from 'sonner';
import axios from 'axios';
import useSound from 'use-sound';

import { supportedImageModels } from 'utils';

import {
  threadAtom,
  messagesAtom,
  upsertMessageAtom,
  threadLoadingAtom,
  configAtom,
  IMessage,
} from '@/store';
import { ChatStreamPart, getGeneratedText, getGeneratedImage } from '@/utils/api-calls';
import { markStartedToastAsSeen } from '@/utils/lforage';
import useSpeechSynthesis from './useSpeechSynthesis';

const STREAM_UPDATE_INTERVAL_MS = 80;

const showStartedToastOnce = async () => {
  try {
    if (await markStartedToastAsSeen()) {
      toast.success(`Cool! You've just got started`);
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
  const { imageSize, language, quality, style } = useAtomValue(configAtom);
  const thread = useAtomValue(threadAtom);
  const messages = useAtomValue(messagesAtom);
  const upsertMessage = useSetAtom(upsertMessageAtom);
  const setIsChatResponseLoading = useSetAtom(threadLoadingAtom);
  const [isPending, startTransition] = useTransition();

  const { getToken } = useAuth();
  const [play] = useSound('notification.mp3');
  const { speak } = useSpeechSynthesis();

  const handleChatResponse = async ({
    prompt,
    onTextMessageComplete,
    onImageMessageComplete,
  }: handleChatResponseProps) => {
    try {
      if (!thread) throw new Error('Thread not created');

      if (supportedImageModels.map(({ name }) => name).includes(thread.settings.model)) {
        const imageResponse = await getGeneratedImage({
          prompt,
          model: thread.settings.model,
          size: imageSize,
          quality,
          style,
          getToken,
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

        await showStartedToastOnce();

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
          getToken,
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
            await showStartedToastOnce();
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
        return toast.error(err.response?.data.err || err.message);
      }

      if (err instanceof Error) {
        return toast.error(err.message || 'Something went Wrong!');
      }

      toast.error('Something went Wrong!');
    }
  };

  return { handleChatResponse, isPending };
};

export default useHandleChatResponse;

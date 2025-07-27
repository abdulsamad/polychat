import { useTransition } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { getTime } from 'date-fns';
import { useAuth, useUser } from '@clerk/react-router';
import { toast } from 'sonner';
import axios from 'axios';
import { throttle } from 'es-toolkit';
import useSound from 'use-sound';

import { supportedImageModels } from 'utils';

import { threadAtom, messagesAtom, threadLoadingAtom, configAtom, IMessage } from '@/store';
import { getGeneratedText, getGeneratedImage } from '@/utils/api-calls';

const THROTTLE_UPDATE_TIME_MS = 750;

interface handleChatResponseProps {
  prompt: string;
  onTextMessageComplete?: (content: string) => void;
  onImageMessageComplete?: () => void;
}

const useHandleChatResponse = () => {
  const { imageSize, language, quality, style } = useAtomValue(configAtom);
  const thread = useAtomValue(threadAtom);
  const [messages, setMessages] = useAtom(messagesAtom);
  const setIsChatResponseLoading = useSetAtom(threadLoadingAtom);
  const [isPending, startTransition] = useTransition();

  const { user } = useUser();
  const { getToken } = useAuth();
  const [play] = useSound('notification.mp3');

  const handleChatResponse = async ({
    prompt,
    onTextMessageComplete,
    onImageMessageComplete,
  }: handleChatResponseProps) => {
    try {
      if (!thread) throw new Error('Thread not created');

      if (supportedImageModels.map(({ name }) => name).includes(thread.settings.model)) {
        const { b64_json, image } = await getGeneratedImage({
          prompt,
          model: thread.settings.model,
          size: imageSize,
          user,
          quality,
          style,
          getToken,
        });

        startTransition(() => {
          setMessages({
            id: crypto.randomUUID(),
            content: `data:image/png;base64,${b64_json}`,
            image_url: {
              url: `data:image/png;base64,${b64_json}`,
              alt: image.data[0]?.revised_prompt,
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

        if (onImageMessageComplete) onImageMessageComplete();
      } else {
        const stream = await getGeneratedText({
          ...(thread.settings.isContextAware
            ? {
                messages: [
                  ...messages.map(({ role, content }) => ({ role, content })),
                  { role: 'user', content: prompt },
                ] as Array<Pick<IMessage, 'role' | 'content'>>,
              }
            : { prompt }),
          model: thread.settings.model,
          variation: thread.settings.variation,
          language,
          user,
          getToken,
        });

        if (!stream) throw new Error();

        // Handle error response
        if ('success' in stream && !stream.success) {
          throw new Error(stream.err);
        }

        const reader = (stream as ReadableStream<string>).getReader();
        const uid = crypto.randomUUID();
        const timestamp = getTime(new Date());
        let content = '';

        // Create throttled update function
        const throttledUpdate = throttle((text: string) => {
          startTransition(() => {
            setMessages({
              id: uid,
              content: text,
              metadata: {
                model: thread.settings.model,
                timestamp,
                variation: thread.settings.variation,
              },
              role: 'assistant',
              type: 'text',
            });
          });
        }, THROTTLE_UPDATE_TIME_MS);

        // Close Loader
        startTransition(() => {
          setIsChatResponseLoading(false);
        });

        while (true) {
          const { value, done } = await reader.read();

          // Stream is completed
          if (done) {
            // Ensure final update is processed and cleanup
            throttledUpdate.flush();
            throttledUpdate.cancel();

            startTransition(() => {
              setMessages({
                id: uid,
                content,
                metadata: {
                  model: thread.settings.model,
                  variation: thread.settings.variation,
                  timestamp,
                },
                role: 'assistant',
                type: 'text',
              });

              // Feedback
              navigator.vibrate(100);
              play();
            });
            console.log('%cDONE', 'font-size:12px;font-weight:bold;color:aqua');
            break;
          }

          content += value;
          throttledUpdate(content);
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

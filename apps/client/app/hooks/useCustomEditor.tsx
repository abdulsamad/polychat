import { useCallback, useLayoutEffect, useTransition } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { getTime } from 'date-fns';
import { toast } from 'sonner';
import { useAuth, useUser } from '@clerk/react-router';
import axios from 'axios';
import useSound from 'use-sound';

import { supportedImageModels } from 'utils';

import { threadLoadingAtom, threadAtom, configAtom, editorAtom } from '@/store/index';
import { getGeneratedText, getGeneratedImage } from '@/utils/api-calls';

const extensions = [
  StarterKit.configure({
    history: false,
    heading: {
      levels: [1, 2, 3, 4, 5, 6],
      HTMLAttributes: {
        class: 'heading',
      },
    },
    paragraph: {
      HTMLAttributes: {
        class: 'paragraph',
      },
    },
  }),
  Placeholder.configure({
    placeholder: 'Ask any thing or discuss...',
  }),
];

const useCustomEditor = () => {
  const [editorState, setEditorState] = useAtom(editorAtom);
  const addChat = useSetAtom(threadAtom);
  const setIsChatResponseLoading = useSetAtom(threadLoadingAtom);
  const { variation, model, imageSize, language, quality, style } = useAtomValue(configAtom);
  const [isPending, startTransition] = useTransition();

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'w-full h-[50px] p-3 box-border' },
      handleDOMEvents: {
        keydown: (view, ev) => {
          if (ev.key.toLowerCase() === 'enter') {
            ev.preventDefault();

            // TODO: Fix directly accessing DOM
            document.getElementById('text-submit-btn')?.click();
          }
        },
      },
    },
    onUpdate({ editor }) {
      setEditorState(editor.getHTML());
    },
  });
  const { user } = useUser();
  const { getToken } = useAuth();
  // const [play] = useSound('notification.mp3');
  const play = () => null;

  useLayoutEffect(() => {
    if (!editor) return;

    const cursorPos = editor.state.selection.$head.pos;

    editor?.commands?.clearContent();
    editor?.commands.insertContent(editorState);

    // Reset cursor position after inserting content
    editor.chain().focus().setTextSelection(cursorPos).run();
  }, [editorState, editor]);

  const handleSubmit = useCallback(async () => {
    try {
      if (!editor?.getText()?.trim()) return null;

      addChat({
        id: crypto.randomUUID(),
        type: 'user',
        message: editor?.getText(),
        variation: null,
        timestamp: getTime(new Date()),
        format: 'text',
        model,
      });

      setIsChatResponseLoading(true);
      setEditorState('');

      if (supportedImageModels.map(({ name }) => name).includes(model)) {
        const { b64_json, image } = await getGeneratedImage({
          prompt: editor.getText(),
          size: imageSize,
          user,
          quality,
          style,
          getToken,
        });

        startTransition(() => {
          addChat({
            id: crypto.randomUUID(),
            type: 'assistant',
            image: {
              url: `data:image/png;base64,${b64_json}`,
              alt: image.data[0]?.revised_prompt,
            },
            variation,
            timestamp: getTime(new Date()),
            format: 'image',
            size: imageSize,
            model,
          });

          setIsChatResponseLoading(false);
          // Haptic feedback and sound
          navigator.vibrate(100);
          play();
        });
      } else {
        const stream = await getGeneratedText({
          prompt: editor.getText(),
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

        // Close Loader
        startTransition(() => {
          setIsChatResponseLoading(false);
        });

        while (true) {
          const { value, done } = await reader.read();

          if (done) {
            // Stream is completed
            navigator.vibrate(100);
            play();
            startTransition(() => {
              addChat({
                id: uid,
                type: 'assistant',
                message: content,
                variation,
                timestamp,
                format: 'text',
                model,
              });
            });
            console.log('%cDONE', 'font-size:12px;font-weight:bold;color:aqua');
            break;
          }

          content += value;

          // Update chat with accumulated content on each chunk
          startTransition(() => {
            addChat({
              id: uid,
              type: 'assistant',
              message: content,
              variation,
              timestamp,
              format: 'text',
              model,
            });
          });
        }
      }

      return true;
    } catch (err) {
      console.error(err);

      if (axios.isAxiosError(err)) {
        return toast.error(err.response?.data.err);
      }

      toast.error('Something went Wrong!');
    } finally {
      setIsChatResponseLoading(false);
    }
  }, [
    editor,
    addChat,
    model,
    setIsChatResponseLoading,
    setEditorState,
    imageSize,
    user,
    quality,
    style,
    variation,
    play,
    language,
  ]);

  return { editor, handleSubmit };
};

export default useCustomEditor;

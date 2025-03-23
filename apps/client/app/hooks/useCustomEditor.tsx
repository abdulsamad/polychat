import { useCallback, useLayoutEffect } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { getTime } from 'date-fns';
import { toast } from 'sonner';
import { useUser } from '@clerk/react-router';

import { threadLoadingAtom, threadAtom, messagesAtom, configAtom, editorAtom } from '@/store/index';

import useHandleChatResponse from './useHandleChatResponse';

const extensions = [
  StarterKit.configure({
    history: false,
    heading: { levels: [1, 2, 3, 4, 5, 6], HTMLAttributes: { class: 'heading' } },
    paragraph: { HTMLAttributes: { class: 'paragraph' } },
  }),
  Placeholder.configure({ placeholder: 'Ask any thing or discuss...' }),
];

const useCustomEditor = () => {
  const [editorState, setEditorState] = useAtom(editorAtom);
  const [isChatLoading, setIsChatResponseLoading] = useAtom(threadLoadingAtom);
  const addChat = useSetAtom(messagesAtom);
  const thread = useAtomValue(threadAtom);
  const { imageSize, language, quality, style } = useAtomValue(configAtom);

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'w-full h-[50px] p-3 box-border' },
      handleDOMEvents: {
        keydown: (view, ev) => {
          switch (ev.key?.toLowerCase()) {
            case 'enter':
              {
                if (!ev.ctrlKey && !ev.shiftKey && !ev.altKey) {
                  ev.preventDefault();

                  if (isChatLoading) return;

                  handleSubmit();
                }
              }
              break;

            case 'arrowup': {
              //
              break;
            }
          }
        },
      },
    },
    onUpdate({ editor }) {
      setEditorState(editor.getHTML());
    },
  });
  const { user } = useUser();
  const { handleChatResponse } = useHandleChatResponse();

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
      if (!thread) throw new Error('Thread not created');

      if (!editor?.getText()?.trim()) return null;

      addChat({
        id: crypto.randomUUID(),
        role: 'user',
        content: editor?.getText(),
        metadata: {
          model: thread.settings.model,
          variation: null,
          timestamp: getTime(new Date()),
        },
        type: 'text',
      });

      setIsChatResponseLoading(true);
      setEditorState('');

      await handleChatResponse({
        prompt: editor.getText(),
      });

      return true;
    } catch (err) {
      toast.error('Something went Wrong!');
    } finally {
      setIsChatResponseLoading(false);
    }
  }, [
    editor,
    addChat,
    setIsChatResponseLoading,
    setEditorState,
    imageSize,
    user,
    quality,
    style,
    language,
    thread?.settings,
  ]);

  return { editor, handleSubmit };
};

export default useCustomEditor;

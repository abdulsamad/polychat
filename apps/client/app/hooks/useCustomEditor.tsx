import { useCallback, useEffect } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { useAtom } from 'jotai';

import { editorAtom } from '@/store/index';

import useSubmitMessage from './useSubmitMessage';

const extensions = [
  StarterKit.configure({
    undoRedo: false,
    heading: { levels: [1, 2, 3, 4, 5, 6], HTMLAttributes: { class: 'heading' } },
    paragraph: { HTMLAttributes: { class: 'paragraph' } },
  }),
  Placeholder.configure({ placeholder: 'Ask anything or start a conversation...' }),
];

const useCustomEditor = () => {
  const [editorState, setEditorState] = useAtom(editorAtom);
  const { isChatLoading, submitMessage, stopChat } = useSubmitMessage();

  const editor = useEditor({
    extensions,
    content: editorState,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        'aria-label': 'Message',
        'aria-describedby': 'composer-help',
        'aria-multiline': 'true',
        class: 'composer-editor',
        role: 'textbox',
      },
      handleDOMEvents: {
        keydown: (_view, event) => {
          const shouldSubmit =
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.ctrlKey &&
            !event.altKey &&
            !event.metaKey &&
            !event.isComposing;

          if (!shouldSubmit) return false;

          event.preventDefault();

          if (!isChatLoading) void handleSubmit();

          return true;
        },
      },
    },
    onUpdate({ editor }) {
      setEditorState(editor.getHTML());
    },
  });

  const handleSubmit = useCallback(async () => {
    if (!editor) return false;

    const prompt = editor.getText({ blockSeparator: '\n' }).trim();
    if (!prompt) return false;

    const didSubmit = submitMessage(prompt);
    if (!didSubmit) return false;

    editor.commands.clearContent(true);
    setEditorState('');
    editor.commands.focus('end');

    return true;
  }, [editor, setEditorState, submitMessage]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const currentContent = editor.isEmpty ? '' : editor.getHTML();
    if (currentContent === editorState) return;

    editor.commands.setContent(editorState, { emitUpdate: false });
    editor.commands.focus('end');
  }, [editor, editorState]);

  return { editor, handleSubmit, isChatLoading, stopChat };
};

export default useCustomEditor;

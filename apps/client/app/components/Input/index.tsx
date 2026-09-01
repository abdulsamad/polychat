import { EditorContent, useEditorState } from '@tiptap/react';
import { SendHorizonal, VolumeX } from 'lucide-react';
import { useAtomValue } from 'jotai';

import useCustomTiptapEditor from '@/hooks/useCustomEditor';
import { IS_SPEECH_RECOGNITION_SUPPORTED } from '@/utils';
import { speechPlaybackAtom } from '@/store';
import useSpeechSynthesis from '@/hooks/useSpeechSynthesis';
import Voice from '@/components/Input/Voice';
import { Button } from '@/components/ui/button';

const Text = () => {
  const { editor, handleSubmit, isChatLoading } = useCustomTiptapEditor();
  const isSpeaking = useAtomValue(speechPlaybackAtom);
  const { cancel } = useSpeechSynthesis();
  const hasText = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => Boolean(currentEditor?.getText().trim()),
  });

  return (
    <form
      className="composer-shell flex min-w-0 items-end gap-2 rounded-[1.4rem] border border-input bg-card/95 p-1.5 shadow-[0_12px_36px_hsl(var(--foreground)/0.08)] transition-[border-color,box-shadow] focus-within:border-ring focus-within:shadow-[0_0_0_3px_hsl(var(--ring)/0.18)] sm:gap-3 sm:p-2"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}>
      <EditorContent editor={editor} className="min-w-0 flex-1" />
      <div className="flex shrink-0 items-center pb-0.5">
        {isSpeaking && (
          <Button
            type="button"
            variant="secondary"
            title="Stop speaking"
            aria-label="Stop speaking"
            className="mr-1 h-10 rounded-full px-3 sm:h-11"
            onClick={cancel}>
            <VolumeX className="size-4 sm:mr-1.5" />
            <span className="hidden text-xs sm:inline">Stop speaking</span>
          </Button>
        )}
        {!hasText && IS_SPEECH_RECOGNITION_SUPPORTED() ? (
          <Voice />
        ) : (
          <Button
            id="text-submit-btn"
            type="submit"
            title="Send message"
            className="size-10 rounded-full bg-primary p-0 text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground hover:shadow-lg sm:size-11"
            disabled={!hasText || isChatLoading}>
            <SendHorizonal className="size-4" />
            <span className="sr-only">Send message</span>
          </Button>
        )}
      </div>
      <p id="composer-help" className="sr-only">
        Press Enter to send. Press Shift and Enter for a new line.
      </p>
    </form>
  );
};

export default Text;

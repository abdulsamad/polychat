import { EditorContent, useEditorState } from '@tiptap/react';
import { SendHorizonal, Square, VolumeX, XIcon } from 'lucide-react';
import { useAtomValue } from 'jotai';

import useCustomTiptapEditor from '@/hooks/useCustomEditor';
import { IS_SPEECH_RECOGNITION_SUPPORTED } from '@/utils';
import { speechPlaybackAtom } from '@/store';
import useSpeechSynthesis from '@/hooks/useSpeechSynthesis';
import Voice from '@/components/Input/Voice';
import { Button } from '@/components/ui/button';

const Text = () => {
  const { editor, handleSubmit, isChatLoading, isQueued, stopChat, cancelQueued } =
    useCustomTiptapEditor();
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
        {isChatLoading ? (
          // Cancels the active frontend AbortController and closes the frontend stream while
          // keeping any partial response visible. The Pages proxy can close its upstream fetch,
          // but AWS Lambda/provider work may continue because disconnects do not cancel Lambda.
          // This is a current limitation to revisit when cooperative server-side cancellation
          // is added.
          <Button
            id="text-stop-btn"
            type="button"
            title="Stop generating"
            aria-label="Stop generating"
            className="size-10 rounded-full border border-destructive/30 bg-destructive/15 p-0 text-destructive shadow-sm hover:bg-destructive/25 focus-visible:ring-destructive/30 sm:size-11"
            onClick={stopChat}>
            <Square className="size-4 fill-current" />
            <span className="sr-only">Stop generating</span>
          </Button>
        ) : isQueued ? (
          <Button
            type="button"
            title="Cancel queued message"
            aria-label="Cancel queued message"
            className="size-10 rounded-full border border-muted-foreground/30 bg-muted p-0 sm:size-11"
            onClick={(event) => {
              event.preventDefault();
              cancelQueued();
            }}>
            <XIcon className="size-4" />
            <span className="sr-only">Cancel queued message</span>
          </Button>
        ) : !hasText && IS_SPEECH_RECOGNITION_SUPPORTED() ? (
          <Voice />
        ) : (
          <Button
            id="text-submit-btn"
            type="submit"
            title="Send message"
            className="size-10 rounded-full bg-primary p-0 text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground hover:shadow-lg sm:size-11"
            disabled={!hasText}>
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

import { useLayoutEffect, useRef, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { SendHorizonalIcon, SquareIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/** Mirrors the server-side prompt limit in `chatRequestSchema`. */
const MAX_PROMPT_LENGTH = 32_000;

interface CompareComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isRunning: boolean;
  canSubmit: boolean;
  disabledReason?: string;
  children?: ReactNode;
}

const CompareComposer = ({
  value,
  onChange,
  onSubmit,
  onStop,
  isRunning,
  canSubmit,
  disabledReason,
  children,
}: CompareComposerProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the content; CSS caps it at 4 lines on mobile and 6 lines on larger screens.
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  const submit = () => {
    if (!isRunning && canSubmit) onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter submits, Shift+Enter inserts a newline, IME composition never submits.
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.nativeEvent.isComposing ||
      event.keyCode === 229
    ) {
      return;
    }
    event.preventDefault();
    submit();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Compare prompt"
      className="flex min-w-0 flex-col gap-2 rounded-[1.4rem] border border-input bg-card/95 p-2 shadow-[0_12px_36px_hsl(var(--foreground)/0.08)] transition-[border-color,box-shadow] focus-within:border-ring focus-within:shadow-[0_0_0_3px_hsl(var(--ring)/0.18)] motion-reduce:transition-none">
      {children}
      <div className="flex min-w-0 items-end gap-2">
        <Textarea
          ref={textareaRef}
          rows={1}
          value={value}
          maxLength={MAX_PROMPT_LENGTH}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask every model the same question..."
          aria-label="Prompt"
          aria-describedby="compare-composer-help"
          enterKeyHint="send"
          className="max-h-[calc(4*1.5rem+1rem)] min-h-10 min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-3 py-2 leading-6 shadow-none focus-visible:ring-0 sm:max-h-[calc(6*1.5rem+1rem)]"
        />
        {isRunning ? (
          <Button
            type="button"
            onClick={onStop}
            className="size-10 shrink-0 rounded-full border border-destructive/30 bg-destructive/15 p-0 text-destructive shadow-sm hover:bg-destructive/25 focus-visible:ring-destructive/30 sm:size-11">
            <SquareIcon className="size-4 fill-current" />
            <span className="sr-only">Stop all models</span>
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={!canSubmit}
            title={disabledReason}
            className="size-10 shrink-0 rounded-full p-0 shadow-sm hover:shadow-lg sm:size-11">
            <SendHorizonalIcon className="size-4" />
            <span className="sr-only">Compare answers</span>
          </Button>
        )}
      </div>
      <p id="compare-composer-help" className="sr-only">
        Press Enter to compare. Press Shift and Enter for a new line.
        {disabledReason ? ` ${disabledReason}` : ''}
      </p>
    </form>
  );
};

export default CompareComposer;

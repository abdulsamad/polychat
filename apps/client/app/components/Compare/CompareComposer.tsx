import { useLayoutEffect, useRef, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import {
  CornerDownRightIcon,
  ImagePlusIcon,
  SendHorizonalIcon,
  SquareIcon,
  XIcon,
} from 'lucide-react';

import type { ImageAttachment } from 'utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export const COMPARE_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif';

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
  images: readonly ImageAttachment[];
  /** Images can only be attached when every model in the run accepts them. */
  canAttachImages: boolean;
  attachImagesHint: string;
  onAddImages: (files: FileList) => void;
  onRemoveImage: (id: string) => void;
  /** Present when the shown run can be continued. */
  followUp?: {
    isActive: boolean;
    parentPrompt: string;
    onToggle: () => void;
  };
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
  images,
  canAttachImages,
  attachImagesHint,
  onAddImages,
  onRemoveImage,
  followUp,
}: CompareComposerProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFollowingUp = Boolean(followUp?.isActive);

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
      {followUp && (
        <div className="flex min-w-0 items-center gap-2 px-1 duration-150 ease-[var(--ease-out)] animate-in fade-in-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isFollowingUp}
            disabled={isRunning}
            className={
              isFollowingUp
                ? 'h-8 shrink-0 gap-1.5 rounded-full bg-accent px-3 text-accent-foreground hover:bg-accent hover:text-accent-foreground'
                : 'h-8 shrink-0 gap-1.5 rounded-full px-3 text-muted-foreground hover:text-foreground'
            }
            onClick={followUp.onToggle}>
            <CornerDownRightIcon />
            Follow up
          </Button>
          <p
            className="min-w-0 truncate text-xs text-muted-foreground"
            title={followUp.parentPrompt}>
            {isFollowingUp
              ? `Continuing each model's answer to "${followUp.parentPrompt}"`
              : 'Send a new comparison, or follow up on this one.'}
          </p>
        </div>
      )}
      {images.length > 0 && (
        <ul aria-label="Attached images" className="flex min-w-0 gap-2 overflow-x-auto px-1 pt-1">
          {images.map((image) => (
            <li
              key={image.id}
              className="composer-attachment-entry relative size-14 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-muted">
              <img src={image.dataUrl} alt={image.name} className="size-full object-cover" />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                aria-label={`Remove ${image.name}`}
                className="absolute top-0.5 right-0.5 size-6 rounded-full p-0 shadow-sm [&_svg]:size-3"
                onClick={() => onRemoveImage(image.id)}>
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex min-w-0 items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept={COMPARE_IMAGE_TYPES}
          multiple
          hidden
          tabIndex={-1}
          onChange={(event) => {
            if (event.target.files?.length) onAddImages(event.target.files);
            event.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!canAttachImages}
          title={attachImagesHint}
          aria-label={`Attach images. ${attachImagesHint}`}
          className="size-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground sm:size-11"
          onClick={() => fileInputRef.current?.click()}>
          <ImagePlusIcon className="size-4" />
        </Button>
        <Textarea
          ref={textareaRef}
          rows={1}
          value={value}
          maxLength={MAX_PROMPT_LENGTH}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isFollowingUp ? 'Follow up with every model...' : 'Ask every model the same question...'
          }
          aria-label={isFollowingUp ? 'Follow-up prompt' : 'Prompt'}
          aria-describedby="compare-composer-help"
          enterKeyHint="send"
          className="max-h-[calc(4*1.5rem+1rem)] min-h-10 min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-3 py-2 leading-6 shadow-none focus-visible:ring-0 sm:max-h-[calc(6*1.5rem+1rem)]"
        />
        {/* Distinct keys keep Stop and Send separate elements. Reusing one <button> lets the
            Stop click, once the run ends mid-click, finish as a submit and start a new run. */}
        {isRunning ? (
          <Button
            key="stop"
            type="button"
            onClick={onStop}
            className="size-10 shrink-0 rounded-full border border-destructive/30 bg-destructive/15 p-0 text-destructive shadow-sm duration-150 ease-[var(--ease-out)] animate-in fade-in-0 hover:bg-destructive/25 focus-visible:ring-destructive/30 motion-safe:zoom-in-90 sm:size-11">
            <SquareIcon className="size-4 fill-current" />
            <span className="sr-only">Stop all models</span>
          </Button>
        ) : (
          <Button
            key="send"
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

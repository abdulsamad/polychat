import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, useEditorState } from '@tiptap/react';
import {
  BanIcon,
  ImagePlus,
  SendHorizonal,
  Square,
  UploadIcon,
  VolumeX,
  XIcon,
} from 'lucide-react';
import { useAtomValue } from 'jotai';
import clsx from 'clsx';

import useCustomTiptapEditor from '@/hooks/useCustomEditor';
import { IS_SPEECH_RECOGNITION_SUPPORTED } from '@/utils';
import { speechPlaybackAtom } from '@/store';
import useSpeechSynthesis from '@/hooks/useSpeechSynthesis';
import Voice from '@/components/Input/Voice';
import { Button } from '@/components/ui/button';
import ImageAttachment from '@/components/Message/ImageAttachment';

type DragState = 'idle' | 'accept' | 'reject';

// Enter eases out at 200ms, leave is quicker at 150ms. Transitions (not keyframes) so a
// drag that enters and leaves rapidly retargets from the current value instead of restarting.
const dropEase =
  'ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transform-none motion-reduce:duration-150';

// Covers the whole content area (everything but the sidebar). The dim scrim focuses the
// task, the dashed outline marks the target, and the pile of sheets fans out as the hint
// that files are about to land.
const DropOverlay = ({ state, hint }: { state: DragState; hint: string }) => {
  const isActive = state !== 'idle';
  const isReject = state === 'reject';
  const visible = isActive ? 'opacity-100 duration-200' : 'opacity-0 duration-150';

  return (
    <>
      <div
        aria-hidden="true"
        className={clsx(
          'pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-background/70 backdrop-blur-sm transition-opacity [@media(prefers-reduced-transparency:reduce)]:bg-background/95 [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none',
          dropEase,
          visible
        )}>
        <div
          className={clsx(
            'absolute inset-3 rounded-[1.75rem] border-2 border-dashed transition-[opacity,transform] sm:inset-4',
            dropEase,
            isReject ? 'border-destructive/50' : 'border-ring/60',
            isActive ? 'scale-100 opacity-100 duration-200' : 'scale-[0.985] opacity-0 duration-150'
          )}
        />
        <div
          className={clsx(
            'flex flex-col items-center gap-5 transition-[opacity,transform]',
            dropEase,
            isActive
              ? 'translate-y-0 scale-100 opacity-100 delay-[40ms] duration-200'
              : 'translate-y-2 scale-95 opacity-0 duration-150'
          )}>
          <div className="relative size-20">
            {[-1, 1].map((side) => (
              <span
                key={side}
                className={clsx(
                  'absolute inset-0 rounded-2xl border border-border bg-card shadow-sm transition-transform',
                  dropEase,
                  isActive && !isReject
                    ? 'delay-[60ms] duration-200'
                    : 'duration-150 motion-reduce:rotate-0',
                  isActive && !isReject
                    ? side < 0
                      ? '-translate-x-4 -rotate-[9deg]'
                      : 'translate-x-4 rotate-[9deg]'
                    : 'scale-90'
                )}
              />
            ))}
            <span
              className={clsx(
                'absolute inset-0 flex items-center justify-center rounded-2xl border shadow-md',
                isReject
                  ? 'border-destructive/40 bg-card text-destructive'
                  : 'border-border bg-card text-foreground'
              )}>
              {isReject ? (
                <BanIcon className="size-8" aria-hidden="true" />
              ) : (
                <UploadIcon className="size-8" aria-hidden="true" />
              )}
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5 text-center">
            <span
              className={clsx(
                'text-base font-semibold tracking-tight',
                isReject ? 'text-destructive' : 'text-foreground'
              )}>
              {isReject ? 'This model cannot take files' : 'Drop to attach'}
            </span>
            {!isReject && hint && <span className="text-sm text-muted-foreground">{hint}</span>}
          </div>
        </div>
      </div>
      <p role="status" className="sr-only">
        {isActive ? (isReject ? 'This model cannot take files' : 'Drop files to attach') : ''}
      </p>
    </>
  );
};

const Text = () => {
  const {
    editor,
    handleSubmit,
    isChatLoading,
    isQueued,
    stopChat,
    cancelQueued,
    imageAttachments,
    canAttachImages,
    canAttachVideos,
    canAttachFiles,
    addImageFiles,
    removeImageAttachment,
  } = useCustomTiptapEditor();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dragDepth = useRef(0);
  const [dropZone, setDropZone] = useState<HTMLElement | null>(null);
  // 'accept' when the model takes files, 'reject' when it does not.
  const [dragState, setDragState] = useState<DragState>('idle');
  const canAttach = canAttachImages || canAttachVideos || canAttachFiles;
  const dropHint = [
    canAttachImages && 'images',
    canAttachVideos && 'videos',
    canAttachFiles && 'documents',
  ]
    .filter(Boolean)
    .join(', ');
  const isSpeaking = useAtomValue(speechPlaybackAtom);
  const { cancel } = useSpeechSynthesis();
  const hasText = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => Boolean(currentEditor?.getText().trim()),
  });

  // The whole content area (not just the composer) accepts drops. Depth counting survives
  // dragenter/dragleave firing for every child element crossed.
  useEffect(() => {
    const zone = formRef.current?.closest<HTMLElement>('[data-drop-zone]') ?? null;
    setDropZone(zone);
    if (!zone) return;

    const isFileDrag = (event: DragEvent) => Boolean(event.dataTransfer?.types.includes('Files'));
    const reset = () => {
      dragDepth.current = 0;
      setDragState('idle');
    };

    const onEnter = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      dragDepth.current += 1;
      setDragState(canAttach ? 'accept' : 'reject');
    };
    const onOver = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = canAttach ? 'copy' : 'none';
    };
    const onLeave = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragState('idle');
    };
    const onDrop = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      reset();
      if (!canAttach || !event.dataTransfer?.files.length) return;
      // Haptic lands on the same frame as the overlay starting to leave.
      navigator.vibrate?.(10);
      void addImageFiles(event.dataTransfer.files);
    };
    zone.addEventListener('dragenter', onEnter);
    zone.addEventListener('dragover', onOver);
    zone.addEventListener('dragleave', onLeave);
    zone.addEventListener('drop', onDrop);
    window.addEventListener('dragend', reset);
    return () => {
      zone.removeEventListener('dragenter', onEnter);
      zone.removeEventListener('dragover', onOver);
      zone.removeEventListener('dragleave', onLeave);
      zone.removeEventListener('drop', onDrop);
      window.removeEventListener('dragend', reset);
    };
  }, [addImageFiles, canAttach]);

  return (
    <>
      <form
        ref={formRef}
        className="composer-shell flex min-w-0 flex-col gap-1.5 rounded-[1.4rem] border border-input bg-card/95 p-1.5 shadow-[0_12px_36px_hsl(var(--foreground)/0.08)] transition-[border-color,box-shadow] focus-within:border-ring focus-within:shadow-[0_0_0_3px_hsl(var(--ring)/0.18)] sm:gap-2 sm:p-2"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}>
        <div className="flex min-w-0 items-end gap-2 sm:gap-3">
          {canAttach && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={`${canAttachImages ? 'image/jpeg,image/png,image/webp,image/gif,' : ''}${canAttachVideos ? 'video/mp4,video/webm,' : ''}${canAttachFiles ? 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,application/json' : ''}`}
                multiple
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => {
                  if (event.target.files) void addImageFiles(event.target.files);
                  event.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="ghost"
                title="Attach files"
                aria-label="Attach files"
                className="size-10 shrink-0 rounded-full p-0 sm:size-11"
                onClick={() => fileInputRef.current?.click()}>
                <ImagePlus className="size-5" />
              </Button>
            </>
          )}
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
            ) : !hasText && imageAttachments.length === 0 && IS_SPEECH_RECOGNITION_SUPPORTED() ? (
              <Voice />
            ) : (
              <Button
                id="text-submit-btn"
                type="submit"
                title="Send message"
                className="size-10 rounded-full bg-primary p-0 text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground hover:shadow-lg sm:size-11"
                disabled={!hasText && imageAttachments.length === 0}>
                <SendHorizonal className="size-4" />
                <span className="sr-only">Send message</span>
              </Button>
            )}
          </div>
        </div>
        {imageAttachments.length > 0 && (
          <ul className="flex min-w-0 flex-wrap gap-2 px-1 pb-0.5" aria-label="Attached images">
            {imageAttachments.map((attachment) => (
              <li key={attachment.id} className="composer-attachment-entry min-w-0 max-w-full">
                <ImageAttachment
                  attachment={attachment}
                  compact
                  onRemove={() => removeImageAttachment(attachment.id)}
                />
              </li>
            ))}
          </ul>
        )}
        <p id="composer-help" className="sr-only">
          Press Enter to send. Press Shift and Enter for a new line.
        </p>
      </form>
      {dropZone && createPortal(<DropOverlay state={dragState} hint={dropHint} />, dropZone)}
    </>
  );
};

export default Text;

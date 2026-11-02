import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Columns2Icon,
  FilmIcon,
  ImageOffIcon,
  LoaderCircleIcon,
  RectangleHorizontalIcon,
  SlidersHorizontalIcon,
  TrophyIcon,
  XIcon,
} from 'lucide-react';

import { modelProviderLabels } from 'utils';
import { cn } from '@/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { hasOutput, isSettledStatus, type CompareColumnState } from '@/hooks/useCompareRun';
import CompareRunVerdicts from '@/components/Compare/CompareRunVerdicts';
import CompareVoteButton from '@/components/Compare/CompareVoteButton';
import ImageEditorDialog from '@/components/Message/ImageEditorDialog';
import { Button } from '@/components/ui/button';
import {
  DialogClose,
  DialogDescription,
  DialogPortal,
  DialogTitle,
  Dialog,
} from '@/components/ui/dialog';

interface CompareMediaViewerProps {
  columns: CompareColumnState[];
  initialColumnId: string;
  /** Letters per column in a blind run. */
  blindLetters?: readonly string[];
  isIdentityHidden: boolean;
  winner?: string | null;
  winnerColumnId?: string;
  canVote: boolean;
  isRunning: boolean;
  /** Blob URLs owned by each column's inline player, so nothing downloads twice. */
  videoPlaybackUrls: Record<string, string>;
  onVote: (winner: CompareColumnState['model'] | 'tie' | 'none', columnId?: string) => void;
  onClose: () => void;
}

const statusNote = ({ status, video }: CompareColumnState, playbackUrl?: string) => {
  if (status === 'waiting' || status === 'streaming' || video?.status === 'generating') {
    return { isLoading: true, text: 'Generating' };
  }
  if (video?.status === 'expired') return { text: 'This video is no longer available.' };
  if (video?.status === 'failed') return { text: 'This video could not be finished.' };
  if (video && !playbackUrl) return { isLoading: true, text: 'Loading video' };
  return { text: 'This model did not return a result.' };
};

/**
 * Full screen review of a media run. Focus and side by side are the same slides under different
 * CSS, so switching never remounts media or restarts a video.
 */
const CompareMediaViewer = ({
  columns,
  initialColumnId,
  blindLetters,
  isIdentityHidden,
  winner,
  winnerColumnId,
  canVote,
  isRunning,
  videoPlaybackUrls,
  onVote,
  onClose,
}: CompareMediaViewerProps) => {
  const isMobile = useIsMobile();
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<'focus' | 'grid'>('focus');
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(
      0,
      columns.findIndex(({ id }) => id === initialColumnId)
    )
  );
  const [editingColumnId, setEditingColumnId] = useState<string>();
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const contentRef = useRef<HTMLDivElement>(null);
  const wasEditingRef = useRef(false);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const isGrid = layout === 'grid' && !isMobile;

  const getLabel = (index: number) => {
    const letter = blindLetters?.[index];
    return isIdentityHidden ? `Model ${letter}` : (columns[index]?.modelLabel ?? '');
  };
  const isColumnWinner = (column: CompareColumnState) =>
    winnerColumnId ? winnerColumnId === column.id : winner === column.model;

  const slideAt = useCallback(
    (index: number) => scroller?.querySelector<HTMLElement>(`[data-slide="${index}"]`),
    [scroller]
  );

  // Starts on the tapped result, and returns to the active one when leaving side by side.
  useLayoutEffect(() => {
    if (!scroller || isGrid) return;
    scroller.scrollTo({ left: slideAt(activeIndexRef.current)?.offsetLeft ?? 0 });
  }, [scroller, isGrid, slideAt]);

  useEffect(() => {
    if (!scroller || isGrid) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveIndex(Number((entry.target as HTMLElement).dataset.slide));
          }
        }
      },
      { root: scroller, threshold: 0.6 }
    );
    scroller.querySelectorAll('[data-slide]').forEach((slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [scroller, isGrid, columns.length]);

  // A result swiped out of view must not keep playing unseen.
  useEffect(() => {
    if (!scroller || isGrid) return;
    scroller
      .querySelectorAll<HTMLVideoElement>(`[data-slide]:not([data-slide="${activeIndex}"]) video`)
      .forEach((video) => video.pause());
  }, [scroller, isGrid, activeIndex]);

  // The editor has no trigger to return to, and arrow keys need focus back inside the viewer.
  useEffect(() => {
    if (!editingColumnId && wasEditingRef.current) contentRef.current?.focus();
    wasEditingRef.current = Boolean(editingColumnId);
  }, [editingColumnId]);

  const goTo = (index: number) => {
    const slide = slideAt(index);
    if (!slide || !scroller) return;
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({ left: slide.offsetLeft, behavior: isReduced ? 'auto' : 'smooth' });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isGrid || editingColumnId) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    // Native video and slider controls use the arrow keys themselves.
    const target = event.target as HTMLElement;
    if (target.closest('video, input, [role="slider"]')) return;
    event.preventDefault();
    goTo(activeIndex + (event.key === 'ArrowLeft' ? -1 : 1));
  };

  const pauseOtherVideos = (playing: HTMLVideoElement) => {
    scroller?.querySelectorAll('video').forEach((video) => {
      if (video !== playing) video.pause();
    });
  };

  const voteDisabled = (column: CompareColumnState) =>
    !canVote || !hasOutput(column) || !isSettledStatus(column.status);

  const voteButton = (column: CompareColumnState, index: number) => (
    <CompareVoteButton
      label={getLabel(index)}
      isWinner={isColumnWinner(column)}
      disabled={voteDisabled(column)}
      onVote={() => onVote(column.model, column.id)}
    />
  );

  const identity = (column: CompareColumnState, index: number) => (
    <div
      // Keyed by visibility, so the reveal after a blind vote resolves in once.
      key={isIdentityHidden ? 'hidden' : 'revealed'}
      className={cn(
        'min-w-0',
        blindLetters &&
          !isIdentityHidden &&
          'duration-250 ease-[var(--ease-out)] animate-in fade-in-0 motion-safe:blur-in-xs'
      )}>
      <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold tracking-tight text-foreground">
        <span className="truncate" title={getLabel(index)}>
          {getLabel(index)}
        </span>
        {isColumnWinner(column) && (
          <TrophyIcon
            className="size-3.5 shrink-0 fill-primary/20 text-primary"
            role="img"
            aria-label="Voted best"
          />
        )}
      </p>
      <p className="truncate text-xs text-muted-foreground">
        {isIdentityHidden ? 'Revealed after you vote' : modelProviderLabels[column.provider]}
      </p>
    </div>
  );

  const active = columns[activeIndex] ?? columns[0];
  const editingColumn = columns.find(({ id }) => id === editingColumnId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogPrimitive.Content
          ref={contentRef}
          onKeyDown={handleKeyDown}
          // Focus starts on the viewer itself, so arrow keys work without a stray focus ring.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener?.focus();
          }}
          className="fixed inset-0 z-50 flex h-dvh min-h-0 w-full min-w-0 flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] duration-150 ease-[var(--ease-out)] outline-none animate-in fade-in-0">
          <DialogTitle className="sr-only">Compare results full screen</DialogTitle>
          <DialogDescription className="sr-only">
            Review each result and vote for the best one.
          </DialogDescription>

          <header className="flex min-w-0 shrink-0 items-center gap-2 border-b border-border/70 px-3 py-1.5 lg:px-5">
            <div className="min-w-0 flex-1" aria-live="polite">
              {!isGrid && active && identity(active, activeIndex)}
              {isGrid && (
                <p className="text-sm font-semibold tracking-tight text-foreground">
                  {columns.length} results
                </p>
              )}
            </div>
            {!isGrid && (
              <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {activeIndex + 1} of {columns.length}
              </p>
            )}
            <div
              role="group"
              aria-label="Layout"
              className="hidden shrink-0 items-center gap-0.5 rounded-full bg-muted p-0.5 md:flex">
              {(
                [
                  ['focus', 'One at a time', RectangleHorizontalIcon],
                  ['grid', 'Side by side', Columns2Icon],
                ] as const
              ).map(([value, label, Icon]) => (
                <Button
                  key={value}
                  type="button"
                  size="icon"
                  variant="ghost"
                  title={label}
                  aria-label={label}
                  aria-pressed={layout === value}
                  className={cn(
                    'size-8 rounded-full text-muted-foreground hover:bg-background/60 hover:text-foreground',
                    layout === value &&
                      'bg-background text-foreground shadow-sm hover:bg-background dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent'
                  )}
                  onClick={() => setLayout(value)}>
                  <Icon />
                </Button>
              ))}
            </div>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0 rounded-full"
                aria-label="Close full screen view">
                <XIcon />
              </Button>
            </DialogClose>
          </header>

          <div className="relative flex min-h-0 min-w-0 flex-1">
            <div
              ref={setScroller}
              className={cn(
                'relative min-h-0 min-w-0 flex-1',
                isGrid
                  ? cn(
                      'grid gap-3 overflow-y-auto p-3 lg:gap-4 lg:p-4',
                      columns.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
                    )
                  : 'flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]'
              )}>
              {columns.map((column, index) => {
                const { id, image, video } = column;
                const playbackUrl = videoPlaybackUrls[id];
                const note = statusNote(column, playbackUrl);
                const label = getLabel(index);
                return (
                  <section
                    key={id}
                    data-slide={index}
                    aria-label={label}
                    className={cn(
                      'relative flex min-h-0 min-w-0 flex-col gap-2',
                      !isGrid && 'w-full shrink-0 snap-start snap-always p-2'
                    )}>
                    {isGrid && (
                      <div className="flex min-w-0 shrink-0 items-center gap-2">
                        <div className="min-w-0 flex-1">{identity(column, index)}</div>
                        {voteButton(column, index)}
                      </div>
                    )}
                    <div
                      className={cn(
                        'relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-muted/50',
                        isGrid && isColumnWinner(column) && 'ring-2 ring-primary/70'
                      )}>
                      {image?.url && !failedImages[id] ? (
                        <>
                          <img
                            src={image.url}
                            alt={`Generated image from ${label}`}
                            className="block size-full object-contain"
                            onError={() =>
                              setFailedImages((current) => ({ ...current, [id]: true }))
                            }
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="absolute top-2 right-2 size-9 bg-background/85 shadow-sm backdrop-blur-sm"
                            title="Edit image"
                            aria-label={`Edit image from ${label}`}
                            onClick={() => setEditingColumnId(id)}>
                            <SlidersHorizontalIcon />
                          </Button>
                        </>
                      ) : video && playbackUrl && video.status !== 'expired' ? (
                        <video
                          className="block size-full object-contain"
                          src={playbackUrl}
                          controls
                          playsInline
                          preload="metadata"
                          aria-label={`Generated video from ${label}`}
                          onPlay={(event) => pauseOtherVideos(event.currentTarget)}
                        />
                      ) : (
                        <p
                          role="status"
                          className="flex flex-col items-center gap-2 px-4 text-center text-sm text-muted-foreground">
                          {image ? (
                            <ImageOffIcon className="size-7" aria-hidden="true" />
                          ) : note.isLoading ? (
                            <LoaderCircleIcon
                              className="size-7 animate-spin motion-reduce:animate-none"
                              aria-hidden="true"
                            />
                          ) : (
                            <FilmIcon className="size-7" aria-hidden="true" />
                          )}
                          {image ? 'This image is no longer available.' : note.text}
                        </p>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
            {!isGrid &&
              (
                [
                  [-1, 'Previous result', ChevronLeftIcon, 'left-4'],
                  [1, 'Next result', ChevronRightIcon, 'right-4'],
                ] as const
              ).map(([step, label, Icon, position]) => (
                <Button
                  key={step}
                  type="button"
                  variant="outline"
                  size="icon"
                  className={cn(
                    'absolute top-1/2 hidden size-11 -translate-y-1/2 rounded-full bg-background/85 shadow-sm backdrop-blur-sm md:flex',
                    position
                  )}
                  aria-label={label}
                  disabled={activeIndex + step < 0 || activeIndex + step >= columns.length}
                  onClick={() => goTo(activeIndex + step)}>
                  <Icon />
                </Button>
              ))}
          </div>

          <footer className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border/70 px-3 py-2 lg:px-5">
            {!isGrid && (
              <nav aria-label="Results" className="flex items-center">
                {columns.map((column, index) => (
                  <button
                    key={column.id}
                    type="button"
                    className="flex size-9 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    aria-label={`Show ${getLabel(index)}`}
                    aria-current={index === activeIndex ? 'true' : undefined}
                    onClick={() => goTo(index)}>
                    <span
                      className={cn(
                        'size-2 rounded-full transition-colors duration-150 motion-reduce:transition-none',
                        index === activeIndex ? 'bg-primary' : 'bg-muted-foreground/40'
                      )}
                    />
                  </button>
                ))}
              </nav>
            )}
            <div className="ml-auto flex min-w-0 items-center gap-2">
              <CompareRunVerdicts
                winner={winner}
                canVote={canVote}
                isRunning={isRunning}
                onVote={(choice) => onVote(choice)}
              />
              {!isGrid && active && voteButton(active, activeIndex)}
            </div>
          </footer>

          {editingColumn?.image?.url && (
            <ImageEditorDialog
              // The revised prompt could identify a blind model, so it waits for the vote.
              image={{
                ...editingColumn.image,
                alt: isIdentityHidden ? '' : editingColumn.image.alt,
              }}
              open
              onOpenChange={(open) => !open && setEditingColumnId(undefined)}
              onImageError={() => {
                setFailedImages((current) => ({ ...current, [editingColumn.id]: true }));
                setEditingColumnId(undefined);
              }}
            />
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};

export default CompareMediaViewer;

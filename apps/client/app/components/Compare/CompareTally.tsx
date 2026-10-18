import { useState, type ReactNode } from 'react';
import { ChevronDownIcon, ListOrderedIcon, SwordsIcon, Trash2Icon, TrophyIcon } from 'lucide-react';

import { cn } from '@/utils';
import type { CompareTallyRow, HeadToHeadRecord } from '@/hooks/useCompareVotes';
import { HeadToHeadMatrix, RatingsTable } from '@/components/Compare/CompareLeaderboard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';

const leaderboardViews = [
  { id: 'ratings', label: 'Ratings', icon: ListOrderedIcon },
  { id: 'h2h', label: 'Head-to-head', icon: SwordsIcon },
] as const;

interface CompareTallyProps {
  tally: CompareTallyRow[];
  total: number;
  ties: number;
  none: number;
  isLoading: boolean;
  getModelLabel: (model: string) => string;
  getHeadToHead: (model: string, opponent: string) => HeadToHeadRecord | undefined;
  onClear: () => Promise<void>;
  /** Header content rendered next to the leaderboard toggle. */
  children?: ReactNode;
  /** Extra header controls placed just before the leaderboard toggle. */
  actions?: ReactNode;
}

const CompareTally = ({
  tally,
  total,
  ties,
  none,
  isLoading,
  getModelLabel,
  getHeadToHead,
  onClear,
  children,
  actions,
}: CompareTallyProps) => {
  const [open, setOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [view, setView] = useState<(typeof leaderboardViews)[number]['id']>('ratings');

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="shrink-0 border-b border-border/70">
      <div className="flex min-w-0 items-center gap-1 px-3 py-2 sm:px-5">
        {children}
        {actions}
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="group h-9 shrink-0 gap-1.5 rounded-full px-3">
            <TrophyIcon className="text-primary" />
            <span className="hidden sm:inline">Leaderboard</span>
            <span className="sr-only sm:hidden">Leaderboard</span>
            <Badge
              variant="secondary"
              className="overflow-hidden rounded-full px-1.5 py-0 tabular-nums">
              {/* Keyed by the count so a saved vote ticks in, tying the vote to the leaderboard. */}
              <span
                key={isLoading ? 'loading' : total}
                className="duration-200 ease-[var(--ease-out)] animate-in fade-in-0 motion-safe:slide-in-from-bottom-2">
                {isLoading ? '-' : total}
              </span>
              <span className="sr-only"> votes</span>
            </Badge>
            <ChevronDownIcon className="transition-transform duration-150 group-data-[state=open]:rotate-180 motion-reduce:transition-none" />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="min-w-0 px-3 pb-3 duration-150 ease-[var(--ease-out)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 sm:px-5 motion-safe:data-[state=closed]:slide-out-to-top-1 motion-safe:data-[state=open]:slide-in-from-top-1">
        {!isLoading && total > 0 && (
          <div
            role="tablist"
            aria-label="Leaderboard view"
            className="mb-2 inline-flex items-center gap-0.5 rounded-full bg-muted p-0.5">
            {leaderboardViews.map(({ id, label, icon: Icon }) => {
              const isSelected = view === id;
              return (
                <Button
                  key={id}
                  type="button"
                  role="tab"
                  id={`compare-leaderboard-tab-${id}`}
                  aria-selected={isSelected}
                  aria-controls="compare-leaderboard-panel"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-8 rounded-full px-3 text-muted-foreground hover:bg-background/60 hover:text-foreground',
                    isSelected &&
                      'bg-background text-foreground shadow-sm hover:bg-background dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent'
                  )}
                  onClick={() => setView(id)}>
                  <Icon />
                  {label}
                </Button>
              );
            })}
          </div>
        )}
        <div
          id="compare-leaderboard-panel"
          role={!isLoading && total > 0 ? 'tabpanel' : undefined}
          aria-labelledby={!isLoading && total > 0 ? `compare-leaderboard-tab-${view}` : undefined}
          className="max-h-48 min-w-0 overflow-y-auto overscroll-contain rounded-xl border border-border/70 bg-card/60 sm:max-h-72">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-3" aria-label="Loading results">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          ) : total === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No votes yet. Run a comparison and pick the best answer to start the leaderboard.
            </p>
          ) : (
            <div key={view} className="duration-150 ease-[var(--ease-out)] animate-in fade-in-0">
              {view === 'ratings' ? (
                <RatingsTable tally={tally} getModelLabel={getModelLabel} />
              ) : (
                <HeadToHeadMatrix
                  tally={tally}
                  getModelLabel={getModelLabel}
                  getHeadToHead={getHeadToHead}
                />
              )}
            </div>
          )}
        </div>
        {!isLoading && total > 0 && (
          <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {total} {total === 1 ? 'vote' : 'votes'} - {ties} {ties === 1 ? 'tie' : 'ties'} -{' '}
              {none} with no winner. Stored on this device only.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive">
                  <Trash2Icon />
                  Clear results
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-sm gap-3 p-5">
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear compare results?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes{' '}
                    {total === 1 ? 'the saved vote' : `all ${total} saved votes`} on this device.
                    Your chats are not affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel asChild>
                    <Button variant="secondary">Cancel</Button>
                  </AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button
                      variant="destructive"
                      disabled={isClearing}
                      onClick={async () => {
                        setIsClearing(true);
                        try {
                          await onClear();
                        } finally {
                          setIsClearing(false);
                        }
                      }}>
                      Clear results
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default CompareTally;

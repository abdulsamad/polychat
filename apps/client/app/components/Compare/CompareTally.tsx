import { useState, type ReactNode } from 'react';
import { ChevronDownIcon, Trash2Icon, TrophyIcon } from 'lucide-react';

import type { CompareTallyRow } from '@/hooks/useCompareVotes';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CompareTallyProps {
  tally: CompareTallyRow[];
  total: number;
  ties: number;
  none: number;
  isLoading: boolean;
  getModelLabel: (model: string) => string;
  onClear: () => Promise<void>;
  /** Header content rendered next to the leaderboard toggle. */
  children?: ReactNode;
  /** Extra header controls placed just before the leaderboard toggle. */
  actions?: ReactNode;
}

const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });

const CompareTally = ({
  tally,
  total,
  ties,
  none,
  isLoading,
  getModelLabel,
  onClear,
  children,
  actions,
}: CompareTallyProps) => {
  const [open, setOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

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
        <div className="max-h-40 min-w-0 overflow-y-auto sm:max-h-64 overscroll-contain rounded-xl border border-border/70 bg-card/60">
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
            <Table className="text-sm">
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead className="h-9 px-3">Model</TableHead>
                  <TableHead className="h-9 px-3 text-right">Wins</TableHead>
                  <TableHead className="h-9 px-3 text-right">Runs</TableHead>
                  <TableHead className="h-9 px-3 text-right whitespace-nowrap">Win rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tally.map(({ model, wins, appearances, winRate }) => (
                  <TableRow key={model}>
                    <TableCell className="max-w-48 px-3 py-2">
                      <span className="block truncate font-medium" title={getModelLabel(model)}>
                        {getModelLabel(model)}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right tabular-nums">{wins}</TableCell>
                    <TableCell className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {appearances}
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <span className="flex items-center justify-end gap-2">
                        <span
                          aria-hidden="true"
                          className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-muted sm:block">
                          {/* scaleX keeps a changed vote's bar update on the compositor. */}
                          <span
                            className="block h-full w-full origin-left rounded-full bg-primary transition-transform duration-250 ease-[var(--ease-out)]"
                            style={{ transform: `scaleX(${winRate})` }}
                          />
                        </span>
                        <span className="tabular-nums">{percent.format(winRate)}</span>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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

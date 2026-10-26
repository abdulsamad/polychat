import { useEffect, useState } from 'react';
import {
  ChartColumnIcon,
  ChevronDownIcon,
  DownloadIcon,
  HistoryIcon,
  ListChecksIcon,
  RotateCcwIcon,
  Trash2Icon,
  TrophyIcon,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { toast } from 'sonner';

import { cn } from '@/utils';
import { formatCost, type ResultCost } from '@/utils/compare-metrics';
import { exportRunsCsv, exportRunsJson } from '@/utils/compare-export';
import { describeSettings } from '@/utils/compare-settings';
import {
  buildSuiteReport,
  getSuiteExecutions,
  type SuiteExecution,
} from '@/utils/compare-suite-report';
import type { ICompareRun, ICompareRunColumn } from '@/utils/lforage';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

const UNDO_WINDOW_MS = 6000;

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

interface CompareHistoryProps {
  runs: readonly ICompareRun[];
  isLoading: boolean;
  error: boolean;
  /** The run on screen, marked as current in the list. */
  activeRunId?: string;
  /** Opening or rerunning would abort the live run, so both wait until it settles. */
  isRunning: boolean;
  getModelLabel: (model: string) => string;
  getColumnCost: (column: ICompareRunColumn) => ResultCost | undefined;
  getRunCost: (run: ICompareRun) => ResultCost | undefined;
  onOpenRun: (run: ICompareRun) => void;
  /** Shows a suite execution's results on the compare page. */
  onOpenSuite: (suiteRunId: string) => void;
  onRerun: (run: ICompareRun) => void;
  onDelete: (runIds: readonly string[]) => Promise<void>;
  onRestore: (runs: readonly ICompareRun[]) => Promise<void>;
  onRetry: () => void;
  onClear: () => Promise<void>;
}

/** History rows: a suite execution is one item, placed where its newest run would be. */
type HistoryItem = { kind: 'run'; run: ICompareRun } | { kind: 'suite'; execution: SuiteExecution };

const getHistoryItems = (runs: readonly ICompareRun[]): HistoryItem[] => {
  const executions = new Map(
    getSuiteExecutions(runs).map((execution) => [execution.suiteRunId, execution])
  );
  const items: HistoryItem[] = [];
  for (const run of runs) {
    if (!run.suite) {
      items.push({ kind: 'run', run });
      continue;
    }
    const execution = executions.get(run.suite.suiteRunId);
    if (!execution) continue;
    items.push({ kind: 'suite', execution });
    // Later runs of the same execution are already inside this item.
    executions.delete(run.suite.suiteRunId);
  }
  return items;
};

const getWinnerLabel = (run: ICompareRun, getModelLabel: (model: string) => string) => {
  if (run.winner === 'tie') return 'Tie';
  if (run.winner === 'none') return 'No winner';
  if (run.winner) return `${getModelLabel(run.winner)} won`;
  return run.blind ? 'Blind - not voted' : 'Not voted';
};

const CompareHistory = ({
  runs,
  isLoading,
  error,
  activeRunId,
  isRunning,
  getModelLabel,
  getColumnCost,
  getRunCost,
  onOpenRun,
  onOpenSuite,
  onRerun,
  onDelete,
  onRestore,
  onRetry,
  onClear,
}: CompareHistoryProps) => {
  const [open, setOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  /** The last deleted runs, offered for undo inside the sheet (a toast is unreachable under the modal). */
  const [deleted, setDeleted] = useState<{ runs: ICompareRun[]; label: string } | null>(null);
  const [expandedSuites, setExpandedSuites] = useState<ReadonlySet<string>>(new Set());
  const items = getHistoryItems(runs);

  useEffect(() => {
    if (!deleted) return;
    const timer = window.setTimeout(() => setDeleted(null), UNDO_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [deleted]);

  const deleteRuns = async (toDelete: ICompareRun[], label: string) => {
    try {
      await onDelete(toDelete.map(({ id }) => id));
      // Deleting is one tap, so it gets an undo instead of a confirmation.
      setDeleted({ runs: toDelete, label });
    } catch (deleteError) {
      console.error('Failed to delete compare runs', deleteError);
      toast.error('Could not delete the comparison.');
    }
  };

  const undoDelete = async () => {
    if (!deleted) return;
    const { runs: toRestore } = deleted;
    setDeleted(null);
    try {
      await onRestore(toRestore);
    } catch (restoreError) {
      console.error('Failed to restore compare runs', restoreError);
      toast.error('Could not restore the comparison.');
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setDeleted(null);
  };

  const closeAfter = <T,>(action: (value: T) => void, value: T) => {
    action(value);
    setOpen(false);
  };

  const toggleSuite = (suiteRunId: string, isOpen: boolean) =>
    setExpandedSuites((current) => {
      const next = new Set(current);
      if (isOpen) next.add(suiteRunId);
      else next.delete(suiteRunId);
      return next;
    });

  const renderRun = (run: ICompareRun) => {
    const isActive = run.id === activeRunId;
    // An unvoted blind run keeps its models hidden here as well as on screen.
    const isHidden = Boolean(run.blind && !run.winner);
    return (
      <div
        className={cn(
          'flex min-w-0 items-start gap-1 rounded-xl transition-colors duration-150',
          isActive && 'bg-accent/70'
        )}>
        <button
          type="button"
          aria-current={isActive || undefined}
          disabled={isRunning}
          onClick={() => closeAfter(onOpenRun, run)}
          className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-xl px-3 py-2.5 text-left transition-[background-color,scale] duration-150 ease-[var(--ease-out)] hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 motion-reduce:active:scale-100">
          <span className="line-clamp-2 text-sm font-medium text-foreground [overflow-wrap:anywhere]">
            {run.suite && (
              <span className="mr-1.5 text-xs text-muted-foreground tabular-nums">
                {run.suite.index + 1}.
              </span>
            )}
            {run.prompt}
          </span>
          <span className="flex min-w-0 flex-wrap gap-1">
            {run.columns.map((column, columnIndex) => {
              // The column id decides when one model ran in several columns.
              const isWinner = run.winnerColumnId
                ? run.winnerColumnId === column.id
                : run.winner === column.model;
              const variant = [
                describeSettings(column.settings),
                column.sample !== undefined && `#${column.sample}`,
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <span
                  key={column.id}
                  className={cn(
                    'inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[0.6875rem] leading-4',
                    isWinner
                      ? 'bg-primary/15 font-medium text-foreground'
                      : 'bg-muted text-muted-foreground',
                    column.status !== 'done' && 'line-through decoration-muted-foreground/60'
                  )}>
                  {isWinner && (
                    <TrophyIcon
                      className="size-3 shrink-0 fill-current text-primary"
                      aria-label="Winner"
                    />
                  )}
                  <span className="truncate">
                    {isHidden
                      ? `Model ${String.fromCharCode(65 + columnIndex)}`
                      : getModelLabel(column.model)}
                    {variant && <span className="opacity-70"> {variant}</span>}
                  </span>
                </span>
              );
            })}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {dateFormat.format(run.timestamp)} - {getWinnerLabel(run, getModelLabel)}
            {/* Unknown cost reads as "-"; an unvoted blind run keeps it hidden. */}
            {!isHidden && ` - Cost ${formatCost(getRunCost(run))}`}
          </span>
        </button>
        <div className="flex shrink-0 flex-col py-1 pr-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-full text-muted-foreground hover:text-foreground"
            disabled={isRunning}
            aria-label={`Run "${run.prompt.slice(0, 60)}" again`}
            title="Run again"
            onClick={() => closeAfter(onRerun, run)}>
            <RotateCcwIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Delete "${run.prompt.slice(0, 60)}"`}
            title="Delete"
            onClick={() => void deleteRuns([run], 'Comparison deleted')}>
            <Trash2Icon />
          </Button>
        </div>
      </div>
    );
  };

  const renderSuite = (execution: SuiteExecution) => {
    const report = buildSuiteReport(execution, getColumnCost);
    const leader = report.isHidden
      ? undefined
      : report.models.find(({ key }) => key === report.bests.wins);
    const isExpanded = expandedSuites.has(execution.suiteRunId);
    const containsActive = execution.runs.some(({ id }) => id === activeRunId);
    const summary = [
      `${execution.runs.length} of ${execution.total} prompts`,
      `${report.voted} voted`,
      !report.isHidden && `Cost ${formatCost(report.totalCost)}`,
    ]
      .filter(Boolean)
      .join(' - ');
    return (
      <Collapsible
        open={isExpanded}
        onOpenChange={(isOpen) => toggleSuite(execution.suiteRunId, isOpen)}
        className={cn(
          'flex min-w-0 flex-col rounded-xl border border-border/70 bg-muted/30 transition-colors duration-150',
          containsActive && 'border-primary/40'
        )}>
        <div className="flex min-w-0 items-start gap-1">
          <div className="flex min-w-0 flex-1 flex-col gap-1 px-3 pt-2.5">
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <ListChecksIcon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate tabular-nums">
                Suite - {dateFormat.format(execution.timestamp)}
              </span>
            </span>
            <span
              className="line-clamp-2 text-sm font-medium text-foreground [overflow-wrap:anywhere]"
              title={execution.suiteName}>
              {execution.suiteName}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">{summary}</span>
            {leader && (
              <span className="flex min-w-0 items-center gap-1 text-xs text-foreground">
                <TrophyIcon
                  className="size-3 shrink-0 fill-current text-primary"
                  aria-hidden="true"
                />
                <span className="truncate">
                  {getModelLabel(leader.model)}
                  {leader.variant && <span className="opacity-70"> {leader.variant}</span>} leads
                  with {leader.wins} {leader.wins === 1 ? 'win' : 'wins'}
                </span>
              </span>
            )}
          </div>
          <div className="flex shrink-0 flex-col py-1 pr-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Delete suite "${execution.suiteName.slice(0, 60)}" and its ${execution.runs.length} runs`}
              title="Delete suite runs"
              onClick={() =>
                void deleteRuns(
                  execution.runs,
                  `Suite deleted (${execution.runs.length} ${execution.runs.length === 1 ? 'run' : 'runs'})`
                )
              }>
              <Trash2Icon />
            </Button>
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1 px-2 pt-1.5 pb-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 gap-1.5 rounded-full px-3"
            disabled={isRunning}
            onClick={() => closeAfter(onOpenSuite, execution.suiteRunId)}>
            <ChartColumnIcon />
            View results
          </Button>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="group h-9 gap-1 rounded-full px-3 text-muted-foreground hover:text-foreground">
              {execution.runs.length} {execution.runs.length === 1 ? 'prompt' : 'prompts'}
              <ChevronDownIcon
                className="transition-transform duration-150 ease-[var(--ease-out)] group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="min-w-0 overflow-hidden ease-[var(--ease-out)] data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
          <ul className="flex min-w-0 flex-col gap-1 border-t border-border/60 p-1">
            {execution.runs.map((run) => (
              <li key={run.id} className="min-w-0">
                {renderRun(run)}
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 shrink-0 gap-1.5 rounded-full px-3">
          <HistoryIcon className="text-primary" />
          <span className="hidden sm:inline">History</span>
          <span className="sr-only sm:hidden">Comparison history</span>
          {!isLoading && runs.length > 0 && (
            <Badge
              variant="secondary"
              className="overflow-hidden rounded-full px-1.5 py-0 tabular-nums">
              <span
                key={runs.length}
                className="duration-200 ease-[var(--ease-out)] animate-in fade-in-0 motion-safe:slide-in-from-bottom-2">
                {runs.length}
              </span>
              <span className="sr-only"> saved</span>
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="gap-1 border-b border-border/70 px-4 pt-4 pb-3 pr-12 text-left">
          <SheetTitle className="text-base tracking-tight">History</SheetTitle>
          <SheetDescription className="text-xs">
            Your last 100 comparisons, with answers, stored on this device only.
          </SheetDescription>
          {runs.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-full px-3">
                    <DownloadIcon />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onSelect={() => exportRunsCsv(runs, getColumnCost)}>
                    CSV (one row per answer)
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => exportRunsJson(runs)}>
                    JSON (full runs)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive">
                    <Trash2Icon />
                    Clear all
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-sm gap-3 p-5">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear comparison history?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes{' '}
                      {runs.length === 1
                        ? 'the saved comparison'
                        : `all ${runs.length} saved comparisons`}{' '}
                      and their answers on this device. Leaderboard votes are kept.
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
                        Clear history
                      </Button>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:w-full [&_[data-radix-scroll-area-viewport]>div]:min-w-0">
          {isLoading ? (
            <div className="flex flex-col gap-3 p-4" aria-label="Loading history">
              {[0, 1, 2].map((item) => (
                <div key={item} className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">Could not load your history.</p>
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <HistoryIcon className="size-5" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium text-foreground">No saved comparisons yet</p>
              <p className="text-xs text-pretty text-muted-foreground">
                Every finished comparison is saved here with its answers, so you can reopen, rerun
                or export it.
              </p>
            </div>
          ) : (
            // popLayout takes a deleted row out of flow at once, so the rows below glide up
            // (layout) while it fades; Undo plays the same path in reverse.
            <ul className="relative flex min-w-0 flex-col gap-1 p-2">
              <AnimatePresence initial={false} mode="popLayout">
                {items.map((item) => (
                  <motion.li
                    key={item.kind === 'run' ? item.run.id : `suite-${item.execution.suiteRunId}`}
                    layout={shouldReduceMotion ? false : 'position'}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                    className={cn('min-w-0', item.kind === 'suite' && 'my-1')}>
                    {item.kind === 'run' ? renderRun(item.run) : renderSuite(item.execution)}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </ScrollArea>
        <div role="status" aria-live="polite" className="shrink-0 empty:hidden">
          {deleted && (
            <div className="flex min-w-0 items-center gap-3 border-t border-border/70 bg-muted/60 px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] duration-200 ease-[var(--ease-out)] animate-in fade-in-0 motion-safe:slide-in-from-bottom-2">
              <p className="min-w-0 flex-1 truncate text-sm text-foreground">{deleted.label}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 shrink-0 rounded-full px-4"
                onClick={() => void undoDelete()}>
                Undo
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CompareHistory;

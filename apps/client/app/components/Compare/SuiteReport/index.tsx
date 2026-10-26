import { lazy, Suspense, type ReactNode } from 'react';
import {
  DownloadIcon,
  EyeOffIcon,
  ListChecksIcon,
  RotateCcwIcon,
  VoteIcon,
  XIcon,
} from 'lucide-react';

import { formatCost, type ResultCost } from '@/utils/compare-metrics';
import { exportRunsCsv, exportRunsJson } from '@/utils/compare-export';
import type { SuiteReport as SuiteReportData } from '@/utils/compare-suite-report';
import type { ICompareRun, ICompareRunColumn } from '@/utils/lforage';
import ModelRanking from '@/components/Compare/SuiteReport/ModelRanking';
import PromptMatrix from '@/components/Compare/SuiteReport/PromptMatrix';
import { formatDuration } from '@/components/Compare/CompareColumn';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

// Recharts only loads once a report is opened.
const ComparisonCharts = lazy(() => import('@/components/Compare/SuiteReport/ComparisonCharts'));

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

interface SuiteReportProps {
  report?: SuiteReportData;
  isLoading: boolean;
  /** Opening a run aborts a live one, so navigation waits while a run streams. */
  isRunning: boolean;
  getModelLabel: (model: string) => string;
  getColumnCost: (column: ICompareRunColumn) => ResultCost | undefined;
  /** Why the suite cannot run again; undefined when it can. */
  runAgainBlocker?: string;
  onRunAgain: () => void;
  onOpenRun: (run: ICompareRun) => void;
  onClose: () => void;
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section aria-label={title} className="flex min-w-0 flex-col gap-2">
    <h4 className="px-1 text-sm font-semibold tracking-tight text-foreground">{title}</h4>
    {children}
  </section>
);

/** Results of one suite execution: ranking, charts and every prompt's outcome. */
const SuiteReport = ({
  report,
  isLoading,
  isRunning,
  getModelLabel,
  getColumnCost,
  runAgainBlocker,
  onRunAgain,
  onOpenRun,
  onClose,
}: SuiteReportProps) => {
  const closeButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
      aria-label="Close suite results"
      title="Close"
      onClick={onClose}>
      <XIcon />
    </Button>
  );

  if (!report) {
    return (
      <div className="flex min-h-0 flex-1 overflow-y-auto px-4 py-6">
        {isLoading ? (
          <div
            className="mx-auto flex w-full max-w-5xl flex-col gap-3"
            aria-label="Loading suite results">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="m-auto flex max-w-sm flex-col items-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              These suite results are no longer in History.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    );
  }

  const { execution } = report;
  const firstUnvoted = execution.runs.find(({ id }) => report.unvotedRunIds.includes(id));
  const reviewTarget = firstUnvoted ?? execution.runs[0];
  const isIncomplete = execution.runs.length < execution.total;
  const meta = [
    `${execution.runs.length} of ${execution.total} prompts`,
    `${report.voted} voted`,
    dateFormat.format(execution.timestamp),
    report.totalMs !== undefined && formatDuration(Math.round(report.totalMs)),
    report.totalCost && !report.isHidden && formatCost(report.totalCost),
  ].filter(Boolean);

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-5 px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
        <header className="flex min-w-0 flex-col gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <ListChecksIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Suite results</p>
              <h3
                className="truncate text-base font-semibold tracking-tight text-foreground"
                title={execution.suiteName}>
                {execution.suiteName}
              </h3>
              <p className="text-xs text-muted-foreground tabular-nums">{meta.join(' - ')}</p>
            </div>
            {closeButton}
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {reviewTarget && (
              <Button
                type="button"
                size="sm"
                variant={firstUnvoted ? 'default' : 'outline'}
                className="h-9 rounded-full px-4"
                disabled={isRunning}
                onClick={() => onOpenRun(reviewTarget)}>
                <VoteIcon />
                {firstUnvoted
                  ? `Review & vote (${report.unvotedRunIds.length} left)`
                  : 'Step through prompts'}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full px-3"
                  title="Export">
                  <DownloadIcon />
                  {/* Secondary actions go icon-only on phones so all three fit on one row. */}
                  <span className="sr-only sm:not-sr-only">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => exportRunsCsv(execution.runs, getColumnCost)}>
                  CSV (one row per answer)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => exportRunsJson(execution.runs)}>
                  JSON (full runs)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 rounded-full px-3"
              disabled={Boolean(runAgainBlocker)}
              title={runAgainBlocker ?? 'Run every prompt again with the same models'}
              onClick={onRunAgain}>
              <RotateCcwIcon />
              <span className="sr-only sm:not-sr-only">Run again</span>
            </Button>
          </div>
          {isIncomplete && (
            <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-pretty text-muted-foreground">
              {execution.total - execution.runs.length} of {execution.total} prompts are missing:
              the suite was stopped early, or older runs were removed from History.
            </p>
          )}
        </header>

        {report.isHidden ? (
          <p className="flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-sm text-pretty text-muted-foreground">
            <EyeOffIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Blind suite: vote on every prompt to reveal the models and their numbers.
          </p>
        ) : (
          <>
            <Section title="Ranking">
              <div className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card">
                <ModelRanking report={report} getModelLabel={getModelLabel} />
              </div>
            </Section>
            <Suspense
              fallback={
                <div className="grid gap-3 md:grid-cols-3">
                  {[0, 1, 2].map((item) => (
                    <Skeleton key={item} className="h-40 rounded-xl" />
                  ))}
                </div>
              }>
              <ComparisonCharts report={report} getModelLabel={getModelLabel} />
            </Suspense>
          </>
        )}

        <Section title="Per prompt">
          <div className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card">
            <PromptMatrix
              report={report}
              getModelLabel={getModelLabel}
              disabled={isRunning}
              onOpenRun={onOpenRun}
            />
          </div>
        </Section>
      </div>
    </div>
  );
};

export default SuiteReport;

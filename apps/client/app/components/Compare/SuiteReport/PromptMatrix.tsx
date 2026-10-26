import { CircleCheckIcon, CircleXIcon, MinusIcon, TrophyIcon } from 'lucide-react';

import { cn } from '@/utils';
import type { ICompareRun } from '@/utils/lforage';
import type { SuiteCell, SuiteReport } from '@/utils/compare-suite-report';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PromptMatrixProps {
  report: SuiteReport;
  getModelLabel: (model: string) => string;
  /** Disabled while a live run would be aborted by opening another. */
  disabled: boolean;
  onOpenRun: (run: ICompareRun) => void;
}

const getVerdict = (run: ICompareRun, getModelLabel: (model: string) => string) => {
  if (run.winner === 'tie') return 'Tie';
  if (run.winner === 'none') return 'None';
  if (run.winner) return getModelLabel(run.winner);
  return undefined;
};

const Cell = ({ cell }: { cell: SuiteCell }) => {
  const score = 'score' in cell && cell.score !== undefined ? cell.score.toFixed(1) : undefined;
  switch (cell.state) {
    case 'won':
      return (
        <span className="inline-flex items-center gap-1 font-medium text-foreground">
          <TrophyIcon className="size-3.5 fill-current text-primary" aria-hidden="true" />
          <span className="sr-only">Won</span>
          {score}
        </span>
      );
    case 'answered':
      return (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          {score ?? <CircleCheckIcon className="size-3.5" aria-hidden="true" />}
          <span className="sr-only">{score ? ' rubric score' : 'Answered'}</span>
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center text-destructive">
          <CircleXIcon className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Failed</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center text-muted-foreground/60">
          <MinusIcon className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Not in this run</span>
        </span>
      );
  }
};

/** One row per prompt with each model's outcome; a row opens that run. */
const PromptMatrix = ({ report, getModelLabel, disabled, onOpenRun }: PromptMatrixProps) => (
  <Table className="text-sm">
    <TableHeader className="bg-muted">
      <TableRow>
        {/* Pinned so the prompt stays readable while the model columns scroll on phones. */}
        <TableHead className="sticky left-0 z-10 h-9 min-w-40 bg-muted px-3">Prompt</TableHead>
        {!report.isHidden &&
          report.models.map((model) => {
            const label = getModelLabel(model.model);
            const title = model.variant ? `${label} ${model.variant}` : label;
            return (
              <TableHead key={model.key} title={title} className="h-9 max-w-28 px-3 text-center">
                <span className="block truncate">{label}</span>
                {model.variant && (
                  <span className="block truncate text-[0.6875rem] font-normal">
                    {model.variant}
                  </span>
                )}
              </TableHead>
            );
          })}
        <TableHead className="h-9 px-3 whitespace-nowrap">Result</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {report.prompts.map(({ run, index, cells }) => {
        // Winner names stay hidden with the rest of the per-model data.
        const verdict = report.isHidden
          ? run.winner
            ? 'Voted'
            : undefined
          : getVerdict(run, getModelLabel);
        return (
          <TableRow key={run.id} className="hover:bg-transparent">
            <TableCell className="sticky left-0 z-10 max-w-80 min-w-40 bg-card px-1 py-1">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onOpenRun(run)}
                className="flex w-full min-w-0 items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-[background-color,scale] duration-150 ease-[var(--ease-out)] hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 motion-reduce:active:scale-100">
                <span className="mt-px w-5 shrink-0 text-xs text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <span className="line-clamp-2 min-w-0 text-foreground [overflow-wrap:anywhere]">
                  {run.prompt}
                </span>
              </button>
            </TableCell>
            {!report.isHidden &&
              report.models.map(({ key }) => (
                <TableCell key={key} className="px-3 py-2 text-center tabular-nums">
                  <Cell cell={cells[key]} />
                </TableCell>
              ))}
            <TableCell
              className={cn(
                'max-w-36 px-3 py-2 whitespace-nowrap',
                verdict ? 'text-foreground' : 'text-muted-foreground'
              )}>
              <span className="block truncate">{verdict ?? 'Not voted'}</span>
            </TableCell>
          </TableRow>
        );
      })}
    </TableBody>
  </Table>
);

export default PromptMatrix;

import type { ReactNode } from 'react';
import { TrophyIcon } from 'lucide-react';

import { cn } from '@/utils';
import { formatCost, formatSpeed } from '@/utils/compare-metrics';
import type { SuiteBestMetric, SuiteReport } from '@/utils/compare-suite-report';
import { formatDuration } from '@/components/Compare/CompareColumn';
import ModelName from '@/components/Compare/SuiteReport/ModelName';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 });

const columns: Array<{ label: string; title: string; className?: string }> = [
  {
    label: 'Model',
    title: 'Sorted by wins, then rubric score',
    // Pinned so a phone scrolling the metrics still sees which model a row is.
    className: 'sticky left-0 z-10 bg-muted',
  },
  {
    label: 'Wins',
    title: 'Prompts won out of the voted prompts it answered',
    className: 'text-right',
  },
  {
    label: 'Score',
    title: 'Average rubric score (1-5) across rated answers',
    className: 'text-right',
  },
  { label: 'First token', title: 'Median time to first token', className: 'text-right' },
  { label: 'Speed', title: 'Median answer tokens per second', className: 'text-right' },
  { label: 'Cost', title: 'Total cost across the suite', className: 'text-right' },
  { label: 'Failed', title: 'Prompts that failed or were stopped', className: 'text-right' },
];

const cellClass = 'px-3 py-2 text-right tabular-nums whitespace-nowrap lg:px-4 lg:py-3';

interface ModelRankingProps {
  report: SuiteReport;
  getModelLabel: (model: string) => string;
}

/** Per-model totals across the suite, with the best value of each metric highlighted. */
const ModelRanking = ({ report, getModelLabel }: ModelRankingProps) => {
  const best = (metric: SuiteBestMetric, key: string, content: ReactNode) => {
    const isBest = report.bests[metric] === key;
    return (
      <span className={cn(isBest && 'font-semibold text-primary')}>
        {content}
        {isBest && <span className="sr-only"> (best)</span>}
      </span>
    );
  };

  return (
    <Table className="text-sm">
      <TableHeader className="bg-muted">
        <TableRow>
          {columns.map(({ label, title, className }) => (
            <TableHead
              key={label}
              title={title}
              className={cn('h-9 px-3 whitespace-nowrap lg:h-10 lg:px-4', className)}>
              {label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {report.models.map((model, rank) => {
          const label = getModelLabel(model.model);
          return (
            <TableRow key={model.key} className="hover:bg-transparent">
              {/* Wide enough for two lines of a short name on phones; tap shows the full one. */}
              <TableCell className="sticky left-0 z-10 w-36 max-w-36 min-w-36 bg-card px-2 py-1.5 sm:w-auto sm:max-w-56">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="w-4 shrink-0 text-center text-xs text-muted-foreground tabular-nums">
                    {rank + 1}
                  </span>
                  <ModelName
                    model={model.model}
                    label={label}
                    variant={model.variant}
                    className="flex-1 px-1 py-0.5"
                  />
                  {report.bests.wins === model.key && (
                    <TrophyIcon
                      className="size-3.5 shrink-0 fill-current text-primary"
                      aria-label="Most wins"
                    />
                  )}
                </span>
              </TableCell>
              <TableCell className={cellClass}>
                {best(
                  'wins',
                  model.key,
                  <>
                    {model.wins}
                    {model.winRate !== undefined && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        {percent.format(model.winRate)}
                      </span>
                    )}
                  </>
                )}
              </TableCell>
              <TableCell className={cellClass}>
                {best('score', model.key, model.score === undefined ? '-' : model.score.toFixed(1))}
              </TableCell>
              <TableCell className={cellClass}>
                {best(
                  'ttft',
                  model.key,
                  formatDuration(
                    model.medianTtft === undefined ? undefined : Math.round(model.medianTtft)
                  )
                )}
              </TableCell>
              <TableCell className={cellClass}>
                {best('speed', model.key, formatSpeed(model.medianSpeed))}
              </TableCell>
              <TableCell className={cellClass}>
                {best('cost', model.key, formatCost(model.totalCost))}
              </TableCell>
              <TableCell
                className={cn(
                  cellClass,
                  model.failures ? 'text-destructive' : 'text-muted-foreground'
                )}>
                {model.failures}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default ModelRanking;

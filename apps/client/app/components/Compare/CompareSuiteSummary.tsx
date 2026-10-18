import {
  median,
  formatCost,
  formatSpeed,
  tokensPerSecond,
  type ResultCost,
} from '@/utils/compare-metrics';
import type { ICompareRun, ICompareRunColumn } from '@/utils/lforage';
import { formatDuration } from '@/components/Compare/CompareColumn';

export interface SuiteExecution {
  suiteRunId: string;
  suiteName: string;
  total: number;
  runs: ICompareRun[];
  /** Newest run time, used to order executions. */
  timestamp: number;
}

/** Groups saved runs by suite execution, newest first. */
export const getSuiteExecutions = (runs: readonly ICompareRun[]): SuiteExecution[] => {
  const executions = new Map<string, SuiteExecution>();
  for (const run of runs) {
    if (!run.suite) continue;
    const existing = executions.get(run.suite.suiteRunId);
    if (existing) {
      existing.runs.push(run);
      existing.timestamp = Math.max(existing.timestamp, run.timestamp);
    } else {
      executions.set(run.suite.suiteRunId, {
        suiteRunId: run.suite.suiteRunId,
        suiteName: run.suite.suiteName,
        total: run.suite.total,
        runs: [run],
        timestamp: run.timestamp,
      });
    }
  }
  return [...executions.values()].sort((a, b) => b.timestamp - a.timestamp);
};

interface SuiteSummaryProps {
  execution: SuiteExecution;
  getModelLabel: (model: string) => string;
  getColumnCost: (column: ICompareRunColumn) => ResultCost | undefined;
}

/** Per-model totals across every run of one suite execution. */
const SuiteSummary = ({ execution, getModelLabel, getColumnCost }: SuiteSummaryProps) => {
  // Per-model numbers would expose which blind column was which.
  if (execution.runs.some(({ blind, winner }) => blind && !winner)) {
    return (
      <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        Vote on every blind run in this suite to see the per-model summary.
      </p>
    );
  }

  const byModel = new Map<string, { columns: ICompareRunColumn[]; wins: number }>();
  for (const run of execution.runs) {
    for (const column of run.columns) {
      const entry = byModel.get(column.model) ?? { columns: [], wins: 0 };
      entry.columns.push(column);
      byModel.set(column.model, entry);
    }
    if (run.winner && run.winner !== 'tie' && run.winner !== 'none') {
      const entry = byModel.get(run.winner);
      if (entry) entry.wins += 1;
    }
  }
  const voted = execution.runs.filter(({ winner }) => winner).length;

  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-xl bg-muted/60 p-2.5 duration-150 ease-[var(--ease-out)] animate-in fade-in-0">
      <p className="text-xs text-muted-foreground">
        {execution.runs.length} of {execution.total} prompts saved - {voted} voted
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1 pr-2 font-medium">Model</th>
            <th className="py-1 pr-2 text-right font-medium" title="Runs won out of runs voted">
              Wins
            </th>
            <th className="py-1 pr-2 text-right font-medium" title="Median time to first token">
              First token
            </th>
            <th
              className="py-1 pr-2 text-right font-medium"
              title="Median answer tokens per second">
              Speed
            </th>
            <th className="py-1 text-right font-medium" title="Total cost across the suite">
              Cost
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {[...byModel].map(([model, { columns, wins }]) => {
            const answered = columns.filter(
              ({ status, content }) => status === 'done' && content.trim()
            );
            const costs = columns.map(getColumnCost);
            const knownCosts = costs.filter((cost): cost is ResultCost => Boolean(cost));
            const totalCost: ResultCost | undefined =
              knownCosts.length === costs.length && knownCosts.length
                ? {
                    usd: knownCosts.reduce((sum, { usd }) => sum + usd, 0),
                    isEstimate: knownCosts.some(({ isEstimate }) => isEstimate),
                  }
                : undefined;
            const ttft = median(answered.flatMap(({ ttftMs }) => ttftMs ?? []));
            return (
              <tr key={model} className="border-t border-border/60">
                <td className="max-w-32 py-1 pr-2">
                  <span
                    className="block truncate font-medium text-foreground"
                    title={getModelLabel(model)}>
                    {getModelLabel(model)}
                  </span>
                </td>
                <td className="py-1 pr-2 text-right">
                  {wins}/{voted}
                </td>
                <td className="py-1 pr-2 text-right">
                  {formatDuration(ttft === undefined ? undefined : Math.round(ttft))}
                </td>
                <td className="py-1 pr-2 text-right">
                  {formatSpeed(median(answered.flatMap((column) => tokensPerSecond(column) ?? [])))}
                </td>
                <td className="py-1 text-right">{formatCost(totalCost)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default SuiteSummary;

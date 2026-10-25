import { thinkingMs, tokensPerSecond, wordCount, type ResultCost } from './compare-metrics';
import type { ICompareRun, ICompareRunColumn } from './lforage';

const downloadText = (content: string, filename: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Quotes text cells and neutralizes leading formula characters, so a prompt such as
 * "=HYPERLINK(...)" stays text when the file is opened in a spreadsheet.
 */
const csvCell = (value: string | number | boolean | undefined) => {
  if (value === undefined) return '';
  if (typeof value !== 'string') return String(value);
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
};

export const exportRunsJson = (runs: readonly ICompareRun[]) =>
  downloadText(
    JSON.stringify(runs, null, 2),
    `polychat-compare-runs-${today()}.json`,
    'application/json;charset=utf-8'
  );

/** One row per model answer, so results load straight into a spreadsheet pivot. */
export const exportRunsCsv = (
  runs: readonly ICompareRun[],
  costOf: (column: ICompareRunColumn) => ResultCost | undefined
) => {
  const header = [
    'run_id',
    'run_date',
    'prompt',
    'model',
    'provider',
    'served_model',
    'status',
    'is_winner',
    'run_winner',
    'blind',
    'first_token_ms',
    'total_ms',
    'thinking_ms',
    'tokens_per_second',
    'input_tokens',
    'output_tokens',
    'reasoning_tokens',
    'cached_input_tokens',
    'cost_usd',
    'cost_is_estimate',
    'finish_reason',
    'words',
    'score_correctness',
    'score_clarity',
    'score_conciseness',
    'temperature',
    'max_tokens',
    'profile',
    'sample',
    'turn',
    'parent_run_id',
    'suite_name',
    'suite_run_id',
    'suite_prompt_number',
    // Appended last, so files read by column position keep their layout.
    'output_type',
  ];
  const rows = runs.flatMap((run) =>
    run.columns.map((column) => {
      const cost = costOf(column);
      const speed = tokensPerSecond(column);
      return [
        run.id,
        new Date(run.timestamp).toISOString(),
        run.prompt,
        column.model,
        column.provider,
        column.servedModelId,
        column.status,
        run.winner === column.model,
        run.winner ?? undefined,
        Boolean(run.blind),
        column.ttftMs,
        column.totalMs,
        thinkingMs(column),
        speed === undefined ? undefined : Number(speed.toFixed(2)),
        column.usage?.inputTokens,
        column.usage?.outputTokens,
        column.usage?.reasoningTokens,
        column.usage?.cachedInputTokens,
        cost?.usd,
        cost?.isEstimate,
        column.finishReason,
        wordCount(column.content),
        column.rubric?.correctness,
        column.rubric?.clarity,
        column.rubric?.conciseness,
        column.settings?.temperature,
        column.settings?.maxTokens,
        column.settings?.profile,
        column.sample,
        (column.history?.length ?? 0) + 1,
        run.parentRunId,
        run.suite?.suiteName,
        run.suite?.suiteRunId,
        run.suite ? run.suite.index + 1 : undefined,
        run.outputType ?? 'text',
      ]
        .map(csvCell)
        .join(',');
    })
  );

  downloadText(
    [header.join(','), ...rows].join('\r\n'),
    `polychat-compare-runs-${today()}.csv`,
    'text/csv;charset=utf-8'
  );
};

import type { ChatResponseMetadata } from 'utils';
import type { ModelPrice } from './model-pricing';

interface TimedResult {
  ttftMs?: number;
  totalMs?: number;
  reasoningStartMs?: number;
  usage?: ChatResponseMetadata['usage'];
  costUsd?: number;
}

export interface ResultCost {
  usd: number;
  /** True when derived from published prices rather than reported by the provider. */
  isEstimate: boolean;
}

/**
 * Answer tokens per second while text streamed. Reasoning tokens are excluded because they are
 * generated before the first text token, often without being streamed.
 */
export const tokensPerSecond = ({ ttftMs, totalMs, usage }: TimedResult) => {
  const outputTokens = usage?.outputTokens;
  if (outputTokens === undefined || ttftMs === undefined || totalMs === undefined) return undefined;
  const answerTokens = outputTokens - (usage?.reasoningTokens ?? 0);
  const streamingMs = totalMs - ttftMs;
  return answerTokens > 0 && streamingMs > 0 ? answerTokens / (streamingMs / 1000) : undefined;
};

/** Time spent streaming visible reasoning before the answer started (or until it ended). */
export const thinkingMs = ({ reasoningStartMs, ttftMs, totalMs }: TimedResult) => {
  if (reasoningStartMs === undefined) return undefined;
  const end = ttftMs ?? totalMs;
  return end !== undefined && end > reasoningStartMs ? end - reasoningStartMs : undefined;
};

export const wordCount = (content: string) => content.trim().split(/\s+/).filter(Boolean).length;

/** Prefers the provider-reported cost; otherwise estimates from token usage and published prices. */
export const resultCost = (
  { usage, costUsd }: TimedResult,
  price: ModelPrice | undefined
): ResultCost | undefined => {
  if (costUsd !== undefined) return { usd: costUsd, isEstimate: false };
  if (!price || !usage) return undefined;

  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  if (!inputTokens && !outputTokens) return undefined;
  const cachedTokens = Math.min(usage.cachedInputTokens ?? 0, inputTokens);
  const usd =
    (inputTokens - cachedTokens) * price.input +
    cachedTokens * (price.cacheRead ?? price.input) +
    outputTokens * price.output;
  return { usd, isEstimate: true };
};

/**
 * Sum of every column that produced usage. Undefined when any of them has no known cost, since
 * a partial total would understate the run.
 */
export const runCost = <T extends TimedResult>(
  columns: readonly T[],
  costOf: (column: T) => ResultCost | undefined
): ResultCost | undefined => {
  const billed = columns.filter(({ usage, costUsd }) => usage || costUsd !== undefined);
  if (!billed.length) return undefined;

  let total: ResultCost = { usd: 0, isEstimate: false };
  for (const column of billed) {
    const cost = costOf(column);
    if (!cost) return undefined;
    total = { usd: total.usd + cost.usd, isEstimate: total.isEstimate || cost.isEstimate };
  }
  return total;
};

const usdFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumSignificantDigits: 2,
});

export const formatCost = (cost?: ResultCost) => {
  if (!cost) return '-';
  if (cost.usd === 0) return '$0';
  return `${cost.isEstimate ? '~' : ''}${usdFormat.format(cost.usd)}`;
};

export const formatSpeed = (value?: number) =>
  value === undefined ? '-' : `${value < 100 ? value.toFixed(1) : Math.round(value)} tok/s`;

export type BestMetric = 'ttft' | 'total' | 'speed' | 'cost';

/**
 * The winning column id per metric. A metric only has a winner when at least two answered
 * columns report it, so a lone value is never marked best.
 */
export const getBests = <T extends { id: string }>(
  columns: readonly T[],
  values: (column: T) => Partial<Record<BestMetric, number>>
): Partial<Record<BestMetric, string>> => {
  const lowerIsBetter: Record<BestMetric, boolean> = {
    ttft: true,
    total: true,
    speed: false,
    cost: true,
  };
  const bests: Partial<Record<BestMetric, string>> = {};

  for (const metric of Object.keys(lowerIsBetter) as BestMetric[]) {
    const candidates = columns.flatMap((column) => {
      const value = values(column)[metric];
      return value === undefined ? [] : [{ id: column.id, value }];
    });
    if (candidates.length < 2) continue;
    const isBetter = (a: number, b: number) => (lowerIsBetter[metric] ? a < b : a > b);
    const best = candidates.reduce((winner, candidate) =>
      isBetter(candidate.value, winner.value) ? candidate : winner
    );
    // Equal values everywhere carry no signal.
    if (candidates.every(({ value }) => value === best.value)) continue;
    bests[metric] = best.id;
  }
  return bests;
};

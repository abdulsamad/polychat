import type { modelProviderType } from 'utils';
import { lforage, modelPricingKey } from './lforage';

/** USD per token, as published by OpenRouter. */
export interface ModelPrice {
  input: number;
  output: number;
  cacheRead?: number;
}

export type PriceTable = Record<string, ModelPrice>;

const PRICING_ENDPOINT = 'https://openrouter.ai/api/v1/models';
const PRICING_TTL_MS = 24 * 60 * 60 * 1000;

/** OpenRouter namespaces models by vendor; direct providers map onto those slugs. */
const openRouterPrefixes: Record<Exclude<modelProviderType, 'openrouter'>, string> = {
  google: 'google',
  openai: 'openai',
  anthropic: 'anthropic',
  mistral: 'mistralai',
  deepseek: 'deepseek',
};

/** Matches ids that differ only in separators or a moving alias suffix (gpt-5.6 vs gpt-5-6). */
const normalizeModelId = (id: string) =>
  id
    .toLowerCase()
    .replace(/[._]/g, '-')
    .replace(/-(latest|preview)$/, '');

const toPrice = (value: unknown) => {
  const price = typeof value === 'string' ? Number(value) : value;
  return typeof price === 'number' && Number.isFinite(price) && price >= 0 ? price : undefined;
};

const parsePriceTable = (body: unknown): PriceTable => {
  const entries = (body as { data?: unknown })?.data;
  if (!Array.isArray(entries)) return {};

  const table: PriceTable = {};
  for (const entry of entries) {
    const id = (entry as { id?: unknown })?.id;
    const pricing = (entry as { pricing?: Record<string, unknown> })?.pricing;
    const input = toPrice(pricing?.prompt);
    const output = toPrice(pricing?.completion);
    if (typeof id !== 'string' || input === undefined || output === undefined) continue;
    table[normalizeModelId(id)] = { input, output, cacheRead: toPrice(pricing?.input_cache_read) };
  }
  return table;
};

let pendingTable: Promise<PriceTable> | null = null;

/**
 * Loads public model prices, cached on the device for a day. A failed request is not cached,
 * so the next caller retries.
 */
export const loadPriceTable = () => {
  pendingTable ??= (async () => {
    try {
      const cached = await lforage.getItem<{ fetchedAt: number; prices: PriceTable }>(
        modelPricingKey
      );
      if (cached && Date.now() - cached.fetchedAt < PRICING_TTL_MS) return cached.prices;
    } catch {
      // A broken cache entry only costs a refetch.
    }

    const response = await fetch(PRICING_ENDPOINT);
    if (!response.ok) throw new Error(`Model prices request failed: ${response.status}`);
    const prices = parsePriceTable(await response.json());
    await lforage
      .setItem(modelPricingKey, { fetchedAt: Date.now(), prices })
      .catch(() => undefined);
    return prices;
  })().catch((error) => {
    pendingTable = null;
    throw error;
  });
  return pendingTable;
};

export const resolveModelPrice = (
  table: PriceTable,
  model: string,
  provider: modelProviderType
): ModelPrice | undefined =>
  table[
    normalizeModelId(provider === 'openrouter' ? model : `${openRouterPrefixes[provider]}/${model}`)
  ];

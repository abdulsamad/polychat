export interface ChatResponseMetadata {
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
  };
  finishReason?: string;
  /** Exact request cost in USD when the provider reports it (OpenRouter usage accounting). */
  costUsd?: number;
  responseId?: string;
  modelId?: string;
  timestamp?: string;
}

/** Reads the cost OpenRouter attaches to `finish-step` provider metadata; other providers report none. */
export const getReportedCostUsd = (providerMetadata: unknown): number | undefined => {
  const cost = (providerMetadata as { openrouter?: { usage?: { cost?: unknown } } } | undefined)
    ?.openrouter?.usage?.cost;
  return typeof cost === 'number' && Number.isFinite(cost) ? cost : undefined;
};

export interface GeneratedFileAttachment {
  base64: string;
  mediaType: string;
  name?: string;
}

export type ChatStreamPart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'reasoning-end' }
  | { type: 'file'; file: GeneratedFileAttachment }
  | { type: 'metadata'; metadata: ChatResponseMetadata }
  | { type: 'error'; error: string };

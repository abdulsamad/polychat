export interface ChatResponseMetadata {
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
  };
  finishReason?: string;
  responseId?: string;
  modelId?: string;
  timestamp?: string;
}

export type ChatStreamPart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'reasoning-end' }
  | { type: 'metadata'; metadata: ChatResponseMetadata }
  | { type: 'error'; error: string };

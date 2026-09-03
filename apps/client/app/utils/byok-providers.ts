import { generateImage, streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

import {
  getAssistantConfig,
  supportedModels,
  type availableModelsType,
  type modelProviderType,
} from 'utils';
import type { ByokProvider } from './byok-vault';
import type { ChatResponseMetadata, ChatStreamPart } from './api-calls';

export const providerForModel = (
  model: availableModelsType,
  explicitProvider?: modelProviderType
): ByokProvider => {
  if (explicitProvider) return explicitProvider;
  const definition = supportedModels.find((entry) => entry.name === model);
  if (!definition) throw new Error(`Unsupported model: ${model}`);
  return definition.provider;
};

const createProvider = (provider: ByokProvider, apiKey: string) => {
  switch (provider) {
    case 'google':
      return createGoogleGenerativeAI({ apiKey });
    case 'openai':
      return createOpenAI({ apiKey });
    case 'anthropic':
      return createAnthropic({ apiKey });
    case 'mistral':
      return createMistral({ apiKey });
    case 'deepseek':
      return createDeepSeek({ apiKey });
    case 'openrouter':
      return createOpenRouter({ apiKey });
  }
};

const modelInstance = (
  model: availableModelsType,
  apiKey: string,
  explicitProvider?: modelProviderType
) => {
  const providerName = providerForModel(model, explicitProvider);
  const provider = createProvider(providerName, apiKey) as any;
  return providerName === 'openrouter' ? provider(model) : provider.chat(model);
};

export const streamByokText = async ({
  model,
  provider,
  apiKey,
  profile,
  language,
  prompt,
  messages,
  customInstructions,
  signal,
}: {
  model: availableModelsType;
  provider?: modelProviderType;
  apiKey: string;
  profile: Parameters<typeof getAssistantConfig>[0];
  language: Parameters<typeof getAssistantConfig>[1];
  prompt?: string;
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  customInstructions?: string;
  signal?: AbortSignal;
}): Promise<ReadableStream<ChatStreamPart>> => {
  const config = getAssistantConfig(profile, language, customInstructions);
  const result = streamText({
    model: modelInstance(model, apiKey, provider),
    instructions: config.prompt,
    messages: messages || [{ role: 'user', content: prompt || '' }],
    temperature: config.temperature,
    seed: config.seed,
    tools: config.tools,
    toolChoice: config.toolChoice,
    maxOutputTokens: config.maxTokens,
    topP: config.topP,
    frequencyPenalty: config.frequencyPenalty,
    presencePenalty: config.presencePenalty,
    abortSignal: signal,
    stopSequences: config.stopSequences,
    providerOptions: model.startsWith('gemini')
      ? {
          google: {
            safetySettings: [
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
            ],
          },
        }
      : undefined,
  } as any);

  return new ReadableStream<ChatStreamPart>({
    async start(controller) {
      let responseId: string | undefined;
      let responseModelId: string | undefined;
      let responseTimestamp: string | undefined;
      let finishReason: string | undefined;
      try {
        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') controller.enqueue({ type: 'text', text: part.text });
          else if (part.type === 'finish-step') {
            responseId = part.response.id;
            responseModelId = part.response.modelId;
            responseTimestamp = part.response.timestamp.toISOString();
            finishReason = part.finishReason;
          } else if (part.type === 'finish') {
            const metadata: ChatResponseMetadata = {
              usage: {
                inputTokens: part.totalUsage.inputTokens,
                outputTokens: part.totalUsage.outputTokens,
                totalTokens: part.totalUsage.totalTokens,
                reasoningTokens: part.totalUsage.outputTokenDetails.reasoningTokens,
                cachedInputTokens: part.totalUsage.inputTokenDetails.cacheReadTokens,
              },
              finishReason: finishReason || part.finishReason,
              responseId,
              modelId: responseModelId,
              timestamp: responseTimestamp,
            };
            controller.enqueue({ type: 'metadata', metadata });
          } else if (part.type === 'error') {
            controller.enqueue({ type: 'error', error: 'Provider request failed' });
            controller.close();
            return;
          }
        }
        controller.close();
      } catch {
        controller.enqueue({ type: 'error', error: 'Provider request failed' });
        controller.close();
      }
    },
  });
};

export const generateByokImage = async ({
  model,
  provider,
  apiKey,
  prompt,
  quality,
  style,
  size,
  signal,
}: {
  model: availableModelsType;
  provider?: modelProviderType;
  apiKey: string;
  prompt: string;
  quality: 'standard' | 'hd';
  style: 'vivid' | 'natural';
  size?: string;
  signal?: AbortSignal;
}) => {
  const providerClient = createProvider(providerForModel(model, provider), apiKey) as any;
  const result = await generateImage({
    model: providerClient.imageModel(model),
    prompt,
    n: 1,
    size: size as `${number}x${number}` | undefined,
    aspectRatio: '16:9',
    abortSignal: signal,
    providerOptions: { openai: { style, quality } },
  });
  return { b64_json: result.image.base64 };
};

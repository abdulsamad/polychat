import { generateImage, streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';

import { getAssistantConfig, supportedModels, type availableModelsType } from 'utils';
import type { ByokProvider } from './byok-vault';
import type { ChatResponseMetadata, ChatStreamPart } from './api-calls';

export const providerForModel = (model: availableModelsType): ByokProvider => {
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
  }
};

const modelInstance = (model: availableModelsType, apiKey: string) => {
  const provider = createProvider(providerForModel(model), apiKey) as any;
  return model.startsWith('gpt') || model.startsWith('claude') || model.startsWith('deepseek')
    ? provider.chat(model)
    : model.startsWith('mistral') || model.startsWith('gemini')
      ? provider.chat(model)
      : provider.languageModel(model);
};

export const streamByokText = async ({
  model,
  apiKey,
  profile,
  language,
  prompt,
  messages,
  customInstructions,
}: {
  model: availableModelsType;
  apiKey: string;
  profile: Parameters<typeof getAssistantConfig>[0];
  language: Parameters<typeof getAssistantConfig>[1];
  prompt?: string;
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  customInstructions?: string;
}): Promise<ReadableStream<ChatStreamPart>> => {
  const config = getAssistantConfig(profile, language, customInstructions);
  const result = streamText({
    model: modelInstance(model, apiKey),
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
  apiKey,
  prompt,
  quality,
  style,
  size,
}: {
  model: availableModelsType;
  apiKey: string;
  prompt: string;
  quality: 'standard' | 'hd';
  style: 'vivid' | 'natural';
  size?: string;
}) => {
  const provider = createProvider(providerForModel(model), apiKey) as any;
  const result = await generateImage({
    model: provider.imageModel(model),
    prompt,
    n: 1,
    size: size as `${number}x${number}` | undefined,
    aspectRatio: '16:9',
    providerOptions: { openai: { style, quality } },
  });
  return { b64_json: result.image.base64 };
};

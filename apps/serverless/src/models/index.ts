import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createMistral } from '@ai-sdk/mistral';
import { createDeepSeek } from '@ai-sdk/deepseek';

export const googleClient = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const openAiClient = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const anthropicClient = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const mistralClient = createMistral({
  apiKey: process.env.MISTRAL_API_KEY,
});

export const deepseekClient = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
});

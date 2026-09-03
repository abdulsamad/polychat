import { GoogleGenerativeAIProvider } from '@ai-sdk/google';
import { OpenAIProvider } from '@ai-sdk/openai';
import { AnthropicProvider } from '@ai-sdk/anthropic';
import { MistralProvider } from '@ai-sdk/mistral';
import { DeepSeekProvider } from '@ai-sdk/deepseek';

import { profiles, supportedModels } from './models';
import { languages } from './languages';

// The curated catalog remains literal-friendly, while BYOK model discovery may
// return provider model IDs that are not known at build time.
export type enabledModelsType = (typeof supportedModels)[number]['name'] | (string & {});

export type modelProviderType =
  | 'google'
  | 'openai'
  | 'anthropic'
  | 'mistral'
  | 'deepseek'
  | 'openrouter';

export type availableModelsType =
  | Parameters<GoogleGenerativeAIProvider['chat']>[0]
  | Parameters<OpenAIProvider['chat']>[0]
  | Parameters<AnthropicProvider['languageModel']>[0]
  | Parameters<MistralProvider['chat']>[0]
  | Parameters<DeepSeekProvider['languageModel']>[0]
  | (string & {});

export type supportedLanguagesType = (typeof languages)[number]['code'];

export type profilesType = (typeof profiles)[number]['code'];

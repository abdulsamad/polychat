import { ImageModel, LanguageModel } from 'ai';

import type { availableModelsType } from 'utils';

import {
  googleClient,
  openAiClient,
  anthropicClient,
  mistralClient,
  deepseekClient,
  openRouterClient,
} from '.';

class ModelFactory {
  private static instance: ModelFactory;
  private modelInstances: Map<string, LanguageModel> = new Map();
  private imageModelInstances: Map<string, ImageModel> = new Map();

  private constructor() {
    //
  }

  public static getInstance(): ModelFactory {
    if (!ModelFactory.instance) {
      ModelFactory.instance = new ModelFactory();
    }

    return ModelFactory.instance;
  }

  public createModel(modelName: availableModelsType): LanguageModel {
    const cacheKey = `${modelName}`;

    if (this.modelInstances.has(cacheKey)) {
      return this.modelInstances.get(cacheKey)!;
    }

    let model: LanguageModel;

    switch (true) {
      // Provider-qualified IDs such as deepseek/deepseek-v4-pro are OpenRouter
      // model slugs and must be handled before direct-provider prefixes.
      case modelName.includes('/'): {
        model = openRouterClient(modelName);

        break;
      }

      case modelName.startsWith('gemini'): {
        model = googleClient(modelName);

        break;
      }

      case modelName.startsWith('gpt'): {
        model = openAiClient(modelName);

        break;
      }

      case modelName.startsWith('claude'): {
        model = anthropicClient(modelName);

        break;
      }

      case modelName.startsWith('mistral'): {
        model = mistralClient(modelName);

        break;
      }

      case modelName.startsWith('deepseek'): {
        model = deepseekClient(modelName);

        break;
      }

      default: {
        throw new Error(`Unsupported model: ${modelName}`);
      }
    }

    this.modelInstances.set(cacheKey, model);
    return model;
  }

  public createImageModel(modelName: availableModelsType): ImageModel {
    const cacheKey = `image:${modelName}`;

    if (this.imageModelInstances.has(cacheKey)) {
      return this.imageModelInstances.get(cacheKey)!;
    }

    let model: ImageModel;

    switch (true) {
      case modelName.includes('/'):
        model = openRouterClient.imageModel(modelName);
        break;
      case modelName.startsWith('dall-e') || modelName.startsWith('gpt-image'):
        model = openAiClient.imageModel(modelName);
        break;
      default:
        throw new Error(`Unsupported image model: ${modelName}`);
    }

    this.imageModelInstances.set(cacheKey, model);
    return model;
  }
}

export const modelFactory = ModelFactory.getInstance();

import { LanguageModel } from 'ai';

import type { availableModelsType } from 'utils';

import { googleClient, openAiClient, anthropicClient, mistralClient, deepseekClient } from '.';

class ModelFactory {
  private static instance: ModelFactory;
  private modelInstances: Map<string, LanguageModel> = new Map();

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
}

export const modelFactory = ModelFactory.getInstance();

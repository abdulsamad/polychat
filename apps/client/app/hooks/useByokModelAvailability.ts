import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/react-router';

import {
  supportedModels,
  type ImageModelCapabilities,
  type SupportedModel,
  type modelProviderType,
} from 'utils';

import {
  getProviderKey,
  getVaultSnapshot,
  subscribeVault,
  type ByokProvider,
} from '@/utils/byok-vault';

export type ModelOption = Omit<SupportedModel, 'name' | 'disabled'> & {
  name: string;
  disabled: boolean;
  isDiscovered?: boolean;
  imageCapabilities?: ImageModelCapabilities;
};

interface ProviderModelResponse {
  data?: Array<Record<string, unknown>>;
  models?: Array<Record<string, unknown>>;
  nextPageToken?: string;
}

const hasImageOutput = (entry: Record<string, unknown>) => {
  const architecture = entry.architecture;
  if (architecture && typeof architecture === 'object') {
    const outputModalities = (architecture as { output_modalities?: unknown }).output_modalities;
    if (Array.isArray(outputModalities) && outputModalities.some((value) => value === 'image')) {
      return true;
    }
  }

  const supportedActions = entry.supportedActions;
  return (
    Array.isArray(supportedActions) &&
    supportedActions.some((value) => /image/i.test(String(value)))
  );
};

const hasImageInput = (entry: Record<string, unknown>) => {
  const architecture = entry.architecture;
  if (architecture && typeof architecture === 'object') {
    const inputModalities = (architecture as { input_modalities?: unknown }).input_modalities;
    if (Array.isArray(inputModalities) && inputModalities.some((value) => value === 'image')) {
      return true;
    }
  }

  const inputModalities = entry.input_modalities;
  return Array.isArray(inputModalities) && inputModalities.some((value) => value === 'image');
};

const providerEndpoints: Record<ByokProvider, string> = {
  google: 'https://generativelanguage.googleapis.com/v1beta/models',
  openai: 'https://api.openai.com/v1/models',
  anthropic: 'https://api.anthropic.com/v1/models',
  mistral: 'https://api.mistral.ai/v1/models',
  deepseek: 'https://api.deepseek.com/models',
  openrouter: 'https://openrouter.ai/api/v1/models',
};

const getString = (value: unknown) => (typeof value === 'string' ? value : undefined);

const displayName = (modelId: string) =>
  modelId
    .replace(/^models\//, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());

const hasReasoningModelId = (provider: modelProviderType, modelId: string) => {
  if (provider === 'openai') return /^(?:gpt-5|o\d)/i.test(modelId) && !/chat/i.test(modelId);
  if (provider === 'google') return /gemini-(?:2\.5|3)/i.test(modelId);
  if (provider === 'anthropic') return /claude-(?:3-7|4)/i.test(modelId);
  if (provider === 'deepseek') return /reasoner|reasoning|deepseek-v4/i.test(modelId);
  return /reasoner|reasoning/i.test(modelId);
};

const hasReasoningParameter = (entry: Record<string, unknown>) => {
  const supportedParameters = entry.supported_parameters;
  if (Array.isArray(supportedParameters)) {
    return supportedParameters.some((parameter) => /reason|think/i.test(String(parameter)));
  }
  if (supportedParameters && typeof supportedParameters === 'object') {
    return Object.keys(supportedParameters).some((parameter) => /reason|think/i.test(parameter));
  }
  return Object.keys(entry).some((key) => /reason|think/i.test(key));
};

const toModelOption = (
  provider: modelProviderType,
  modelId: string,
  label?: string,
  imageCapabilities?: ImageModelCapabilities,
  supportsVision = false,
  supportsReasoning = false
): ModelOption => ({
  name: modelId,
  text: label || displayName(modelId),
  type: 'text',
  disabled: false,
  provider,
  isDiscovered: true,
  imageCapabilities,
  supportsVision,
  supportsReasoning,
  supportsFiles: provider === 'google' || provider === 'openai' || provider === 'anthropic',
});

const parseOpenRouterImageModels = (response: ProviderModelResponse): ModelOption[] => {
  const entries = response.data || response.models || [];

  return entries.flatMap((entry) => {
    const modelId = getString(entry.id) || getString(entry.name);
    if (!modelId) return [];

    const supportedParameters = entry.supported_parameters;
    if (!supportedParameters || typeof supportedParameters !== 'object') return [];

    const parameters = supportedParameters as Record<string, unknown>;
    const getEnumValues = (name: string) => {
      const descriptor = parameters[name];
      if (!descriptor || typeof descriptor !== 'object') return undefined;
      const values = (descriptor as { values?: unknown }).values;
      return Array.isArray(values) && values.every((value) => typeof value === 'string')
        ? values
        : undefined;
    };

    const sizes = getEnumValues('size');
    const resolutions = getEnumValues('resolution');
    const aspectRatios = getEnumValues('aspect_ratio');
    const imageCapabilities =
      sizes || resolutions || aspectRatios ? { sizes, resolutions, aspectRatios } : undefined;

    return [
      {
        ...toModelOption(
          'openrouter',
          modelId,
          getString(entry.name),
          imageCapabilities,
          hasImageInput(entry)
        ),
        type: 'image' as const,
      },
    ];
  });
};

const isOpenAITextModel = (modelId: string) =>
  !/(embedding|moderation|tts|whisper|transcri|realtime|audio|dall-e|gpt-image|image|search)/i.test(
    modelId
  );

const isOpenAIImageModel = (modelId: string) => /(dall-e|gpt-image|chatgpt-image)/i.test(modelId);

const isImageModelId = (modelId: string) =>
  /(dall-e|gpt-image|chatgpt-image|imagen|image|nano-banana|flux|stable-diffusion|recraft|ideogram)/i.test(
    modelId
  );

const parseModels = (provider: ByokProvider, response: ProviderModelResponse): ModelOption[] => {
  const entries = response.data || response.models || [];

  return entries.flatMap((entry) => {
    const rawId = getString(entry.id) || getString(entry.name);
    if (!rawId) return [];

    if (provider === 'google') {
      const modelId = rawId.replace(/^models\//, '');
      const actions = Array.isArray(entry.supportedGenerationMethods)
        ? entry.supportedGenerationMethods
        : Array.isArray(entry.supportedActions)
          ? entry.supportedActions
          : [];
      const isImage =
        actions.some((action) => /generateImages?|image/i.test(String(action))) ||
        isImageModelId(modelId);
      if (actions.length && !actions.includes('generateContent') && !isImage) return [];
      return [
        {
          ...toModelOption(
            provider,
            modelId,
            getString(entry.displayName),
            undefined,
            hasImageInput(entry) || /gemini/i.test(modelId),
            hasReasoningModelId(provider, modelId) || hasReasoningParameter(entry)
          ),
          type: isImage ? 'image' : 'text',
        },
      ];
    }

    const isImage =
      (provider === 'openai' && isOpenAIImageModel(rawId)) ||
      (provider !== 'openai' && (hasImageOutput(entry) || isImageModelId(rawId)));

    if (provider === 'openai' && !isOpenAITextModel(rawId) && !isImage) return [];
    if (provider === 'mistral') {
      const capabilities = entry.capabilities;
      if (
        capabilities &&
        typeof capabilities === 'object' &&
        'completion_chat' in capabilities &&
        capabilities.completion_chat !== true
      ) {
        return [];
      }
    }

    return [
      {
        ...toModelOption(
          provider,
          rawId,
          getString(entry.display_name) || getString(entry.name),
          undefined,
          hasImageInput(entry) || (provider === 'openai' && /(gpt-4o|gpt-4\.1|gpt-5)/i.test(rawId)),
          hasReasoningModelId(provider, rawId) || hasReasoningParameter(entry)
        ),
        type: isImage ? 'image' : 'text',
      },
    ];
  });
};

const fetchProviderModels = async (provider: ByokProvider, apiKey: string, signal: AbortSignal) => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  let endpoint = providerEndpoints[provider];

  if (provider === 'google') {
    headers['x-goog-api-key'] = apiKey;
    endpoint += '?pageSize=1000';
  } else if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const models: ModelOption[] = [];
  let pageToken: string | undefined;

  do {
    const pageEndpoint = pageToken
      ? `${endpoint}&pageToken=${encodeURIComponent(pageToken)}`
      : endpoint;
    const response = await fetch(pageEndpoint, { headers, signal });
    if (!response.ok) throw new Error(`Could not list ${provider} models`);
    const page = (await response.json()) as ProviderModelResponse;
    models.push(...parseModels(provider, page));
    pageToken = provider === 'google' ? page.nextPageToken : undefined;
  } while (pageToken);

  if (provider === 'openrouter') {
    const imageResponse = await fetch('https://openrouter.ai/api/v1/images/models', {
      headers,
      signal,
    });
    if (imageResponse.ok) {
      const imagePage = (await imageResponse.json()) as ProviderModelResponse;
      models.push(...parseOpenRouterImageModels(imagePage));
    }
  }

  return models;
};

const catalogOptions = supportedModels.map((model) => ({ ...model })) as ModelOption[];
const imageModelNames = new Set(
  catalogOptions.filter(({ type }) => type === 'image').map(({ name }) => name)
);

export const useByokModelAvailability = () => {
  const { user } = useUser();
  const [vaultVersion, setVaultVersion] = useState(0);
  const [discoveredModels, setDiscoveredModels] = useState<ModelOption[]>([]);

  useEffect(() => subscribeVault(() => setVaultVersion((version) => version + 1)), []);

  useEffect(() => {
    const accountId = user?.id;
    if (!accountId) {
      setDiscoveredModels([]);
      return;
    }

    const controller = new AbortController();
    const providers = getVaultSnapshot(accountId).providers as ByokProvider[];

    setDiscoveredModels([]);
    void Promise.all(
      providers.flatMap((provider) => {
        const apiKey = getProviderKey(accountId, provider);
        return apiKey
          ? fetchProviderModels(provider, apiKey, controller.signal).catch(() => [])
          : [];
      })
    ).then((results) => {
      if (!controller.signal.aborted) setDiscoveredModels(results.flat());
    });

    return () => controller.abort();
  }, [user?.id, vaultVersion]);

  const models = useMemo(() => {
    const catalogNames = new Set(catalogOptions.map(({ name }) => name));
    const discoveredByName = new Map<string, ModelOption>();
    for (const model of discoveredModels) {
      const existing = discoveredByName.get(model.name);
      if (!existing || model.imageCapabilities) discoveredByName.set(model.name, model);
    }

    return [
      ...catalogOptions,
      ...Array.from(discoveredByName.values()).filter(({ name }) => !catalogNames.has(name)),
    ].map((model) => ({
      ...model,
      disabled:
        model.disabled ||
        (model.type === 'image' && !getProviderKey(user?.id || '', model.provider)),
    }));
  }, [discoveredModels, user?.id, vaultVersion]);

  const isModelAvailable = useCallback(
    (model: ModelOption) =>
      Boolean(user?.id && getProviderKey(user.id, model.provider)) ||
      (!model.isDiscovered && !model.disabled && !imageModelNames.has(model.name)),
    [user?.id, vaultVersion]
  );

  const isProviderAvailable = useCallback(
    (provider: modelProviderType) => Boolean(user?.id && getProviderKey(user.id, provider)),
    [user?.id, vaultVersion]
  );

  const findModel = useCallback(
    (modelName: string) => models.find(({ name }) => name === modelName),
    [models]
  );

  return {
    models,
    textModels: models.filter(({ type }) => type === 'text'),
    imageModels: models.filter(({ type }) => type === 'image'),
    findModel,
    isModelAvailable,
    isProviderAvailable,
  };
};

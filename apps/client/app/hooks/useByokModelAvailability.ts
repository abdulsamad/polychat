import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/react-router';

import { supportedModels, type SupportedModel, type modelProviderType } from 'utils';

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
};

interface ProviderModelResponse {
  data?: Array<Record<string, unknown>>;
  models?: Array<Record<string, unknown>>;
  nextPageToken?: string;
}

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

const toModelOption = (
  provider: modelProviderType,
  modelId: string,
  label?: string
): ModelOption => ({
  name: modelId,
  text: label || displayName(modelId),
  type: 'text',
  disabled: false,
  provider,
  isDiscovered: true,
});

const isOpenAITextModel = (modelId: string) =>
  !/(embedding|moderation|tts|whisper|transcri|realtime|audio|dall-e|image|search)/i.test(modelId);

const parseModels = (
  provider: ByokProvider,
  response: ProviderModelResponse
): ModelOption[] => {
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
      if (actions.length && !actions.includes('generateContent')) return [];
      return [toModelOption(provider, modelId, getString(entry.displayName))];
    }

    if (provider === 'openai' && !isOpenAITextModel(rawId)) return [];
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
      toModelOption(provider, rawId, getString(entry.display_name) || getString(entry.name)),
    ];
  });
};

const fetchProviderModels = async (
  provider: ByokProvider,
  apiKey: string,
  signal: AbortSignal
) => {
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

  return models;
};

const catalogOptions = supportedModels.map((model) => ({ ...model })) as ModelOption[];

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
    return [...catalogOptions, ...discoveredModels.filter(({ name }) => !catalogNames.has(name))];
  }, [discoveredModels]);

  const isModelAvailable = useCallback(
    (model: ModelOption) =>
      Boolean(user?.id && getProviderKey(user.id, model.provider)) ||
      (!model.isDiscovered && !model.disabled),
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

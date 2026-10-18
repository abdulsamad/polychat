import { getDefaultModelConfig, profiles, type profilesType } from 'utils';
import type { IBaseModelConfig } from '@/store';
import type { CompareSlotSettings } from './lforage';

/** Text models share one default config; overrides are compared against it. */
const textDefaults = getDefaultModelConfig('') as IBaseModelConfig;
export const DEFAULT_TEMPERATURE = textDefaults.temperature ?? 0.5;
export const DEFAULT_MAX_TOKENS = textDefaults.maxTokens ?? 3000;
export const DEFAULT_PROFILE: profilesType = 'normal';

export const maxTokenOptions = [1000, 3000, 8000, 16000] as const;
/** The custom profile needs per-user instructions, so compare offers only the preset profiles. */
export const compareProfiles = profiles.filter(({ code }) => code !== 'custom');

/** Drops values equal to the defaults, so equal configurations always compare equal. */
export const normalizeSettings = (settings?: CompareSlotSettings): CompareSlotSettings => {
  const normalized: CompareSlotSettings = {};
  if (settings?.temperature !== undefined && settings.temperature !== DEFAULT_TEMPERATURE) {
    normalized.temperature = Math.round(settings.temperature * 10) / 10;
  }
  if (settings?.maxTokens !== undefined && settings.maxTokens !== DEFAULT_MAX_TOKENS) {
    normalized.maxTokens = settings.maxTokens;
  }
  if (settings?.profile && settings.profile !== DEFAULT_PROFILE) {
    normalized.profile = settings.profile;
  }
  return normalized;
};

export const hasCustomSettings = (settings?: CompareSlotSettings) =>
  Object.keys(normalizeSettings(settings)).length > 0;

/** Identity of a model configuration: two slots with the same key would produce the same run. */
export const configurationKey = (model: string, settings?: CompareSlotSettings) => {
  const { temperature, maxTokens, profile } = normalizeSettings(settings);
  return JSON.stringify([model, temperature ?? null, maxTokens ?? null, profile ?? null]);
};

const compactTokens = (value: number) => (value >= 1000 ? `${value / 1000}k` : String(value));

/** Short chip text such as "t 0.9 - 8k - Teacher"; empty for defaults. */
export const describeSettings = (settings?: CompareSlotSettings) => {
  const { temperature, maxTokens, profile } = normalizeSettings(settings);
  return [
    temperature !== undefined && `t ${temperature.toFixed(1)}`,
    maxTokens !== undefined && `${compactTokens(maxTokens)} max`,
    profile && profiles.find(({ code }) => code === profile)?.text,
  ]
    .filter(Boolean)
    .join(' - ');
};

/** The request config for one column: the model defaults with the slot's overrides applied. */
export const toModelConfig = (model: string, settings?: CompareSlotSettings): IBaseModelConfig => {
  const { temperature, maxTokens } = normalizeSettings(settings);
  return {
    ...(getDefaultModelConfig(model) as IBaseModelConfig),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxTokens !== undefined ? { maxTokens } : {}),
  };
};

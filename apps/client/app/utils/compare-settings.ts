import { getDefaultModelConfig, imageSizes, profiles, type profilesType } from 'utils';
import type { IBaseModelConfig } from '@/store';
import type { ModelOption } from '@/hooks/useByokModelAvailability';
import type { CompareSlotSettings } from './lforage';
import { getVideoSettingOptions } from './video-settings';

/** Text models share one default config; overrides are compared against it. */
const textDefaults = getDefaultModelConfig('') as IBaseModelConfig;
export const DEFAULT_TEMPERATURE = textDefaults.temperature ?? 0.5;
export const DEFAULT_MAX_TOKENS = textDefaults.maxTokens ?? 3000;
export const DEFAULT_PROFILE: profilesType = 'normal';

export const maxTokenOptions = [1000, 3000, 8000, 16000] as const;
/** The custom profile needs per-user instructions, so compare offers only the preset profiles. */
export const compareProfiles = profiles.filter(({ code }) => code !== 'custom');

/** The parts of a model option that decide which slot settings apply and their defaults. */
export type SlotModel = Pick<
  ModelOption,
  'name' | 'type' | 'imageCapabilities' | 'videoCapabilities'
>;

const mediaSettingKeys = [
  'size',
  'quality',
  'style',
  'duration',
  'resolution',
  'aspectRatio',
  'generateAudio',
] as const;
type MediaSettings = Pick<CompareSlotSettings, (typeof mediaSettingKeys)[number]>;

/** The values a media model offers for each of its slot settings. */
export const getMediaSettingOptions = ({
  name,
  type,
  imageCapabilities,
  videoCapabilities,
}: SlotModel) => ({
  sizes: type === 'image' ? imageSizes(name, imageCapabilities).options : [],
  /** Only DALL-E 3 takes quality and style, matching the chat thread settings. */
  hasQualityAndStyle: type === 'image' && name === 'dall-e-3',
  ...(type === 'video'
    ? getVideoSettingOptions(videoCapabilities)
    : { durations: [], resolutions: [], aspectRatios: [] }),
  canGenerateAudio: type === 'video' && videoCapabilities?.generateAudio !== false,
});

/** What a media model generates with when a slot overrides nothing; empty for text models. */
export const getMediaDefaults = (model: SlotModel): MediaSettings => {
  if (model.type === 'image') {
    const size = imageSizes(model.name, model.imageCapabilities).default;
    return model.name === 'dall-e-3' ? { size, quality: 'standard', style: 'vivid' } : { size };
  }
  if (model.type === 'video') {
    const { durations, resolutions, aspectRatios } = getVideoSettingOptions(
      model.videoCapabilities
    );
    return {
      duration: durations[0],
      resolution: resolutions[0],
      aspectRatio: aspectRatios[0],
      generateAudio: model.videoCapabilities?.generateAudio ?? false,
    };
  }
  return {};
};

/** True when the model can take this value, so a slot never keeps one its new model lacks. */
const isSupported = (
  options: ReturnType<typeof getMediaSettingOptions>,
  key: keyof MediaSettings,
  value: MediaSettings[keyof MediaSettings]
) => {
  switch (key) {
    case 'size':
      return options.sizes.includes(value as string);
    case 'quality':
    case 'style':
      return options.hasQualityAndStyle;
    case 'duration':
      return options.durations.includes(value as number);
    case 'resolution':
      return options.resolutions.includes(value as string);
    case 'aspectRatio':
      return options.aspectRatios.includes(value as string);
    case 'generateAudio':
      return options.canGenerateAudio || value === false;
  }
};

/**
 * Drops values equal to the defaults, so equal configurations always compare equal. Given the
 * model, only its type's settings are kept, compared against its own defaults, and values it
 * does not offer are dropped. Without a model the settings are taken as already normalized.
 */
export const normalizeSettings = (
  settings?: CompareSlotSettings,
  model?: SlotModel
): CompareSlotSettings => {
  const normalized: CompareSlotSettings = {};
  if (!model || model.type === 'text') {
    if (settings?.temperature !== undefined && settings.temperature !== DEFAULT_TEMPERATURE) {
      normalized.temperature = Math.round(settings.temperature * 10) / 10;
    }
    if (settings?.maxTokens !== undefined && settings.maxTokens !== DEFAULT_MAX_TOKENS) {
      normalized.maxTokens = settings.maxTokens;
    }
    if (settings?.profile && settings.profile !== DEFAULT_PROFILE) {
      normalized.profile = settings.profile;
    }
  }
  if (!model || model.type !== 'text') {
    const defaults = model ? getMediaDefaults(model) : {};
    const options = model && getMediaSettingOptions(model);
    const media: Record<string, MediaSettings[keyof MediaSettings]> = {};
    for (const key of mediaSettingKeys) {
      const value = settings?.[key];
      if (value === undefined || value === defaults[key]) continue;
      if (options && !isSupported(options, key, value)) continue;
      media[key] = value;
    }
    Object.assign(normalized, media);
  }
  return normalized;
};

export const hasCustomSettings = (settings?: CompareSlotSettings) =>
  Object.keys(normalizeSettings(settings)).length > 0;

/** Identity of a model configuration: two slots with the same key would produce the same run. */
export const configurationKey = (model: string, settings?: CompareSlotSettings) => {
  const normalized = normalizeSettings(settings);
  return JSON.stringify([
    model,
    normalized.temperature ?? null,
    normalized.maxTokens ?? null,
    normalized.profile ?? null,
    ...mediaSettingKeys.map((key) => normalized[key] ?? null),
  ]);
};

const compactTokens = (value: number) => (value >= 1000 ? `${value / 1000}k` : String(value));

/** Short chip text such as "t 0.9 - 8k - Teacher" or "1024x1024 - HD"; empty for defaults. */
export const describeSettings = (settings?: CompareSlotSettings) => {
  const normalized = normalizeSettings(settings);
  const { temperature, maxTokens, profile } = normalized;
  return [
    temperature !== undefined && `t ${temperature.toFixed(1)}`,
    maxTokens !== undefined && `${compactTokens(maxTokens)} max`,
    profile && profiles.find(({ code }) => code === profile)?.text,
    normalized.size,
    normalized.quality === 'hd' ? 'HD' : normalized.quality && 'Standard',
    normalized.style && (normalized.style === 'vivid' ? 'Vivid' : 'Natural'),
    normalized.duration !== undefined && `${normalized.duration}s`,
    normalized.resolution,
    normalized.aspectRatio,
    normalized.generateAudio !== undefined && (normalized.generateAudio ? 'audio' : 'no audio'),
  ]
    .filter(Boolean)
    .join(' - ');
};

/** The request config for one column: the model defaults with the slot's overrides applied. */
export const toModelConfig = (
  model: SlotModel,
  settings?: CompareSlotSettings
): IBaseModelConfig & MediaSettings => {
  const normalized = normalizeSettings(settings, model);
  if (model.type !== 'text') return { ...getMediaDefaults(model), ...normalized };
  const { temperature, maxTokens } = normalized;
  return {
    ...(getDefaultModelConfig(model.name) as IBaseModelConfig),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxTokens !== undefined ? { maxTokens } : {}),
  };
};

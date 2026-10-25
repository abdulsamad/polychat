import { useId } from 'react';
import { SlidersHorizontalIcon } from 'lucide-react';

import type { profilesType } from 'utils';
import { cn } from '@/utils';
import {
  compareProfiles,
  DEFAULT_MAX_TOKENS,
  DEFAULT_PROFILE,
  DEFAULT_TEMPERATURE,
  getMediaDefaults,
  getMediaSettingOptions,
  hasCustomSettings,
  maxTokenOptions,
  normalizeSettings,
  type SlotModel,
} from '@/utils/compare-settings';
import type { CompareSlotSettings } from '@/utils/lforage';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

export const MAX_SAMPLES = 3;

interface SlotSettingsPopoverProps {
  label: string;
  /** The slot's model, which decides the settings shown; text settings when unknown. */
  model?: SlotModel;
  settings?: CompareSlotSettings;
  samples: number;
  /** Highest sample count that still fits in the column budget. */
  maxSamples: number;
  disabled?: boolean;
  onChange: (next: { settings: CompareSlotSettings; samples: number }) => void;
}

const segmentClass = (isSelected: boolean) =>
  cn(
    'h-8 rounded-full px-0 tabular-nums text-muted-foreground hover:bg-background/60 hover:text-foreground',
    isSelected &&
      'bg-background text-foreground shadow-sm hover:bg-background dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent'
  );

/** A labeled pill group for a setting with a few fixed choices. */
const SegmentedSetting = <T extends string | boolean>({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; text: string }>;
  onSelect: (value: T) => void;
}) => (
  <div className="flex flex-col gap-1 px-1">
    <p className="text-xs font-medium text-foreground">{label}</p>
    <div
      role="group"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-full bg-muted p-0.5">
      {options.map((option) => (
        <Button
          key={String(option.value)}
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={value === option.value}
          className={segmentClass(value === option.value)}
          onClick={() => onSelect(option.value)}>
          {option.text}
        </Button>
      ))}
    </div>
  </div>
);

/** A labeled select for a setting whose choices depend on the model. */
const SelectSetting = ({
  label,
  value,
  options,
  format = (option) => option,
  onSelect,
}: {
  label: string;
  value: string;
  options: readonly string[];
  format?: (option: string) => string;
  onSelect: (value: string) => void;
}) => {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1 px-1">
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={onSelect}>
        <SelectTrigger id={id} className="h-9 rounded-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {format(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

/**
 * Per-slot overrides and how many samples to run. Text models tune temperature, output limit
 * and profile; image and video models choose their output, matching the chat thread settings.
 */
const SlotSettingsPopover = ({
  label,
  model,
  settings,
  samples,
  maxSamples,
  disabled,
  onChange,
}: SlotSettingsPopoverProps) => {
  const temperatureId = useId();
  const profileId = useId();
  const type = model?.type ?? 'text';
  const temperature = settings?.temperature ?? DEFAULT_TEMPERATURE;
  const maxTokens = settings?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const profile = settings?.profile ?? DEFAULT_PROFILE;
  const mediaDefaults = model ? getMediaDefaults(model) : {};
  const mediaOptions = model && type !== 'text' ? getMediaSettingOptions(model) : undefined;
  const media = { ...mediaDefaults, ...settings };
  const isCustomized = hasCustomSettings(settings) || samples > 1;
  const update = (patch: Partial<CompareSlotSettings>, nextSamples = samples) =>
    onChange({
      settings: normalizeSettings({ ...settings, ...patch }, model),
      samples: nextSamples,
    });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={`Settings for ${label}${isCustomized ? ' (customized)' : ''}`}
          title="Model settings"
          className={cn(
            'relative size-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground',
            isCustomized && 'text-primary'
          )}>
          <SlidersHorizontalIcon className="size-4" />
          {isCustomized && (
            <span
              aria-hidden="true"
              className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary duration-150 ease-[var(--ease-out)] animate-in fade-in-0 motion-safe:zoom-in-90"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-72 flex-col gap-3 rounded-2xl p-3">
        <div className="px-1">
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">Applies to this slot only.</p>
        </div>

        {type === 'text' && (
          <>
            <div className="flex flex-col gap-2 px-1">
              <div className="flex items-center justify-between">
                <label htmlFor={temperatureId} className="text-xs font-medium text-foreground">
                  Temperature
                </label>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {temperature.toFixed(1)}
                </span>
              </div>
              <Slider
                id={temperatureId}
                min={0}
                max={2}
                step={0.1}
                value={[temperature]}
                aria-label="Temperature"
                onValueChange={([value]) => update({ temperature: value })}
              />
              <p className="flex justify-between text-[0.6875rem] text-muted-foreground">
                <span>Focused</span>
                <span>Creative</span>
              </p>
            </div>

            <div className="flex flex-col gap-1 px-1">
              <p className="text-xs font-medium text-foreground">Max output tokens</p>
              <div
                role="group"
                aria-label="Max output tokens"
                className="grid grid-cols-4 gap-0.5 rounded-full bg-muted p-0.5">
                {maxTokenOptions.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-pressed={maxTokens === option}
                    className={segmentClass(maxTokens === option)}
                    onClick={() => update({ maxTokens: option })}>
                    {option / 1000}k
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1 px-1">
              <label htmlFor={profileId} className="text-xs font-medium text-foreground">
                Profile
              </label>
              <Select
                value={profile}
                onValueChange={(value) => update({ profile: value as profilesType })}>
                <SelectTrigger id={profileId} className="h-9 rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {compareProfiles.map(({ code, text }) => (
                    <SelectItem key={code} value={code}>
                      {text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {type === 'image' && mediaOptions && (
          <>
            {mediaOptions.sizes.length > 0 && (
              <SelectSetting
                label="Image size"
                value={media.size ?? mediaOptions.sizes[0]}
                options={mediaOptions.sizes}
                onSelect={(size) => update({ size })}
              />
            )}
            {mediaOptions.hasQualityAndStyle && (
              <>
                <SegmentedSetting
                  label="Quality"
                  value={media.quality ?? 'standard'}
                  options={[
                    { value: 'standard', text: 'Standard' },
                    { value: 'hd', text: 'HD' },
                  ]}
                  onSelect={(quality) => update({ quality })}
                />
                <SegmentedSetting
                  label="Style"
                  value={media.style ?? 'vivid'}
                  options={[
                    { value: 'vivid', text: 'Vivid' },
                    { value: 'natural', text: 'Natural' },
                  ]}
                  onSelect={(style) => update({ style })}
                />
              </>
            )}
          </>
        )}

        {type === 'video' && mediaOptions && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <SelectSetting
                label="Duration"
                value={String(media.duration ?? mediaOptions.durations[0])}
                options={mediaOptions.durations.map(String)}
                format={(value) => `${value}s`}
                onSelect={(value) => update({ duration: Number(value) })}
              />
              <SelectSetting
                label="Resolution"
                value={media.resolution ?? mediaOptions.resolutions[0]}
                options={mediaOptions.resolutions}
                onSelect={(resolution) => update({ resolution })}
              />
            </div>
            <SelectSetting
              label="Aspect ratio"
              value={media.aspectRatio ?? mediaOptions.aspectRatios[0]}
              options={mediaOptions.aspectRatios}
              onSelect={(aspectRatio) => update({ aspectRatio })}
            />
            {mediaOptions.canGenerateAudio && (
              <SegmentedSetting
                label="Audio"
                value={media.generateAudio ?? false}
                options={[
                  { value: false, text: 'Off' },
                  { value: true, text: 'On' },
                ]}
                onSelect={(generateAudio) => update({ generateAudio })}
              />
            )}
          </>
        )}

        <div className="flex flex-col gap-1 px-1">
          <p className="text-xs font-medium text-foreground">Samples</p>
          <div
            role="group"
            aria-label="Samples"
            className="grid grid-cols-3 gap-0.5 rounded-full bg-muted p-0.5">
            {Array.from({ length: MAX_SAMPLES }, (_, index) => index + 1).map((count) => (
              <Button
                key={count}
                type="button"
                variant="ghost"
                size="sm"
                aria-pressed={samples === count}
                disabled={count > maxSamples}
                className={segmentClass(samples === count)}
                onClick={() => update({}, count)}>
                {count === 1 ? 'Once' : `x${count}`}
              </Button>
            ))}
          </div>
          <p className="text-[0.6875rem] text-pretty text-muted-foreground">
            Runs this configuration in several columns to check consistency. Up to four columns in
            total.
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!isCustomized}
          className="h-9 self-end rounded-full px-3 text-muted-foreground hover:text-foreground"
          onClick={() => onChange({ settings: {}, samples: 1 })}>
          Reset to defaults
        </Button>
      </PopoverContent>
    </Popover>
  );
};

export default SlotSettingsPopover;

import { useId } from 'react';
import { SlidersHorizontalIcon } from 'lucide-react';

import type { profilesType } from 'utils';
import { cn } from '@/utils';
import {
  compareProfiles,
  DEFAULT_MAX_TOKENS,
  DEFAULT_PROFILE,
  DEFAULT_TEMPERATURE,
  hasCustomSettings,
  maxTokenOptions,
  normalizeSettings,
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

/** Per-slot overrides: temperature, output limit, profile, and how many samples to run. */
const SlotSettingsPopover = ({
  label,
  settings,
  samples,
  maxSamples,
  disabled,
  onChange,
}: SlotSettingsPopoverProps) => {
  const temperatureId = useId();
  const profileId = useId();
  const temperature = settings?.temperature ?? DEFAULT_TEMPERATURE;
  const maxTokens = settings?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const profile = settings?.profile ?? DEFAULT_PROFILE;
  const isCustomized = hasCustomSettings(settings) || samples > 1;
  const update = (patch: Partial<CompareSlotSettings>, nextSamples = samples) =>
    onChange({ settings: normalizeSettings({ ...settings, ...patch }), samples: nextSamples });

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

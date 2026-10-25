import { SlidersHorizontalIcon } from 'lucide-react';
import { toast } from 'sonner';

import type { enabledModelsType } from 'utils';
import { getDefaultModelConfig, imageSizes, profileGroups } from 'utils';

import type { IThreadSettings } from '@/store';
import { setUserSettings } from '@/utils/lforage';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ModelCombobox } from '@/components/ModelCombobox';
import type { useByokModelAvailability } from '@/hooks/useByokModelAvailability';

type ModelAvailability = ReturnType<typeof useByokModelAvailability>;

interface ThreadDefaultsSectionProps {
  threadSettings: IThreadSettings<enabledModelsType>;
  setThreadSettings: (settings: IThreadSettings<enabledModelsType>) => void;
  isLoading: boolean;
  models: ModelAvailability['models'];
  findModel: ModelAvailability['findModel'];
  customInstructions: string;
  onAddProviderKey: () => void;
}

const ThreadDefaultsSection = ({
  threadSettings,
  setThreadSettings,
  isLoading,
  models,
  findModel,
  customInstructions,
  onAddProviderKey,
}: ThreadDefaultsSectionProps) => {
  const updateThreadSetting = async <K extends keyof IThreadSettings<enabledModelsType>>(
    key: K,
    value: IThreadSettings<enabledModelsType>[K]
  ) => {
    const nextSettings = { ...threadSettings, [key]: value };
    if (key === 'model') {
      const selectedModel = findModel(String(value));
      nextSettings.modelProvider = selectedModel?.provider;
      nextSettings.modelType = selectedModel?.type;
      nextSettings.modelConfig = getDefaultModelConfig(
        String(value),
        selectedModel?.imageCapabilities,
        selectedModel?.videoCapabilities
      ) as IThreadSettings<enabledModelsType>['modelConfig'];
    }
    setThreadSettings(nextSettings);
    try {
      await setUserSettings(nextSettings);
      toast.success('Settings updated');
    } catch (error) {
      console.error('Failed to save user settings', error);
      toast.error('Could not save settings');
    }
  };

  const defaultModelOption = findModel(threadSettings.model);
  const defaultModelType = defaultModelOption?.type || threadSettings.modelType || 'text';
  const defaultIsTextModel = defaultModelType === 'text';
  const defaultIsImageModel = defaultModelType === 'image';
  const defaultIsVideoModel = defaultModelType === 'video';
  const defaultImageSizeConfig = imageSizes(
    threadSettings.model,
    defaultModelOption?.imageCapabilities
  );
  const defaultVideoCapabilities = defaultModelOption?.videoCapabilities;
  const defaultDurationOptions = defaultVideoCapabilities?.durations?.length
    ? defaultVideoCapabilities.durations
    : [4, 5, 6, 8, 10, 15];
  const defaultResolutionOptions = defaultVideoCapabilities?.resolutions?.length
    ? defaultVideoCapabilities.resolutions
    : ['480p', '720p', '1080p'];
  const defaultAspectRatioOptions = defaultVideoCapabilities?.aspectRatios?.length
    ? defaultVideoCapabilities.aspectRatios
    : ['16:9', '9:16', '1:1'];
  const updateDefaultModelConfig = (update: Record<string, unknown>) =>
    void updateThreadSetting('modelConfig', {
      ...threadSettings.modelConfig,
      ...update,
    } as IThreadSettings<enabledModelsType>['modelConfig']);

  return (
    <section className="rounded-xl border border-primary/20 bg-primary/[0.035] p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <SlidersHorizontalIcon className="size-4" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">New thread defaults</h2>
            <Badge
              variant="outline"
              className="rounded-full border-border bg-muted px-1.5 py-0 text-[10px] text-foreground">
              New chats
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            These settings apply to future conversations.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground">Model</label>
          <ModelCombobox
            models={models}
            value={threadSettings.model}
            disabled={isLoading}
            className="bg-background/70"
            onAddProviderKey={onAddProviderKey}
            onValueChange={(model) =>
              void updateThreadSetting(
                'model',
                model as IThreadSettings<enabledModelsType>['model']
              )
            }
          />
        </div>
        {defaultIsTextModel && (
          <div className="grid gap-2">
            <label className="text-xs font-medium text-muted-foreground">Assistant profile</label>
            <Select
              disabled={isLoading}
              value={threadSettings.profile}
              onValueChange={(profile) =>
                void updateThreadSetting(
                  'profile',
                  profile as IThreadSettings<enabledModelsType>['profile']
                )
              }>
              <SelectTrigger className="bg-background/70">
                <SelectValue placeholder="Profile" />
              </SelectTrigger>
              <SelectContent>
                {profileGroups.map(([category, items]) => (
                  <SelectGroup key={category}>
                    <SelectLabel className="capitalize">{category}</SelectLabel>
                    {items.map(({ code, text }) => (
                      <SelectItem
                        key={code}
                        value={code}
                        disabled={code === 'custom' && !customInstructions.trim()}>
                        {text}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {defaultIsImageModel && (
        <div className="mt-4 grid gap-2">
          <label className="text-xs font-medium text-muted-foreground">Image size</label>
          <Select
            value={
              defaultImageSizeConfig.options.includes(
                ('size' in threadSettings.modelConfig
                  ? threadSettings.modelConfig.size
                  : '') as string
              )
                ? (threadSettings.modelConfig as { size: string }).size
                : defaultImageSizeConfig.default
            }
            onValueChange={(value) => updateDefaultModelConfig({ size: value })}>
            <SelectTrigger className="bg-background/70">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {defaultImageSizeConfig.options.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {defaultIsVideoModel && (
        <div className="mt-4 grid gap-3 rounded-xl border border-border/60 bg-background/60 p-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Duration
            <Select
              value={String(threadSettings.modelConfig.duration ?? defaultDurationOptions[0])}
              onValueChange={(value) => updateDefaultModelConfig({ duration: Number(value) })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {defaultDurationOptions.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value}s
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Resolution
            <Select
              value={threadSettings.modelConfig.resolution ?? defaultResolutionOptions[0]}
              onValueChange={(value) => updateDefaultModelConfig({ resolution: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {defaultResolutionOptions.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground sm:col-span-2">
            Aspect ratio
            <Select
              value={threadSettings.modelConfig.aspectRatio ?? defaultAspectRatioOptions[0]}
              onValueChange={(value) => updateDefaultModelConfig({ aspectRatio: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {defaultAspectRatioOptions.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
            Generate audio
            <Checkbox
              checked={
                threadSettings.modelConfig.generateAudio ??
                defaultVideoCapabilities?.generateAudio ??
                false
              }
              disabled={defaultVideoCapabilities?.generateAudio === false}
              onCheckedChange={(value) =>
                updateDefaultModelConfig({ generateAudio: value === true })
              }
            />
          </label>
        </div>
      )}

      {defaultIsTextModel && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            {
              id: 'default-context-mode',
              label: 'Context',
              checked: threadSettings.conversationContextMode === 'multi-turn',
              onCheckedChange: (checked: boolean) =>
                void updateThreadSetting(
                  'conversationContextMode',
                  checked ? 'multi-turn' : 'single-turn'
                ),
            },
            {
              id: 'default-speech',
              label: 'Speak results',
              checked: threadSettings.isTextToSpeechEnabled,
              onCheckedChange: (checked: boolean) =>
                void updateThreadSetting('isTextToSpeechEnabled', checked),
            },
            {
              id: 'default-usage',
              label: 'Detailed usage',
              checked: threadSettings.showDetailedUsage,
              onCheckedChange: (checked: boolean) =>
                void updateThreadSetting('showDetailedUsage', checked),
            },
          ].map(({ id, label, checked, onCheckedChange }) => (
            <label
              key={id}
              htmlFor={id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 text-xs font-medium transition-colors hover:bg-accent/60">
              <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={(value) => onCheckedChange(value === true)}
              />
              {label}
            </label>
          ))}
        </div>
      )}
    </section>
  );
};

export default ThreadDefaultsSection;

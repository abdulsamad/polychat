import { useCallback, useEffect, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { SlidersHorizontal } from 'lucide-react';

import { getDefaultModelConfig, profileGroups, imageSizes } from 'utils';

import {
  configAtom,
  threadAtom,
  updateThreadSettingsAtom,
  threadSettingsOpenAtom,
  userSettingsOpenAtom,
  userSettingsScrollTargetAtom,
  type UserSettingsScrollTarget,
} from '@/store';
import { IS_SPEECH_SYNTHESIS_SUPPORTED } from '@/utils';
import { useByokModelAvailability } from '@/hooks/useByokModelAvailability';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuArrow,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const SettingsDropdown = () => {
  const [config, setConfig] = useAtom(configAtom);
  const thread = useAtomValue(threadAtom);
  const updateThreadSettings = useSetAtom(updateThreadSettingsAtom);
  const [isThreadSettingsOpen, setThreadSettingsOpen] = useAtom(threadSettingsOpenAtom);
  const setUserSettingsOpen = useSetAtom(userSettingsOpenAtom);
  const setUserSettingsScrollTarget = useSetAtom(userSettingsScrollTargetAtom);
  const { models, findModel, isProviderAvailable } = useByokModelAvailability();
  const [pendingUserSettingsTarget, setPendingUserSettingsTarget] =
    useState<UserSettingsScrollTarget | null>(null);

  const customInstructions = config.customInstructions || '';

  const openUserSettings = useCallback(
    (target: UserSettingsScrollTarget) => {
      setThreadSettingsOpen(false);
      setPendingUserSettingsTarget(target);
    },
    [setThreadSettingsOpen]
  );

  useEffect(() => {
    if (isThreadSettingsOpen || !pendingUserSettingsTarget) return;

    const frame = requestAnimationFrame(() => {
      setUserSettingsScrollTarget(pendingUserSettingsTarget);
      setUserSettingsOpen(true);
      setPendingUserSettingsTarget(null);
    });

    return () => cancelAnimationFrame(frame);
  }, [
    isThreadSettingsOpen,
    pendingUserSettingsTarget,
    setUserSettingsOpen,
    setUserSettingsScrollTarget,
  ]);

  const updateSetting = useCallback(
    (name: string, value: string) => {
      if (!thread) return null;

      if (name === 'model' || name === 'profile') {
        const selectedModel = name === 'model' ? findModel(value) : undefined;
        updateThreadSettings({
          [name]: value,
          ...(name === 'model'
            ? {
                modelProvider: selectedModel?.provider,
                modelType: selectedModel?.type,
                modelConfig: getDefaultModelConfig(
                  value,
                  selectedModel?.imageCapabilities,
                  selectedModel?.videoCapabilities
                ),
              }
            : {}),
        } as Parameters<typeof updateThreadSettings>[0]);
      } else {
        setConfig({ ...config, [name]: value } as typeof config);
      }
    },
    [config, findModel, setConfig, thread, updateThreadSettings]
  );

  const updateCheckSetting = useCallback(
    (name: string, checked: boolean) => {
      if (!thread) return null;

      updateThreadSettings({ [name]: checked });
    },
    [thread, updateThreadSettings]
  );

  if (!thread) return null;

  const {
    settings: {
      model,
      profile,
      conversationContextMode,
      isTextToSpeechEnabled,
      showDetailedUsage,
      modelConfig,
    },
  } = thread!;
  const selectedModel = findModel(model);
  const modelType = selectedModel?.type || thread.settings.modelType || 'text';
  const isImageModelSelected = modelType === 'image';
  const isVideoModelSelected = modelType === 'video';
  const isTextModelSelected = modelType === 'text';
  const isDallE3Selected = model === 'dall-e-3';
  const isByokModelAvailable = Boolean(
    selectedModel && isProviderAvailable(selectedModel.provider)
  );
  const imageSize =
    'size' in modelConfig && typeof modelConfig.size === 'string' ? modelConfig.size : undefined;
  const imageSizeConfig = imageSizes(model, selectedModel?.imageCapabilities);
  const selectedImageSize = imageSizeConfig.options.includes(imageSize || '')
    ? imageSize
    : imageSizeConfig.default;
  const videoCapabilities = selectedModel?.videoCapabilities;
  const durationOptions = videoCapabilities?.durations?.length
    ? videoCapabilities.durations
    : [4, 5, 6, 8, 10, 15];
  const resolutionOptions = videoCapabilities?.resolutions?.length
    ? videoCapabilities.resolutions
    : ['480p', '720p', '1080p'];
  const aspectRatioOptions = videoCapabilities?.aspectRatios?.length
    ? videoCapabilities.aspectRatios
    : ['16:9', '9:16', '1:1'];
  const updateModelConfig = (update: Record<string, unknown>) =>
    updateThreadSettings({ modelConfig: { ...modelConfig, ...update } } as Parameters<
      typeof updateThreadSettings
    >[0]);

  return (
    <DropdownMenu open={isThreadSettingsOpen} onOpenChange={setThreadSettingsOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <SlidersHorizontal className="size-[18px]" />
          <span className="sr-only">Open thread settings</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[calc(100vw-1rem)] max-w-sm rounded-2xl border-border/70 bg-popover/95 p-0 shadow-xl backdrop-blur"
        align="end"
        onPointerDownOutside={(event) => {
          if ((event.target as HTMLElement).closest('[data-model-combobox-popover]')) {
            event.preventDefault();
          }
        }}>
        <DropdownMenuArrow className="fill-popover stroke-border" />
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <SlidersHorizontal className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Thread settings</p>
            <p className="truncate text-xs text-muted-foreground">
              Tune how this conversation responds
            </p>
          </div>
        </div>
        <ul className="space-y-5 p-4">
          <li>
            <div className="flex flex-col space-y-2">
              <label className="ml-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Model
              </label>
              <ModelCombobox
                models={models}
                value={model}
                onValueChange={(value) => updateSetting('model', value)}
                placeholder="Model"
              />
            </div>
          </li>
          {isTextModelSelected && (
            <>
              <li>
                <div className="flex flex-col space-y-2">
                  <label className="ml-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Assistant profile
                  </label>
                  <Select
                    value={profile}
                    onValueChange={(value) => updateSetting('profile', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Assistant profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {profileGroups.map(([category, items]) => (
                        <SelectGroup key={category}>
                          <SelectLabel className="text-muted-foreground capitalize">
                            {category}
                          </SelectLabel>
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
                  {!customInstructions.trim() || profile === 'custom' ? (
                    <p className="px-1 text-xs text-muted-foreground">
                      {customInstructions.trim()
                        ? 'Custom instructions are managed in '
                        : 'Custom profile is disabled until you add instructions in '}
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs font-medium"
                        onClick={() => openUserSettings('custom-instructions')}>
                        Settings
                      </Button>
                      .
                    </p>
                  ) : null}
                </div>
              </li>
              <li>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                  <div className="grid gap-1">
                    <label
                      htmlFor="conversation-context-mode"
                      className="text-sm font-medium leading-none">
                      Context
                    </label>
                    <span className="text-xs text-muted-foreground">
                      Send previous messages to the assistant and preserve context
                    </span>
                  </div>
                  <Checkbox
                    id="conversation-context-mode"
                    checked={conversationContextMode === 'multi-turn'}
                    onCheckedChange={(value) =>
                      updateThreadSettings({
                        conversationContextMode: value ? 'multi-turn' : 'single-turn',
                      })
                    }
                  />
                </div>
              </li>
            </>
          )}
          {isImageModelSelected && (
            <li>
              <div className="flex flex-col space-y-2">
                <label className="ml-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Image size
                </label>
                <Select
                  value={selectedImageSize}
                  onValueChange={(value) => updateModelConfig({ size: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Image Size" />
                  </SelectTrigger>
                  <SelectContent>
                    {imageSizeConfig.options.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </li>
          )}
          {isDallE3Selected && (
            <>
              <li>
                <div className="flex flex-col space-y-2">
                  <label className="ml-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Quality
                  </label>
                  <Select
                    value={
                      'quality' in modelConfig && typeof modelConfig.quality === 'string'
                        ? modelConfig.quality
                        : 'standard'
                    }
                    onValueChange={(value) => updateModelConfig({ quality: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Quality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="hd">HD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </li>
              <li>
                <div className="flex flex-col space-y-2">
                  <label className="ml-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Style
                  </label>
                  <Select
                    value={
                      'style' in modelConfig && typeof modelConfig.style === 'string'
                        ? modelConfig.style
                        : 'vivid'
                    }
                    onValueChange={(value) => updateModelConfig({ style: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vivid">Vivid</SelectItem>
                      <SelectItem value="natural">Natural</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </li>
            </>
          )}

          {isVideoModelSelected && (
            <li>
              <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-3">
                <div className="grid gap-1">
                  <p className="text-sm font-medium">Video output</p>
                  <p className="text-xs text-muted-foreground">
                    Choose the clip settings supported by this model.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1 text-xs text-muted-foreground">
                    Duration
                    <Select
                      value={String(modelConfig.duration ?? durationOptions[0])}
                      onValueChange={(value) => updateModelConfig({ duration: Number(value) })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {durationOptions.map((value) => (
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
                      value={modelConfig.resolution ?? resolutionOptions[0]}
                      onValueChange={(value) => updateModelConfig({ resolution: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {resolutionOptions.map((value) => (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>
                <label className="grid gap-1 text-xs text-muted-foreground">
                  Aspect ratio
                  <Select
                    value={modelConfig.aspectRatio ?? aspectRatioOptions[0]}
                    onValueChange={(value) => updateModelConfig({ aspectRatio: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {aspectRatioOptions.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-xs text-muted-foreground">
                  Generate audio
                  <Checkbox
                    checked={modelConfig.generateAudio ?? videoCapabilities?.generateAudio ?? false}
                    disabled={videoCapabilities?.generateAudio === false}
                    onCheckedChange={(value) =>
                      updateModelConfig({ generateAudio: value === true })
                    }
                  />
                </label>
                <label className="grid gap-1 text-xs text-muted-foreground">
                  Seed (optional)
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={modelConfig.seed ?? ''}
                    onChange={(event) =>
                      updateModelConfig({ seed: Number(event.target.value) || undefined })
                    }
                  />
                </label>
              </div>
            </li>
          )}

          {isTextModelSelected && (
            <li>
              <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-3">
                <div className="grid gap-1">
                  <p className="text-sm font-medium">Generation</p>
                  <p className="text-xs text-muted-foreground">
                    Control the response within this thread
                  </p>
                </div>
                <div className={isByokModelAvailable ? 'grid grid-cols-2 gap-3' : 'grid gap-3'}>
                  {isByokModelAvailable && (
                    <label className="grid gap-1 text-xs text-muted-foreground">
                      Max tokens
                      <Input
                        type="number"
                        min={1}
                        max={128000}
                        value={modelConfig.maxTokens ?? ''}
                        onChange={(event) =>
                          updateModelConfig({
                            maxTokens: Number(event.target.value) || undefined,
                          })
                        }
                      />
                    </label>
                  )}
                  <label className="grid gap-1 text-xs text-muted-foreground">
                    Temperature
                    <Input
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={modelConfig.temperature ?? ''}
                      onChange={(event) =>
                        updateModelConfig({
                          temperature: Number(event.target.value) || undefined,
                        })
                      }
                    />
                  </label>
                </div>
                <label className="grid gap-1 text-xs text-muted-foreground">
                  Top P
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={modelConfig.topP ?? ''}
                    onChange={(event) =>
                      updateModelConfig({ topP: Number(event.target.value) || undefined })
                    }
                  />
                </label>
              </div>
            </li>
          )}

          {IS_SPEECH_SYNTHESIS_SUPPORTED() && isTextModelSelected && (
            <li>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                <div className="grid gap-1">
                  <label
                    htmlFor="is-text-to-speech-enabled"
                    className="text-sm font-medium leading-none">
                    Speak results
                  </label>
                  <span className="text-xs text-muted-foreground">
                    Read assistant replies aloud
                  </span>
                </div>
                <Checkbox
                  id="is-text-to-speech-enabled"
                  checked={isTextToSpeechEnabled}
                  onCheckedChange={(value) =>
                    updateCheckSetting('isTextToSpeechEnabled', value as boolean)
                  }
                />
              </div>
            </li>
          )}
          {isTextModelSelected && (
            <>
              <DropdownMenuSeparator className="mx-0 my-0 bg-border/60" />
              <li>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] px-3 py-2.5">
                  <div className="grid gap-1">
                    <label
                      htmlFor="show-detailed-usage"
                      className="text-sm font-medium leading-none">
                      Detailed usage
                    </label>
                    <span className="text-xs text-muted-foreground">
                      Show detailed token counts in messages and the thread
                    </span>
                  </div>
                  <Checkbox
                    id="show-detailed-usage"
                    checked={showDetailedUsage}
                    onCheckedChange={(value) =>
                      updateCheckSetting('showDetailedUsage', value as boolean)
                    }
                  />
                </div>
              </li>
            </>
          )}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SettingsDropdown;

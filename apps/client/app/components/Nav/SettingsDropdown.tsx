import { useCallback, useEffect, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { SlidersHorizontal } from 'lucide-react';

import {
  defaultModel,
  profiles,
  supportedImageModels,
  imageSizes,
  supportedTextModels,
} from 'utils';

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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
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
  const [pendingUserSettingsTarget, setPendingUserSettingsTarget] =
    useState<UserSettingsScrollTarget | null>(null);

  const { imageSize, style, quality } = config;
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
        updateThreadSettings({ [name]: value } as Parameters<typeof updateThreadSettings>[0]);
      } else {
        setConfig({ ...config, [name]: value } as typeof config);
      }
    },
    [config, setConfig, thread, updateThreadSettings]
  );

  const updateCheckSetting = useCallback(
    (name: string, checked: boolean) => {
      if (!thread) return null;

      updateThreadSettings({ [name]: checked });
    },
    [thread, updateThreadSettings]
  );

  const setImageSizeValue = useCallback(() => {
    if (!imageSizes(model).options.includes(imageSize as any)) {
      const defaultSize = imageSizes(model).default;
      updateSetting('imageSize', defaultSize);
      return defaultSize;
    }

    return imageSize;
  }, [imageSize, updateSetting]);

  const getGroupedItemsByCategory = useCallback((items: typeof profiles) => {
    return Object.entries(
      items.reduce<Record<string, Array<{ code: string; text: string }>>>(
        (acc, { code, text, category }) => {
          if (!acc[category]) acc[category] = [];
          acc[category].push({ code, text });
          return acc;
        },
        {}
      )
    );
  }, []);

  if (!thread) return null;

  const {
    settings: {
      model,
      profile,
      conversationContextMode,
      isTextToSpeechEnabled,
      showDetailedUsage,
    },
  } = thread!;
  const hasImageModels = supportedImageModels.length;
  const isImageModelSelected = supportedImageModels.map(({ name }) => name).includes(model);
  const isDallE3Selected = model === 'dall-e-3';

  return (
    <DropdownMenu open={isThreadSettingsOpen} onOpenChange={setThreadSettingsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <SlidersHorizontal className="size-[18px]" />
          <span className="sr-only">Open thread settings</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[calc(100vw-1rem)] max-w-sm rounded-2xl border-border/70 bg-popover/95 p-0 shadow-xl backdrop-blur"
        align="end">
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
              <Select
                value={model}
                defaultValue={defaultModel}
                onValueChange={(value) => updateSetting('model', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel className="text-muted-foreground">Text</SelectLabel>
                    {supportedTextModels.map(
                      ({ name, text, isSpecial, isExperimental, disabled }) => (
                        <SelectItem key={name} value={name} disabled={disabled}>
                          <div className="flex items-center gap-2">
                            {text}
                            {isSpecial && (
                              <Badge
                                variant="outline"
                                className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                                Special
                              </Badge>
                            )}
                            {isExperimental && (
                              <Badge
                                variant="outline"
                                className="bg-gradient-to-r from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                                Experimental
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      )
                    )}
                  </SelectGroup>
                  {hasImageModels ? (
                    <SelectGroup>
                      <SelectLabel className="text-muted-foreground">Image</SelectLabel>
                      {supportedImageModels.map(
                        ({ name, text, isSpecial, isExperimental, disabled }) => (
                          <SelectItem key={name} value={name} disabled={disabled} className="gap-2">
                            <div className="flex items-center gap-2">
                              {text}
                              {isSpecial && (
                                <Badge
                                  variant="outline"
                                  className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                                  Special
                                </Badge>
                              )}
                              {isExperimental && (
                                <Badge
                                  variant="outline"
                                  className="bg-gradient-to-r from-purple-50 to-fuchsia-50 dark:from-purple-900/20 dark:to-fuchsia-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800">
                                  Experimental
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        )
                      )}
                    </SelectGroup>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
          </li>
          {!isImageModelSelected && (
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
                      {getGroupedItemsByCategory(profiles).map(([category, items]) => (
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
                      Send previous messages to the assistant for context and preserve context
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
                  value={setImageSizeValue()}
                  onValueChange={(value) => updateSetting('imageSize', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Image Size" />
                  </SelectTrigger>
                  <SelectContent>
                    {imageSizes(model).options.map((size) => (
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
                    value={quality}
                    onValueChange={(value) => updateSetting('quality', value)}>
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
                  <Select value={style} onValueChange={(value) => updateSetting('style', value)}>
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

          {IS_SPEECH_SYNTHESIS_SUPPORTED() && !isImageModelSelected && (
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
          {!isImageModelSelected && (
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

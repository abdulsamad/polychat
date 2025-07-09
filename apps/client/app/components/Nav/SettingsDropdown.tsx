import { useCallback } from 'react';
import { useAtom } from 'jotai';
import { SettingsIcon } from 'lucide-react';

import { variations, supportedImageModels, imageSizes, supportedTextModels } from 'utils';

import { configAtom, threadAtom } from '@/store';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const SettingsDropdown = () => {
  const [config, setConfig] = useAtom(configAtom);
  const [thread, setThread] = useAtom(threadAtom);

  const { imageSize, style, quality } = config;

  const updateSetting = useCallback(
    (name: string, value: string) => {
      if (!thread) return null;

      setThread({ ...thread, settings: { ...thread.settings, [name]: value } });
    },
    [config, setConfig, thread, setThread]
  );

  const updateCheckSetting = useCallback(
    (name: string, checked: boolean) => {
      if (!thread) return null;

      setThread({ ...thread, settings: { ...thread.settings, [name]: checked } });
    },
    [config, setConfig, thread, setThread]
  );

  const setImageSizeValue = useCallback(() => {
    if (!imageSizes(model).options.includes(imageSize as any)) {
      const defaultSize = imageSizes(model).default;
      updateSetting('imageSize', defaultSize);
      return defaultSize;
    }

    return imageSize;
  }, [imageSize, updateSetting]);

  const getGroupedItemsByCategory = useCallback((items: typeof variations) => {
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
    settings: { model, variation, isContextAware, isTextToSpeechEnabled },
  } = thread!;
  const hasImageModels = supportedImageModels.length;
  const isImageModelSelected = supportedImageModels.map(({ name }) => name).includes(model);
  const isDallE3Selected = model === 'dall-e-3';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <SettingsIcon className="size-[18px]" />
          <span className="sr-only">Toggle thread dropdown</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="rounded-xl w-72" align="end">
        <ul className="space-y-5 lg:space-y-6 p-4">
          <li>
            <div className="flex flex-col space-y-2">
              <label className="ml-1">Model</label>
              <Select
                value={model}
                defaultValue="gemini-1.5-flash"
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
                  <label className="ml-1">Variation</label>
                  <Select
                    value={variation}
                    onValueChange={(value) => updateSetting('variation', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Variation" />
                    </SelectTrigger>
                    <SelectContent>
                      {getGroupedItemsByCategory(variations).map(([category, items]) => (
                        <SelectGroup key={category}>
                          <SelectLabel className="text-muted-foreground capitalize">
                            {category}
                          </SelectLabel>
                          {items.map(({ code, text }) => (
                            <SelectItem key={code} value={code}>
                              {text}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </li>
              {/* <li>
                <div className="flex justify-center space-x-4">
                  <Checkbox
                    id="is-context-aware"
                    checked={isContextAware}
                    className="dark:border-white"
                    onCheckedChange={(value) =>
                      updateCheckSetting('isContextAware', value as boolean)
                    }
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="is-context-aware"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Is Context Aware
                    </label>
                  </div>
                </div>
              </li> */}
            </>
          )}
          {isImageModelSelected && (
            <li>
              <div className="flex flex-col space-y-2">
                <label className="ml-1">Image Size</label>
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
                  <label className="ml-1">Quality</label>
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
                  <label className="ml-1">Style</label>
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

          {IS_SPEECH_SYNTHESIS_SUPPORTED() && (
            <li>
              <div className="flex justify-center space-x-2">
                <Checkbox
                  id="is-text-to-speech-enabled"
                  checked={isTextToSpeechEnabled}
                  className="dark:border-white"
                  onCheckedChange={(value) =>
                    updateCheckSetting('isTextToSpeechEnabled', value as boolean)
                  }
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="is-text-to-speech-enabled"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Speak Results
                  </label>
                </div>
              </div>
            </li>
          )}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SettingsDropdown;

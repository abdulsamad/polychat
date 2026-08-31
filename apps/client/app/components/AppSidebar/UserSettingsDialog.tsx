import { useEffect, useState } from 'react';
import { useAtom } from 'jotai';
import { LanguagesIcon, MoonIcon, SlidersHorizontalIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

import type { enabledModelsType } from 'utils';
import { languages, supportedTextModels, variations } from 'utils';

import { configAtom, getDefaultThread, type IThreadSettings } from '@/store';
import { getUserSettings, setUserSettings } from '@/utils/lforage';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UserSettingsDialog = ({ open, onOpenChange }: UserSettingsDialogProps) => {
  const [config, setConfig] = useAtom(configAtom);
  const { theme, setTheme } = useTheme();
  const [threadSettings, setThreadSettings] = useState<IThreadSettings<enabledModelsType>>(
    () => getDefaultThread().settings
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    let isActive = true;
    setIsLoading(true);
    void getUserSettings()
      .then((savedSettings) => {
        if (isActive) {
          setThreadSettings(getDefaultThread(savedSettings || undefined).settings);
        }
      })
      .catch(() => {
        if (isActive) toast.error('Could not load thread defaults');
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [open]);

  const updateThreadSetting = async <K extends keyof IThreadSettings<enabledModelsType>>(
    key: K,
    value: IThreadSettings<enabledModelsType>[K]
  ) => {
    const nextSettings = { ...threadSettings, [key]: value };
    setThreadSettings(nextSettings);
    try {
      await setUserSettings(nextSettings);
      toast.success('Settings updated');
    } catch (error) {
      console.error('Failed to save user settings', error);
      toast.error('Could not save settings');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(46rem,calc(100dvh-2rem))] max-w-2xl overflow-y-auto rounded-2xl border-border/70 p-0">
        <DialogHeader className="border-b border-border/60 bg-muted/20 px-6 py-5">
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontalIcon className="size-5 text-primary" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Personalize PolyChat and choose how new chats begin.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 p-6">
          <section className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {theme === 'dark' ? (
                  <MoonIcon className="size-4" />
                ) : (
                  <SunIcon className="size-4" />
                )}
              </span>
              <div>
                <h2 className="text-sm font-semibold">Appearance</h2>
                <p className="text-xs text-muted-foreground">Choose the look that feels right.</p>
              </div>
            </div>
            <Select
              value={theme ?? 'system'}
              onValueChange={(value) => {
                setTheme(value);
                toast.success('Settings updated');
              }}>
              <SelectTrigger className="bg-background/70">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </section>

          <section className="rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <LanguagesIcon className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">Language</h2>
                <p className="text-xs text-muted-foreground">Set the language used in responses.</p>
              </div>
            </div>
            <Select
              value={config.language}
              onValueChange={(language) => {
                setConfig({ ...config, language: language as typeof config.language });
                toast.success('Settings updated');
              }}>
              <SelectTrigger className="bg-background/70">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map(({ code, text }) => (
                  <SelectItem key={code} value={code}>
                    {text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <section className="rounded-xl border border-primary/20 bg-primary/[0.035] p-4">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <SlidersHorizontalIcon className="size-4" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">New thread defaults</h2>
                  <Badge variant="outline" className="rounded-full px-1.5 py-0 text-[10px]">
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
                <Select
                  disabled={isLoading}
                  value={threadSettings.model}
                  onValueChange={(model) =>
                    void updateThreadSetting(
                      'model',
                      model as IThreadSettings<enabledModelsType>['model']
                    )
                  }>
                  <SelectTrigger className="bg-background/70">
                    <SelectValue placeholder="Model" />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedTextModels.map(({ name, text, disabled }) => (
                      <SelectItem key={name} value={name} disabled={disabled}>
                        {text}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground">Variation</label>
                <Select
                  disabled={isLoading}
                  value={threadSettings.variation}
                  onValueChange={(variation) =>
                    void updateThreadSetting(
                      'variation',
                      variation as IThreadSettings<enabledModelsType>['variation']
                    )
                  }>
                  <SelectTrigger className="bg-background/70">
                    <SelectValue placeholder="Variation" />
                  </SelectTrigger>
                  <SelectContent>
                    {variations.map(({ code, text }) => (
                      <SelectItem key={code} value={code}>
                        {text}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

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
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserSettingsDialog;

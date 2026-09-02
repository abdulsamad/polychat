import { useEffect, useRef, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  KeyRoundIcon,
  LanguagesIcon,
  LockKeyholeIcon,
  Loader2Icon,
  ClipboardPasteIcon,
  MoonIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
  SunIcon,
  Trash2Icon,
} from 'lucide-react';
import { useUser } from '@clerk/react-router';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

import type { enabledModelsType } from 'utils';
import { languages, supportedTextModels, profiles } from 'utils';

import {
  configAtom,
  defaultConfig,
  getDefaultThread,
  replaceMessagesAtom,
  threadAtom,
  updateThreadSettingsAtom,
  waitForPersistence,
  refreshThreadsAtom,
  userSettingsScrollTargetAtom,
  type IThreadSettings,
} from '@/store';
import { clearLocalData, deleteAllChats, getUserSettings, setUserSettings } from '@/utils/lforage';
import {
  createVault,
  hasVault,
  isVaultUnlocked,
  lockVault,
  removeProviderKey,
  resetVault,
  saveProviderKey,
  setSessionProviderKey,
  subscribeVault,
  unlockVault,
  type ByokProvider,
} from '@/utils/byok-vault';
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
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const byokProviders: Array<{ id: ByokProvider; label: string }> = [
  { id: 'google', label: 'Google Gemini' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'mistral', label: 'Mistral' },
  { id: 'deepseek', label: 'DeepSeek' },
];
interface UserSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DangerAction = 'delete-chats' | 'reset-data';

const UserSettingsDialog = ({ open, onOpenChange }: UserSettingsDialogProps) => {
  const [config, setConfig] = useAtom(configAtom);
  const [scrollTarget, setScrollTarget] = useAtom(userSettingsScrollTargetAtom);
  const { theme, setTheme } = useTheme();
  const { user } = useUser();
  const [threadSettings, setThreadSettings] = useState<IThreadSettings<enabledModelsType>>(
    () => getDefaultThread().settings
  );
  const [isLoading, setIsLoading] = useState(true);
  const [vaultExists, setVaultExists] = useState(false);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [provider, setProvider] = useState<ByokProvider>('google');
  const [apiKey, setApiKey] = useState('');
  const [dangerAction, setDangerAction] = useState<DangerAction | null>(null);
  const [isDangerActionPending, setIsDangerActionPending] = useState(false);
  const [customInstructionsDraft, setCustomInstructionsDraft] = useState('');
  const isMobile = useIsMobile();
  const customInstructions = customInstructionsDraft;
  const activeThread = useAtomValue(threadAtom);
  const setThread = useSetAtom(threadAtom);
  const replaceMessages = useSetAtom(replaceMessagesAtom);
  const refreshThreads = useSetAtom(refreshThreadsAtom);
  const updateActiveThreadSettings = useSetAtom(updateThreadSettingsAtom);
  const customInstructionsRef = useRef<HTMLElement>(null);
  const byokRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open || !scrollTarget) return;

    const frame = requestAnimationFrame(() => {
      const target = scrollTarget === 'custom-instructions' ? customInstructionsRef : byokRef;
      target.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setScrollTarget(null);
    });

    return () => cancelAnimationFrame(frame);
  }, [open, scrollTarget, setScrollTarget]);

  const refreshVault = async () => {
    if (!user?.id) return;
    setVaultExists(await hasVault(user.id));
    setVaultUnlocked(isVaultUnlocked(user.id));
  };

  useEffect(() => {
    if (!open || !user?.id) return;
    void refreshVault();
    return subscribeVault(() => {
      setVaultUnlocked(isVaultUnlocked(user.id));
      void hasVault(user.id).then(setVaultExists);
    });
  }, [open, user?.id]);

  const handleUnlock = async () => {
    if (!user?.id || !passphrase) return;
    try {
      await unlockVault(user.id, passphrase);
      setPassphrase('');
      toast.success('BYOK vault unlocked');
    } catch {
      toast.error('Could not unlock the BYOK vault. Check your passphrase.');
    }
  };

  const handleSaveKey = async (persistent: boolean) => {
    if (!user?.id || !apiKey.trim()) return;
    try {
      if (persistent) {
        if (!vaultExists) {
          if (!passphrase || passphrase !== confirmPassphrase) {
            toast.error('Enter and confirm a vault passphrase.');
            return;
          }
          await createVault(user.id, passphrase, provider, apiKey);
          setConfirmPassphrase('');
        } else {
          if (!vaultUnlocked) {
            toast.error('Unlock the vault before saving a provider key.');
            return;
          }
          await saveProviderKey(user.id, provider, apiKey);
        }
        setPassphrase('');
      } else {
        setSessionProviderKey(user.id, provider, apiKey);
      }
      setApiKey('');
      await refreshVault();
      toast.success(
        persistent ? 'Provider key saved securely' : 'Provider key active for this session'
      );
    } catch {
      toast.error('Could not save this provider key.');
    }
  };

  const handleRemoveKey = async () => {
    if (!user?.id || !vaultUnlocked) return;
    try {
      await removeProviderKey(user.id, provider);
      await refreshVault();
      toast.success('Provider key removed');
    } catch {
      toast.error('Could not remove this provider key.');
    }
  };

  const handlePasteApiKey = async () => {
    try {
      const clipboardValue = await navigator.clipboard.readText();
      if (!clipboardValue.trim()) {
        toast.error('Clipboard is empty');
        return;
      }
      setApiKey(clipboardValue.trim());
      toast.success('Provider key pasted');
    } catch {
      toast.error('Could not read from the clipboard');
    }
  };

  const handleResetVault = async () => {
    if (
      !user?.id ||
      !window.confirm('Reset the BYOK vault? Saved provider keys cannot be recovered.')
    )
      return;
    await resetVault(user.id);
    setVaultExists(false);
    setVaultUnlocked(false);
    toast.success('BYOK vault reset');
  };

  const handleDeleteAllChats = async () => {
    await deleteAllChats();
    setThread(getDefaultThread((await getUserSettings()) || undefined));
    replaceMessages([]);
    await waitForPersistence();
    await deleteAllChats();
    refreshThreads();
    onOpenChange(false);
    toast.success('All chats deleted');
  };

  const handleResetAllData = async () => {
    await clearLocalData();
    if (user?.id) await resetVault(user.id);
    setConfig(defaultConfig);
    setThread(getDefaultThread());
    replaceMessages([]);
    setCustomInstructionsDraft('');
    setThreadSettings(getDefaultThread().settings);
    setTheme('dark');
    setVaultExists(false);
    setVaultUnlocked(false);
    await waitForPersistence();
    await deleteAllChats();
    refreshThreads();
    onOpenChange(false);
    toast.success('All local data reset');
  };

  const handleDangerAction = async () => {
    if (!dangerAction) return;
    setIsDangerActionPending(true);
    try {
      if (dangerAction === 'delete-chats') await handleDeleteAllChats();
      else await handleResetAllData();
    } catch {
      toast.error(
        dangerAction === 'delete-chats' ? 'Could not delete all chats' : 'Could not reset all local data'
      );
    } finally {
      setIsDangerActionPending(false);
      setDangerAction(null);
    }
  };

  useEffect(() => {
    if (!open) return;
    setCustomInstructionsDraft(config.customInstructions || '');

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
  }, [config.customInstructions, open]);

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

  const settingsBody = (
    <>
      <DialogHeader className="border-b border-border/60 bg-background px-6 py-5">
        <DialogTitle className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <SlidersHorizontalIcon className="size-4" />
          </span>
          Settings
        </DialogTitle>
        <DialogDescription>Personalize PolyChat and choose how new chats begin.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-5 p-6">
        <section className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {theme === 'dark' ? <MoonIcon className="size-4" /> : <SunIcon className="size-4" />}
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

        <section
          ref={customInstructionsRef}
          className="rounded-xl border border-primary/20 bg-primary/[0.035] p-4">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SlidersHorizontalIcon className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Custom instructions</h2>
              <p className="text-xs text-muted-foreground">
                Saved only in this browser. They are sent to the provider when the Custom profile is
                selected.
              </p>
            </div>
          </div>
          <Textarea
            value={customInstructions}
            maxLength={4000}
            onChange={(event) => setCustomInstructionsDraft(event.target.value)}
            placeholder="For example: Keep answers concise and use metric units."
            className="min-h-28 resize-y bg-background/70"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {customInstructions.length}/4000 characters
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={!customInstructions}
                onClick={() => {
                  setCustomInstructionsDraft('');
                  setConfig({ ...config, customInstructions: '' });
                  if (activeThread?.settings.profile === 'custom') {
                    updateActiveThreadSettings({ profile: 'normal' });
                  }
                }}>
                Clear
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setConfig({ ...config, customInstructions: customInstructionsDraft.trim() });
                  toast.success('Custom instructions saved');
                }}>
                Save instructions
              </Button>
            </div>
          </div>
        </section>

        <section ref={byokRef} className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300">
              <KeyRoundIcon className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Bring your own keys</h2>
              <p className="text-xs text-muted-foreground">
                Keys are encrypted locally and used directly from this browser. PolyChat cannot
                recover a forgotten vault passphrase.
              </p>
            </div>
          </div>

          {vaultExists && !vaultUnlocked ? (
            <div className="mb-4 flex gap-2">
              <Input
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                placeholder="Vault passphrase"
                autoComplete="current-password"
              />
              <Button type="button" onClick={() => void handleUnlock()}>
                <LockKeyholeIcon className="mr-2 size-4" />
                Unlock
              </Button>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
            <Select value={provider} onValueChange={(value) => setProvider(value as ByokProvider)}>
              <SelectTrigger className="bg-background/70">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {byokProviders.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Provider API key"
                autoComplete="off"
                spellCheck={false}
                className="pr-11"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Paste provider API key"
                title="Paste from clipboard"
                className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => void handlePasteApiKey()}>
                <ClipboardPasteIcon className="size-4" />
              </Button>
            </div>
          </div>

          {!vaultExists ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                placeholder="Create vault passphrase"
                autoComplete="new-password"
              />
              <Input
                type="password"
                value={confirmPassphrase}
                onChange={(event) => setConfirmPassphrase(event.target.value)}
                placeholder="Confirm passphrase"
                autoComplete="new-password"
              />
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void handleSaveKey(false)}>
              Use this session
            </Button>
            <Button type="button" onClick={() => void handleSaveKey(true)}>
              Save encrypted key
            </Button>
            {vaultUnlocked ? (
              <Button type="button" variant="outline" onClick={handleRemoveKey}>
                Remove provider key
              </Button>
            ) : null}
            {vaultUnlocked ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  lockVault();
                  setVaultUnlocked(false);
                }}>
                Lock
              </Button>
            ) : null}
            {vaultExists ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={() => void handleResetVault()}>
                Reset vault
              </Button>
            ) : null}
          </div>
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
                  {profiles.map(({ code, text }) => (
                    <SelectItem
                      key={code}
                      value={code}
                      disabled={code === 'custom' && !customInstructions.trim()}>
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

        <section className="rounded-xl border border-destructive/25 bg-destructive/[0.035] p-4">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Trash2Icon className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Danger zone</h2>
              <p className="text-xs text-muted-foreground">
                Remove local data from this browser. These actions cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={isDangerActionPending}
              onClick={() => setDangerAction('delete-chats')}>
              <Trash2Icon className="mr-2 size-4" />
              Delete all chats
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isDangerActionPending}
              onClick={() => setDangerAction('reset-data')}>
              <RotateCcwIcon className="mr-2 size-4" />
              Reset all local data
            </Button>
          </div>
        </section>

        <AlertDialog
          open={dangerAction !== null}
          onOpenChange={(open) => {
            if (!open && !isDangerActionPending) setDangerAction(null);
          }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {dangerAction === 'delete-chats' ? 'Delete all chats?' : 'Reset all local data?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {dangerAction === 'delete-chats'
                  ? 'Every chat and message will be permanently deleted from this browser.'
                  : 'Every chat, saved setting, theme preference, and BYOK provider key will be permanently deleted from this browser.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button type="button" variant="secondary" disabled={isDangerActionPending}>
                  Cancel
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isDangerActionPending}
                  onClick={(event) => {
                    event.preventDefault();
                    void handleDangerAction();
                  }}>
                  {isDangerActionPending ? <Loader2Icon className="size-4 animate-spin" /> : null}
                  {isDangerActionPending ? 'Working…' : 'Continue'}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground>
        <DrawerContent className="max-h-[92dvh] rounded-t-2xl border-t border-border/70 bg-background p-0 shadow-[0_-12px_32px_hsl(var(--foreground)/0.08)]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Settings</DrawerTitle>
            <DrawerDescription>
              Personalize PolyChat and choose how new chats begin.
            </DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {settingsBody}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(46rem,calc(100dvh-2rem))] max-w-2xl overflow-y-auto rounded-2xl border-border/70 p-0">
        {settingsBody}
      </DialogContent>
    </Dialog>
  );
};

export default UserSettingsDialog;

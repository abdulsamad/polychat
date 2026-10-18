import type { RefObject } from 'react';
import {
  CheckCircle2Icon,
  ClipboardPasteIcon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  XIcon,
} from 'lucide-react';

import type { ByokProvider } from '@/utils/byok-vault';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { byokProviders } from '@/components/AppSidebar/UserSettings/shared';
import type { ByokSettings } from '@/components/AppSidebar/UserSettings/useByokSettings';

interface ByokKeysSectionProps {
  sectionRef: RefObject<HTMLElement | null>;
  byok: ByokSettings;
}

const ByokKeysSection = ({ sectionRef, byok }: ByokKeysSectionProps) => {
  const {
    vaultExists,
    vaultUnlocked,
    deviceUnlock,
    prfSupported,
    passphrase,
    setPassphrase,
    confirmPassphrase,
    setConfirmPassphrase,
    provider,
    setProvider,
    apiKey,
    setApiKey,
    showConfirmPassphrase,
    setShowConfirmPassphrase,
    configuredProviderIds,
    unlockPassphraseRef,
    handleUnlock,
    handleEnableDeviceUnlock,
    handleSaveKey,
    handleRemoveKey,
    handlePasteApiKey,
    handleResetVault,
    handleLock,
  } = byok;

  return (
    <section
      ref={sectionRef}
      className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-4">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300">
          <KeyRoundIcon className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Bring your own keys</h2>
          <p className="text-xs text-muted-foreground">
            {(vaultExists ? deviceUnlock : prfSupported)
              ? 'Saved keys unlock with your device. Your passphrase is kept as a recovery option.'
              : 'Saved keys require your passphrase.'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            This starter list is for testing. Add a provider key to unlock more models from that
            provider.
          </p>
        </div>
      </div>

      {configuredProviderIds.length ? (
        <div className="mb-4 rounded-lg border border-border/60 bg-background/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-foreground">Added provider keys</p>
            <span className="text-[11px] text-muted-foreground">
              {configuredProviderIds.length} configured
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {configuredProviderIds.map((providerId) => {
              const providerDetails = byokProviders.find(({ id }) => id === providerId);
              if (!providerDetails) return null;

              return (
                <div
                  key={providerId}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/30 px-2.5 py-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm">
                    <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="truncate">{providerDetails.label}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${providerDetails.label} API key`}
                    title={vaultUnlocked ? 'Remove provider key' : 'Unlock vault to remove'}
                    disabled={!vaultUnlocked}
                    onClick={() => void handleRemoveKey(providerId)}>
                    <XIcon className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {vaultExists && !vaultUnlocked ? (
        <div className="mb-4 flex gap-2">
          <Input
            ref={unlockPassphraseRef}
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="Vault passphrase"
            autoComplete="current-password"
          />
          <Button
            type="button"
            onClick={() => void handleUnlock()}
            disabled={!deviceUnlock && !passphrase}>
            <KeyRoundIcon className="mr-2 size-4" />
            {passphrase || !deviceUnlock ? 'Use passphrase backup' : 'Unlock with device'}
          </Button>
        </div>
      ) : null}

      {vaultUnlocked && !deviceUnlock && prfSupported ? (
        <div className="mb-4 flex gap-2">
          <Input
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="Vault passphrase"
            autoComplete="current-password"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleEnableDeviceUnlock()}
            disabled={!passphrase}>
            <KeyRoundIcon className="mr-2 size-4" />
            Enable device unlock
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
              <SelectItem
                key={item.id}
                value={item.id}
                disabled={configuredProviderIds.includes(item.id)}>
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
          <div className="relative">
            <Input
              type={showConfirmPassphrase ? 'text' : 'password'}
              value={confirmPassphrase}
              onChange={(event) => setConfirmPassphrase(event.target.value)}
              placeholder="Confirm vault passphrase"
              autoComplete="new-password"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={
                showConfirmPassphrase
                  ? 'Hide confirmation passphrase'
                  : 'Show confirmation passphrase'
              }
              className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground"
              onClick={() => setShowConfirmPassphrase((visible) => !visible)}>
              {showConfirmPassphrase ? (
                <EyeOffIcon className="size-4" />
              ) : (
                <EyeIcon className="size-4" />
              )}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => void handleSaveKey(false)}>
          Use this session
        </Button>
        <Button type="button" onClick={() => void handleSaveKey(true)}>
          {vaultExists
            ? 'Save to vault'
            : prfSupported
              ? 'Save with device (passphrase backup)'
              : 'Save with passphrase'}
        </Button>
        {vaultUnlocked ? (
          <Button type="button" variant="ghost" onClick={handleLock}>
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
  );
};

export default ByokKeysSection;

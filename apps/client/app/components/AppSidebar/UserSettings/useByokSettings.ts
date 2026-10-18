import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import {
  createVault,
  enableDeviceUnlock,
  hasDeviceUnlock,
  hasVault,
  isVaultUnlocked,
  lockVault,
  removeProviderKey,
  resetVault,
  saveProviderKey,
  setSessionProviderKey,
  subscribeVault,
  unlockVault,
  isPrfSupported,
  isProviderConfigured,
  type ByokProvider,
} from '@/utils/byok-vault';
import { byokProviders, type ConfirmState } from '@/components/AppSidebar/UserSettings/shared';

interface UseByokSettingsOptions {
  open: boolean;
  accountId: string;
  confirm: ConfirmState;
}

export const useByokSettings = ({ open, accountId, confirm }: UseByokSettingsOptions) => {
  const [vaultExists, setVaultExists] = useState(false);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [deviceUnlock, setDeviceUnlock] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [provider, setProvider] = useState<ByokProvider>('google');
  const [apiKey, setApiKey] = useState('');
  const [prfSupported, setPrfSupported] = useState(false);
  const [isPrfSupportResolved, setIsPrfSupportResolved] = useState(false);
  const [showConfirmPassphrase, setShowConfirmPassphrase] = useState(false);
  const [configuredProviderIds, setConfiguredProviderIds] = useState<ByokProvider[]>([]);
  const unlockPassphraseRef = useRef<HTMLInputElement>(null);

  const refreshVault = async () => {
    setVaultExists(await hasVault(accountId));
    setVaultUnlocked(isVaultUnlocked(accountId));
    setDeviceUnlock(await hasDeviceUnlock(accountId));
    const configured = await Promise.all(
      byokProviders.map(async ({ id }) => ((await isProviderConfigured(accountId, id)) ? id : null))
    );
    setConfiguredProviderIds(configured.filter((id): id is ByokProvider => id !== null));
  };

  useEffect(() => {
    if (!open) return;
    void refreshVault();
    return subscribeVault(() => {
      setVaultUnlocked(isVaultUnlocked(accountId));
      void hasVault(accountId).then(setVaultExists);
      void hasDeviceUnlock(accountId).then(setDeviceUnlock);
    });
  }, [accountId, open]);

  useEffect(() => {
    if (!open) return;
    setIsPrfSupportResolved(false);
    void isPrfSupported().then((supported) => {
      setPrfSupported(supported);
      setIsPrfSupportResolved(true);
    });
  }, [open]);

  useEffect(() => {
    if (!open || !vaultExists || vaultUnlocked || !isPrfSupportResolved || deviceUnlock) return;

    const frame = requestAnimationFrame(() => unlockPassphraseRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, vaultExists, vaultUnlocked, isPrfSupportResolved, deviceUnlock]);

  const handleUnlock = async () => {
    if (!accountId) return;
    try {
      await unlockVault(accountId, passphrase);
      setPassphrase('');
      toast.success('BYOK vault unlocked');
    } catch (error) {
      console.error('[BYOK vault] Device unlock failed', {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
      });
      toast.error(error instanceof Error ? error.message : 'Could not unlock the BYOK vault.');
    }
  };

  const handleEnableDeviceUnlock = async () => {
    if (!accountId || !passphrase) return;
    try {
      await enableDeviceUnlock(accountId, passphrase);
      setPassphrase('');
      setDeviceUnlock(true);
      toast.success('Device unlock enabled');
    } catch (error) {
      console.error('[BYOK vault] Enable device unlock failed', {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
      });
      toast.error(error instanceof Error ? error.message : 'Could not enable device unlock.');
    }
  };

  const handleSaveKey = async (persistent: boolean) => {
    if (!apiKey.trim()) return;
    try {
      if (persistent) {
        if (!vaultExists) {
          if (!passphrase || passphrase !== confirmPassphrase) {
            toast.error('Enter and confirm a vault passphrase.');
            return;
          }
          const { deviceUnlock: createdWithDevice } = await createVault(
            accountId,
            passphrase,
            provider,
            apiKey,
            prfSupported
          );
          if (prfSupported && !createdWithDevice) {
            toast.info('Device unlock is unavailable with this passkey. Using your passphrase.');
          }
          setPassphrase('');
          setConfirmPassphrase('');
        } else {
          if (!vaultUnlocked) {
            toast.error('Unlock the vault before saving a provider key.');
            return;
          }
          await saveProviderKey(accountId, provider, apiKey);
        }
      } else {
        setSessionProviderKey(accountId, provider, apiKey);
      }
      setApiKey('');
      await refreshVault();
      toast.success(
        persistent ? 'Provider key saved securely' : 'Provider key active for this session'
      );
    } catch (error) {
      console.error('[BYOK vault] Provider key save failed', {
        persistent,
        vaultExists,
        vaultUnlocked,
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
      });
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not save this provider key with device lock.'
      );
    }
  };

  const handleRemoveKey = (providerId: ByokProvider) => {
    if (!vaultUnlocked) return;
    confirm.setProviderToRemove(providerId);
  };

  const handleConfirmRemoveKey = async () => {
    const { providerToRemove } = confirm;
    if (!vaultUnlocked || !providerToRemove) return;
    confirm.setIsPending(true);
    try {
      await removeProviderKey(accountId, providerToRemove);
      await refreshVault();
      toast.success('Provider key removed');
    } catch {
      toast.error('Could not remove this provider key.');
    } finally {
      confirm.setIsPending(false);
      confirm.setProviderToRemove(null);
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

  const clearVaultState = () => {
    setVaultExists(false);
    setVaultUnlocked(false);
  };

  const handleResetVault = async () => {
    if (!window.confirm('Reset the BYOK vault? Saved provider keys cannot be recovered.')) return;
    await resetVault(accountId);
    clearVaultState();
    toast.success('BYOK vault reset');
  };

  const handleLock = () => {
    lockVault();
    setVaultUnlocked(false);
  };

  return {
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
    handleConfirmRemoveKey,
    handlePasteApiKey,
    handleResetVault,
    handleLock,
    clearVaultState,
  };
};

export type ByokSettings = ReturnType<typeof useByokSettings>;

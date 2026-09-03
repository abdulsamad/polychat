import { useEffect, useState } from 'react';
import { useUser } from '@clerk/react-router';
import { KeyRound, Loader2 } from 'lucide-react';
import { useAtom } from 'jotai';
import { toast } from 'sonner';

import { hasVault, isVaultUnlocked, subscribeVault, unlockVault } from '@/utils/byok-vault';
import { byokUnlockOpenAtom } from '@/store';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SidebarTrigger } from '@/components/ui/sidebar';

import SettingsDropdown from './SettingsDropdown';

const Nav = () => {
  const { user } = useUser();
  const [vaultExists, setVaultExists] = useState(false);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [isUnlockDialogOpen, setIsUnlockDialogOpen] = useAtom(byokUnlockOpenAtom);
  const [passphrase, setPassphrase] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setVaultExists(false);
      setVaultUnlocked(false);
      return;
    }

    const accountId = user.id;
    const refreshVault = () => {
      setVaultUnlocked(isVaultUnlocked(accountId));
      void hasVault(accountId).then(setVaultExists);
    };

    refreshVault();
    return subscribeVault(refreshVault);
  }, [user?.id]);

  const handleUnlock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.id || !passphrase) return;

    setIsUnlocking(true);
    try {
      await unlockVault(user.id, passphrase);
      setPassphrase('');
      setIsUnlockDialogOpen(false);
      toast.success('BYOK vault unlocked');
    } catch {
      toast.error('Could not unlock the BYOK vault. Check your passphrase.');
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <>
      <nav className="relative flex h-14 w-full shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-background/90 px-3 py-1 backdrop-blur-sm sm:px-4">
        <SidebarTrigger />
        <h1 className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2 text-lg leading-6 font-semibold tracking-tight text-foreground lg:text-xl">
          <img src="/polychat-navbar.png" alt="" className="size-7" aria-hidden="true" />
          <span>
            <span className="font-mono text-primary">Poly</span>Chat
          </span>
        </h1>
        <div className="ml-auto flex flex-col items-center gap-2 sm:flex-row">
          {vaultExists && !vaultUnlocked ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-2 px-2 sm:px-3"
              onClick={() => setIsUnlockDialogOpen(true)}>
              <KeyRound className="size-4" />
              <span className="hidden sm:inline">Unlock keys</span>
              <span className="sr-only sm:hidden">Unlock saved keys</span>
            </Button>
          ) : null}
          <SettingsDropdown />
        </div>
      </nav>

      <Dialog open={isUnlockDialogOpen} onOpenChange={setIsUnlockDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unlock your BYOK keys</DialogTitle>
            <DialogDescription>
              Enter your vault passphrase to use your saved provider keys in this session.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUnlock} className="grid gap-4">
            <Input
              type="password"
              autoFocus
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Vault passphrase"
              autoComplete="current-password"
              disabled={isUnlocking}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUnlockDialogOpen(false)}
                disabled={isUnlocking}>
                Cancel
              </Button>
              <Button type="submit" disabled={!passphrase || isUnlocking}>
                {isUnlocking ? <Loader2 className="size-4 animate-spin" /> : null}
                Unlock keys
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Nav;

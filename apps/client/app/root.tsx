import { MetaFunction, Outlet } from 'react-router';
import { useEffect, useState } from 'react';
import { Provider } from 'jotai';
import { ClerkProvider, useUser } from '@clerk/react-router';
import { KeyRound, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

import type { Route } from './+types/root';
import ErrorBoundary from './error';
import Layout from './layout';
import Loading from './loading';

import './app.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  hasVault,
  isVaultUnlocked,
  lockVault,
  resetVault,
  setActiveAccount,
  subscribeVault,
  unlockVault,
} from '@/utils/byok-vault';

export const meta: MetaFunction = () => [
  { charSet: 'utf-8' },
  { name: 'viewport', content: 'width=device-width,initial-scale=1' },
  { name: 'color-scheme', content: 'light dark' },
  { title: 'PolyChat - The AI Chat App' },
  {
    name: 'description',
    content:
      'Compare AI models, generate images, and keep conversations in one local-first workspace.',
  },
  { property: 'og:type', content: 'website' },
  { property: 'og:title', content: 'PolyChat - The AI Chat App' },
  {
    property: 'og:description',
    content:
      'Compare AI models, generate images, and keep conversations in one local-first workspace.',
  },
  { property: 'og:image', content: '/og-image.jpg' },
  { property: 'og:image:width', content: '1200' },
  { property: 'og:image:height', content: '630' },
  { name: 'twitter:card', content: 'summary_large_image' },
  { name: 'twitter:title', content: 'PolyChat - The AI Chat App' },
  {
    name: 'twitter:description',
    content:
      'Compare AI models, generate images, and keep conversations in one local-first workspace.',
  },
  { name: 'twitter:image', content: '/og-image.jpg' },
];

export const links: Route.LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
  },
  { rel: 'icon', href: '/favicon.ico' },
  { rel: 'theme-color', href: '#6656D9' },
  { rel: 'manifest', href: '/manifest.webmanifest' },
];

export const HydrateFallback = Loading;

const App = ({}: Route.ComponentProps) => {
  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <Provider>
        <VaultLifecycle />
        <Outlet />
        <VaultLockOverlay />
      </Provider>
    </ClerkProvider>
  );
};

const VaultLockOverlay = () => {
  const { user } = useUser();
  const [vaultExists, setVaultExists] = useState(false);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setVaultExists(false);
      setVaultUnlocked(false);
      setIsChecking(false);
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      setIsChecking(true);
      const exists = await hasVault(user.id);
      if (cancelled) return;
      setVaultExists(exists);
      setVaultUnlocked(isVaultUnlocked(user.id));
      setIsChecking(false);
    };

    void refresh();
    return subscribeVault(() => void refresh());
  }, [user?.id]);

  const handleUnlock = async () => {
    if (!user?.id || !passphrase) return;

    setIsUnlocking(true);
    try {
      await unlockVault(user.id, passphrase);
      setPassphrase('');
      setVaultUnlocked(true);
      toast.success('BYOK vault unlocked');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not unlock the BYOK vault.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleReset = async () => {
    if (
      !user?.id ||
      !window.confirm('Reset the BYOK vault? Saved provider keys cannot be recovered.')
    ) {
      return;
    }

    await resetVault(user.id);
    setVaultExists(false);
    setVaultUnlocked(false);
    toast.success('BYOK vault reset');
  };

  if (!user?.id || (!isChecking && (!vaultExists || vaultUnlocked))) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-dvh items-center justify-center overflow-y-auto bg-background/55 p-4 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/35 sm:p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="vault-lock-title"
      aria-describedby="vault-lock-description">
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-border/70 bg-card/75 p-6 text-card-foreground shadow-[0_24px_100px_hsl(var(--foreground)/0.25)] backdrop-blur-3xl sm:p-8">
        <div className="pointer-events-none absolute -top-24 -right-16 size-48 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-16 size-56 rounded-full bg-accent/30 blur-3xl" />
        <div className="relative">
          <div className="mb-6 flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-background/55 shadow-inner backdrop-blur-xl">
            {isChecking ? (
              <Loader2 className="size-5 animate-spin text-primary" />
            ) : (
              <KeyRound className="size-5 text-primary" />
            )}
          </div>
          <h2 id="vault-lock-title" className="text-xl font-semibold tracking-tight">
            BYOK vault locked
          </h2>
          <p id="vault-lock-description" className="mt-2 text-sm leading-6 text-muted-foreground">
            Verify with your device, then enter your passphrase to decrypt your saved provider keys.
          </p>
          {isChecking ? (
            <p className="mt-6 text-sm text-muted-foreground">Checking your saved keys...</p>
          ) : (
            <div className="mt-6 grid gap-3">
              <Input
                type="password"
                autoFocus
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                placeholder="Vault passphrase"
                autoComplete="current-password"
                disabled={isUnlocking}
              />
              <Button
                type="button"
                className="h-11 rounded-xl"
                onClick={() => void handleUnlock()}
                disabled={!passphrase || isUnlocking}>
                {isUnlocking ? <Loader2 className="size-4 animate-spin" /> : null}
                Verify device and unlock
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 rounded-xl text-muted-foreground hover:text-destructive"
                onClick={() => void handleReset()}
                disabled={isUnlocking}>
                <RotateCcw className="size-4" />
                Reset vault
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const VaultLifecycle = () => {
  const { user } = useUser();

  useEffect(() => {
    setActiveAccount(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    const lockWhenHidden = () => {
      if (document.visibilityState === 'hidden') lockVault();
    };
    document.addEventListener('visibilitychange', lockWhenHidden);
    window.addEventListener('pagehide', lockVault);
    return () => {
      document.removeEventListener('visibilitychange', lockWhenHidden);
      window.removeEventListener('pagehide', lockVault);
    };
  }, []);

  return null;
};

export { ErrorBoundary, Layout };

export default App;

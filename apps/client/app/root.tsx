import { MetaFunction, Outlet } from 'react-router';
import { useEffect } from 'react';
import { Provider } from 'jotai';
import { ClerkProvider, useUser } from '@clerk/react-router';

import type { Route } from './+types/root';
import ErrorBoundary from './error';
import Layout from './layout';
import Loading from './loading';

import './app.css';
import { setActiveAccount } from '@/utils/byok-vault';

export const meta: MetaFunction = () => [
  { charSet: 'utf-8' },
  { name: 'viewport', content: 'width=device-width,initial-scale=1' },
  { name: 'color-scheme', content: 'light dark' },
  { title: 'PolyChat - The AI Chat App' },
  {
    name: 'description',
    content: 'Compare AI models, generate images, and keep conversations in one local-first workspace.',
  },
  { property: 'og:type', content: 'website' },
  { property: 'og:title', content: 'PolyChat - The AI Chat App' },
  {
    property: 'og:description',
    content: 'Compare AI models, generate images, and keep conversations in one local-first workspace.',
  },
  { property: 'og:image', content: '/og-image.jpg' },
  { property: 'og:image:width', content: '1200' },
  { property: 'og:image:height', content: '630' },
  { name: 'twitter:card', content: 'summary_large_image' },
  { name: 'twitter:title', content: 'PolyChat - The AI Chat App' },
  {
    name: 'twitter:description',
    content: 'Compare AI models, generate images, and keep conversations in one local-first workspace.',
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
      </Provider>
    </ClerkProvider>
  );
};

const VaultLifecycle = () => {
  const { user } = useUser();

  useEffect(() => {
    setActiveAccount(user?.id ?? null);
  }, [user?.id]);

  return null;
};

export { ErrorBoundary, Layout };

export default App;

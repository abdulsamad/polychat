import { MetaFunction, Outlet } from 'react-router';
import { Provider } from 'jotai';
import { ClerkProvider } from '@clerk/react-router';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';

import type { Route } from './+types/root';
import ErrorBoundary from './error';
import Layout from './layout';
import Loading from './loading';

import './app.css';

export const meta: MetaFunction = () => [
  { charSet: 'utf-8' },
  { name: 'viewport', content: 'width=device-width,initial-scale=1' },
  { title: 'PolyChat - The AI Chat App' },
];

export const links: Route.LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
  },
  { rel: 'icon', href: '/favicon.ico' },
  { rel: 'theme-color', href: '#AD46FF' },
  { rel: 'manifest', href: '/manifest.webmanifest' },
];

export const HydrateFallback = Loading;

const App = ({}: Route.ComponentProps) => {
  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <VercelAnalytics />
      <Provider>
        <Outlet />
      </Provider>
    </ClerkProvider>
  );
};

export { ErrorBoundary, Layout };

export default App;

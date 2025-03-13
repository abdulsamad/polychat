import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import { reactRouterDevTools } from 'react-router-devtools';
import tsconfigPaths from 'vite-tsconfig-paths';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    // reactRouterDevTools({}),
    reactRouter(),
    tsconfigPaths(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
      },
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'PolyChat - The AI Chat App',
        short_name: 'PolyChat',
        description: 'Chat with multiple AI models including Gemini, Mistral, OpenAI and more',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f0f0f',
        theme_color: '#9F7AEA',
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        categories: ['productivity', 'ai', 'chat'],
        // screenshots: [
        //   {
        //     src: '/screenshot-1.png',
        //     sizes: '1280x720',
        //     type: 'image/png',
        //   },
        // ],
        orientation: 'portrait',
        prefer_related_applications: false,
      },
    }),
  ],
  optimizeDeps: {
    include: ['react-syntax-highlighter/dist/cjs/styles/prism'],
  },
  build: {
    sourcemap: false,
  },
});

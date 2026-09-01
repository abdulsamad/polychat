/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ENDPOINT: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
  readonly VITE_ENABLE_BYOK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '@fontsource/fira-code';

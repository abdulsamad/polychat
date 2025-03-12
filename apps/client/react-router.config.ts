import { vercelPreset } from '@vercel/react-router/vite';
import type { Config } from '@react-router/dev/config';

export default {
  ssr: false, // Server-side render by default, to enable SPA mode set this to `false`
  presets: [vercelPreset()],
} satisfies Config;

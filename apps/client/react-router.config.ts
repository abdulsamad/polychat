import { vercelPreset } from '@vercel/react-router/vite';
import type { Config } from '@react-router/dev/config';

export default {
  ssr: false, // Server-side render by default
  presets: [vercelPreset()],
} satisfies Config;

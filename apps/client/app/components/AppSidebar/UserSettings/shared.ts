import type { ByokProvider } from '@/utils/byok-vault';

export const byokProviders: Array<{ id: ByokProvider; label: string }> = [
  { id: 'google', label: 'Google Gemini' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'mistral', label: 'Mistral' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'openrouter', label: 'OpenRouter' },
];

export type DangerAction = 'delete-chats' | 'reset-data';

// Provider-key removal and the danger-zone actions both drive one confirmation dialog.
// The dialog shell owns that state and hands it to the hooks that need it.
export interface ConfirmState {
  dangerAction: DangerAction | null;
  setDangerAction: (action: DangerAction | null) => void;
  providerToRemove: ByokProvider | null;
  setProviderToRemove: (provider: ByokProvider | null) => void;
  isPending: boolean;
  setIsPending: (isPending: boolean) => void;
}

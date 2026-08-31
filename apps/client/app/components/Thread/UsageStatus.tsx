import { useAtomValue } from 'jotai';

import { messagesAtom } from '@/store';

const UsageStatus = () => {
  const messages = useAtomValue(messagesAtom);
  const usage = messages.reduce(
    (totals, message) => {
      if (message.role !== 'assistant' || !message.metadata.usage) return totals;

      return {
        inputTokens: totals.inputTokens + (message.metadata.usage.inputTokens ?? 0),
        outputTokens: totals.outputTokens + (message.metadata.usage.outputTokens ?? 0),
        totalTokens: totals.totalTokens + (message.metadata.usage.totalTokens ?? 0),
      };
    },
    { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  );

  if (!usage.totalTokens) return null;

  return (
    <aside className="mx-auto mb-2 w-full max-w-5xl px-3 text-center text-xs text-muted-foreground sm:px-5 lg:px-8">
      Thread usage: {usage.totalTokens} total tokens · {usage.inputTokens} input ·{' '}
      {usage.outputTokens} output
    </aside>
  );
};

export default UsageStatus;

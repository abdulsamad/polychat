import { useAtomValue } from 'jotai';

import { Badge } from '@/components/ui/badge';
import { messagesAtom, threadAtom } from '@/store';

const UsageStatus = () => {
  const messages = useAtomValue(messagesAtom);
  const showDetailedUsage = useAtomValue(threadAtom)?.settings.showDetailedUsage ?? false;
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

  if (!showDetailedUsage || !usage.totalTokens) return null;

  return (
    <aside className="mx-auto mb-2 flex w-full max-w-5xl justify-center px-3 sm:px-5 lg:px-8">
      <Badge
        variant="outline"
        className="h-auto max-w-full gap-2 rounded-full border-border/70 bg-muted/40 px-3 py-1.5 text-muted-foreground shadow-sm">
        <span className="font-semibold text-foreground">Thread usage</span>
        <span className="text-border" aria-hidden="true">
          ·
        </span>
        <span>{usage.totalTokens.toLocaleString()} total</span>
        <span className="hidden text-border sm:inline" aria-hidden="true">
          ·
        </span>
        <span className="hidden sm:inline">{usage.inputTokens.toLocaleString()} input</span>
        <span className="hidden text-border sm:inline" aria-hidden="true">
          ·
        </span>
        <span className="hidden sm:inline">{usage.outputTokens.toLocaleString()} output</span>
      </Badge>
    </aside>
  );
};

export default UsageStatus;

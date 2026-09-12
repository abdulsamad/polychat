import { useEffect, useRef, useState } from 'react';
import { BrainCircuitIcon, ChevronDownIcon } from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ReasoningCollapsibleProps {
  messageId: string;
  reasoning: string;
  isStreaming: boolean;
  reasoningComplete?: boolean;
}

const ReasoningCollapsible = ({
  messageId,
  reasoning,
  isStreaming,
  reasoningComplete = false,
}: ReasoningCollapsibleProps) => {
  const [open, setOpen] = useState(false);
  const autoOpenedRef = useRef(false);
  const previousMessageIdRef = useRef(messageId);

  useEffect(() => {
    if (previousMessageIdRef.current !== messageId) {
      previousMessageIdRef.current = messageId;
      autoOpenedRef.current = false;
      setOpen(false);
    }
  }, [messageId]);

  useEffect(() => {
    if (!reasoning || !isStreaming) return;

    if (!reasoningComplete && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setOpen(true);
      return;
    }

    if (reasoningComplete && autoOpenedRef.current) {
      autoOpenedRef.current = false;
      setOpen(false);
    }
  }, [isStreaming, reasoning, reasoningComplete]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full max-w-[48rem]">
      <CollapsibleTrigger
        className="group flex min-h-8 w-full items-center gap-2 rounded-lg border border-border/70 bg-muted/35 px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        aria-label={open ? 'Hide thinking' : 'Show thinking'}>
        <BrainCircuitIcon className="size-3.5 shrink-0 text-primary/75" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground/75">Thinking</span>
        {isStreaming && !reasoningComplete && (
          <span className="shrink-0 text-[10px] text-muted-foreground">Live</span>
        )}
        <ChevronDownIcon
          className="size-3.5 shrink-0 transition-transform duration-150 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent
        data-reasoning-content
        className="reasoning-content overflow-hidden rounded-b-lg border-x border-b border-border/70 bg-muted/20 px-3 py-2.5 text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
        <div className="max-h-72 overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere]">
          {reasoning}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ReasoningCollapsible;

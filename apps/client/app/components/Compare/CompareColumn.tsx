import { memo, useMemo } from 'react';
import {
  AlertCircleIcon,
  BrainCircuitIcon,
  CheckIcon,
  CircleSlashIcon,
  CircleStopIcon,
  TrophyIcon,
} from 'lucide-react';

import { modelProviderLabels } from 'utils';
import { cn } from '@/utils';
import type { CompareColumnState, CompareColumnStatus } from '@/hooks/useCompareRun';
import Text from '@/components/Message/Text';
import CopyButton from '@/components/Message/CopyButton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

export const formatDuration = (ms?: number) => {
  if (ms === undefined) return '-';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
};

const formatTokens = (value?: number) =>
  value === undefined ? '-' : new Intl.NumberFormat().format(value);

const statusLabels: Record<CompareColumnStatus, string> = {
  waiting: 'Waiting',
  streaming: 'Streaming',
  done: 'Done',
  failed: 'Failed',
  stopped: 'Stopped',
};

const StatusBadge = ({
  status,
  isThinking,
}: {
  status: CompareColumnStatus;
  isThinking: boolean;
}) => (
  <Badge
    variant="outline"
    className={cn(
      'shrink-0 gap-1.5 rounded-full px-2 py-0.5 font-medium',
      status === 'streaming' && 'border-primary/40 bg-primary/10 text-foreground',
      status === 'waiting' && 'text-muted-foreground',
      status === 'done' && 'border-border text-foreground',
      status === 'failed' && 'border-destructive/50 bg-destructive/10 text-destructive',
      status === 'stopped' && 'bg-muted text-muted-foreground'
    )}>
    {status === 'streaming' || status === 'waiting' ? (
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          status === 'streaming' ? 'bg-primary' : 'bg-muted-foreground',
          'motion-safe:animate-pulse'
        )}
      />
    ) : status === 'done' ? (
      <CheckIcon className="size-3" aria-hidden="true" />
    ) : status === 'failed' ? (
      <AlertCircleIcon className="size-3" aria-hidden="true" />
    ) : (
      <CircleSlashIcon className="size-3" aria-hidden="true" />
    )}
    {status === 'streaming' && isThinking ? 'Thinking' : statusLabels[status]}
  </Badge>
);

interface Metric {
  label: string;
  value: string;
  highlight?: boolean;
}

interface CompareColumnProps {
  column: CompareColumnState;
  canVote: boolean;
  isWinner: boolean;
  isFastestTtft: boolean;
  isFastestTotal: boolean;
  onVote: (model: CompareColumnState['model']) => void;
  onStop: (columnId: string) => void;
  /** Position in the run, used to stagger the entrance by 40ms per column. */
  index: number;
  className?: string;
}

const CompareColumn = ({
  column,
  canVote,
  isWinner,
  isFastestTtft,
  isFastestTotal,
  onVote,
  onStop,
  index,
  className,
}: CompareColumnProps) => {
  const { id, modelLabel, provider, status, content, error, isThinking, usage } = column;
  const headingId = `compare-column-${id}`;
  const hasContent = content.trim().length > 0;
  // Status, vote and metric changes must not re-parse (and remount) the Markdown tree.
  const answer = useMemo(
    () =>
      content.trim() ? (
        <Text
          isUser={false}
          message={content}
          messageClassNames="!border-0 !bg-transparent !shadow-none"
        />
      ) : null,
    [content]
  );
  const isActive = status === 'waiting' || status === 'streaming';
  const metrics: Metric[] = [
    { label: 'First token', value: formatDuration(column.ttftMs), highlight: isFastestTtft },
    { label: 'Total', value: formatDuration(column.totalMs), highlight: isFastestTotal },
    {
      label: 'Tokens in / out',
      value:
        usage?.inputTokens !== undefined || usage?.outputTokens !== undefined
          ? `${formatTokens(usage?.inputTokens)} / ${formatTokens(usage?.outputTokens)}`
          : formatTokens(usage?.totalTokens),
    },
  ];

  return (
    <Card
      role="group"
      aria-labelledby={headingId}
      aria-busy={isActive}
      // Entrance runs once per run (columns remount with a new id). CSS keyframes run off the
      // main thread while four streams start; reduced motion keeps only the fade.
      style={{ animationDelay: `${index * 40}ms` }}
      className={cn(
        'relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl bg-card/80 shadow-sm transition-[border-color,box-shadow] duration-200 ease-[var(--ease-out)] fill-mode-backwards animate-in fade-in-0 motion-safe:slide-in-from-bottom-2 motion-reduce:transition-none',
        isWinner && 'border-primary/70 shadow-[0_0_0_1px_hsl(var(--primary)/0.45)]',
        className
      )}>
      <header className="flex min-w-0 items-center gap-2 border-b border-border/70 px-3 py-2">
        <div className="min-w-0 flex-1">
          <h3
            id={headingId}
            className="truncate text-sm font-semibold tracking-tight text-foreground"
            title={modelLabel}>
            {modelLabel}
          </h3>
          <p className="truncate text-xs text-muted-foreground">{modelProviderLabels[provider]}</p>
        </div>
        {isWinner && (
          <TrophyIcon
            className="size-4 shrink-0 text-primary duration-200 ease-[var(--ease-out)] animate-in fade-in-0 motion-safe:zoom-in-75"
            aria-label="Voted best"
            role="img"
          />
        )}
        <StatusBadge status={status} isThinking={isThinking} />
        {isActive && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Stop this model"
            aria-label={`Stop ${modelLabel}`}
            onClick={() => onStop(id)}>
            <CircleStopIcon />
          </Button>
        )}
      </header>

      <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]]:[overflow-anchor:none] [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:w-full [&_[data-radix-scroll-area-viewport]>div]:min-w-0">
        <div className="flex min-w-0 flex-col gap-3 p-1.5 sm:p-2">
          {answer}
          {!hasContent && isActive && (
            <div className="flex flex-col gap-2.5 px-2 py-3" aria-hidden="true">
              {isThinking && (
                <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <BrainCircuitIcon className="size-3.5 text-primary" />
                  Thinking
                </p>
              )}
              <Skeleton className="h-3.5 w-11/12" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          )}
          {status === 'stopped' && !hasContent && (
            <p className="px-2 py-3 text-sm text-muted-foreground">Stopped before any output.</p>
          )}
          {error && (status === 'failed' || status === 'done') && (
            <Alert
              role={undefined}
              variant={status === 'failed' ? 'destructive' : 'default'}
              className="min-w-0 [overflow-wrap:anywhere]">
              <AlertCircleIcon className="size-4" />
              <AlertTitle>{status === 'failed' ? 'Request failed' : 'No answer'}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </ScrollArea>

      <footer className="flex min-w-0 flex-col gap-2 border-t border-border/70 px-3 py-2.5">
        <dl className="grid min-w-0 grid-cols-3 gap-2">
          {metrics.map(({ label, value, highlight }) => (
            <div key={label} className="flex min-w-0 flex-col">
              <dt className="truncate text-[0.6875rem] leading-4 tracking-wide text-muted-foreground">
                {label}
              </dt>
              <dd
                className={cn(
                  'truncate font-mono text-xs leading-5 tabular-nums',
                  highlight ? 'font-semibold text-primary' : 'text-foreground'
                )}>
                {value}
                {highlight && <span className="sr-only"> (fastest)</span>}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex min-w-0 items-center justify-end gap-1">
          {hasContent && !isActive && (
            <CopyButton text={content} label={`${modelLabel} answer`} className="size-9" />
          )}
          <Button
            type="button"
            size="sm"
            variant={isWinner ? 'default' : 'outline'}
            className="h-9 rounded-full px-3.5"
            disabled={!canVote || !hasContent}
            aria-pressed={isWinner}
            aria-label={`Vote ${modelLabel} as the best answer`}
            onClick={() => onVote(column.model)}>
            <TrophyIcon className="size-3.5" />
            {isWinner ? 'Best answer' : 'Best'}
          </Button>
        </div>
      </footer>
    </Card>
  );
};

export default memo(CompareColumn);

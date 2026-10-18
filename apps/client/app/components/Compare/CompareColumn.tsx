import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertCircleIcon,
  BrainCircuitIcon,
  CircleCheckIcon,
  CircleSlashIcon,
  CircleStopIcon,
  CoinsIcon,
  TriangleAlertIcon,
  TrophyIcon,
  ZapIcon,
  type LucideIcon,
} from 'lucide-react';

import { modelProviderLabels } from 'utils';
import { cn } from '@/utils';
import {
  formatCost,
  formatSpeed,
  thinkingMs,
  tokensPerSecond,
  wordCount,
} from '@/utils/compare-metrics';
import type { CompareColumnState, CompareColumnStatus } from '@/hooks/useCompareRun';
import type { CompareRubricCriterion } from '@/utils/lforage';
import RubricPopover from '@/components/Compare/RubricPopover';
import Text from '@/components/Message/Text';
import CopyButton from '@/components/Message/CopyButton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

const settledIcons = {
  done: CircleCheckIcon,
  failed: AlertCircleIcon,
  stopped: CircleSlashIcon,
} as const;

/**
 * Plain status text, deliberately without a border or fill so it never reads as a control.
 * The settled icon is keyed by status, so it settles in once when a column finishes.
 */
const StatusIndicator = ({
  status,
  isThinking,
}: {
  status: CompareColumnStatus;
  isThinking: boolean;
}) => {
  const SettledIcon = status === 'waiting' || status === 'streaming' ? null : settledIcons[status];

  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1.5 text-xs font-medium transition-colors duration-200',
        status === 'streaming' ? 'text-foreground' : 'text-muted-foreground',
        status === 'failed' && 'text-destructive'
      )}>
      {SettledIcon ? (
        <SettledIcon
          key={status}
          aria-hidden="true"
          className={cn(
            'size-3.5 duration-200 ease-[var(--ease-out)] animate-in fade-in-0 motion-safe:zoom-in-90',
            status === 'done' && 'text-primary'
          )}
        />
      ) : (
        <span aria-hidden="true" className="relative flex size-3.5 items-center justify-center">
          {status === 'streaming' && (
            <span className="absolute size-2 rounded-full bg-primary/40 motion-safe:animate-ping" />
          )}
          <span
            className={cn(
              'relative size-1.5 rounded-full transition-colors duration-200',
              status === 'streaming' ? 'bg-primary' : 'bg-muted-foreground/60'
            )}
          />
        </span>
      )}
      {status === 'streaming' && isThinking ? 'Thinking' : statusLabels[status]}
    </span>
  );
};

interface Metric {
  label: string;
  value: ReactNode;
  /** Explains how the value is measured. */
  title?: string;
  /** Muted while the value is still counting. */
  isLive?: boolean;
  /** Set when this column wins the metric; doubles as the accessible explanation. */
  best?: string;
  bestIcon?: LucideIcon;
}

/** Ticks every 100ms while mounted; only rendered for active columns. */
const LiveDuration = ({ since }: { since: number }) => {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(performance.now()), 100);
    return () => window.clearInterval(timer);
  }, []);
  return <>{formatDuration(Math.max(0, Math.round(now - since)))}</>;
};

const finishNotices: Record<string, string> = {
  length: 'Cut off at the output token limit.',
  'content-filter': "Stopped by the provider's content filter.",
};

interface CompareColumnProps {
  column: CompareColumnState;
  canVote: boolean;
  isWinner: boolean;
  /** performance.now() when the run started; 0 for saved runs, which never tick. */
  startedAt: number;
  isBestTtft: boolean;
  isBestTotal: boolean;
  isBestSpeed: boolean;
  isCheapest: boolean;
  /** Provider-reported or estimated cost, passed as primitives to keep memo effective. */
  costUsd?: number;
  isCostEstimate: boolean;
  /** Set in blind runs ("A"-"D"): the column shows this letter and hides its identity. */
  blindLetter?: string;
  /** True until a blind run's vote reveals the model. */
  isIdentityHidden: boolean;
  /** Rubric scores can be given once the run has settled. */
  canRate: boolean;
  onVote: (model: CompareColumnState['model']) => void;
  onStop: (columnId: string) => void;
  onRate: (columnId: string, criterion: CompareRubricCriterion, score?: number) => void;
  /** Position in the run, used to stagger the entrance by 40ms per column. */
  index: number;
  className?: string;
}

const CompareColumn = ({
  column,
  canVote,
  isWinner,
  startedAt,
  isBestTtft,
  isBestTotal,
  isBestSpeed,
  isCheapest,
  costUsd,
  isCostEstimate,
  blindLetter,
  isIdentityHidden,
  canRate,
  onVote,
  onStop,
  onRate,
  index,
  className,
}: CompareColumnProps) => {
  const { id, modelLabel, provider, status, content, error, isThinking, usage } = column;
  const headingId = `compare-column-${id}`;
  // Every accessible name uses the display label, so screen readers do not leak a blind model.
  const displayLabel = isIdentityHidden ? `Model ${blindLetter}` : modelLabel;
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
  const isLive = isActive && startedAt > 0;
  const thinking = thinkingMs(column);
  const words = hasContent ? wordCount(content) : 0;
  const finishNotice = column.finishReason ? finishNotices[column.finishReason] : undefined;
  const metrics: Metric[] = [
    {
      label: 'First token',
      value:
        column.ttftMs === undefined && isLive ? (
          <LiveDuration since={startedAt} />
        ) : (
          formatDuration(column.ttftMs)
        ),
      isLive: column.ttftMs === undefined && isLive,
      best: isBestTtft ? 'Fastest first token in this run' : undefined,
    },
    {
      label: 'Total',
      value: isLive ? <LiveDuration since={startedAt} /> : formatDuration(column.totalMs),
      isLive,
      best: isBestTotal ? 'Fastest total time in this run' : undefined,
    },
    {
      label: 'Speed',
      value: formatSpeed(tokensPerSecond(column)),
      title: 'Answer tokens per second while text streamed (reasoning excluded)',
      best: isBestSpeed ? 'Fastest generation in this run' : undefined,
    },
    {
      label: 'Tokens in / out',
      value:
        usage?.inputTokens !== undefined || usage?.outputTokens !== undefined
          ? `${formatTokens(usage?.inputTokens)} / ${formatTokens(usage?.outputTokens)}`
          : formatTokens(usage?.totalTokens),
      title: usage?.reasoningTokens
        ? `Includes ${formatTokens(usage.reasoningTokens)} reasoning tokens`
        : undefined,
    },
    {
      label: 'Thinking',
      value: formatDuration(thinking),
      title: 'Time spent streaming reasoning before the answer started',
    },
    {
      label: 'Cost',
      value: isIdentityHidden
        ? 'Hidden'
        : formatCost(
            costUsd === undefined ? undefined : { usd: costUsd, isEstimate: isCostEstimate }
          ),
      title: isIdentityHidden
        ? 'Cost can reveal the model, so it stays hidden until you vote'
        : costUsd === undefined
          ? 'No price is published for this model'
          : isCostEstimate
            ? 'Estimated from OpenRouter list prices'
            : 'Reported by the provider',
      best: isCheapest && !isIdentityHidden ? 'Cheapest in this run' : undefined,
      bestIcon: CoinsIcon,
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
        {blindLetter && (
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
            {blindLetter}
          </span>
        )}
        {/* Keyed by visibility, so the reveal after a blind vote resolves in like a focus pull,
            staggered with the columns. */}
        <div
          key={isIdentityHidden ? 'hidden' : 'revealed'}
          style={blindLetter ? { animationDelay: `${index * 40}ms` } : undefined}
          className={cn(
            'min-w-0 flex-1',
            // Only the reveal animates; a hidden column already enters with its card.
            blindLetter &&
              !isIdentityHidden &&
              'duration-250 ease-[var(--ease-out)] fill-mode-backwards animate-in fade-in-0 motion-safe:blur-in-xs'
          )}>
          <h3
            id={headingId}
            className="truncate text-sm font-semibold tracking-tight text-foreground"
            title={displayLabel}>
            {displayLabel}
          </h3>
          <p
            className="truncate text-xs text-muted-foreground"
            title={
              !isIdentityHidden && column.servedModelId
                ? `Served by ${column.servedModelId}`
                : undefined
            }>
            {isIdentityHidden ? (
              'Revealed after you vote'
            ) : (
              <>
                {modelProviderLabels[provider]}
                {column.servedModelId && <> - served by {column.servedModelId}</>}
              </>
            )}
          </p>
        </div>
        {isWinner && (
          <TrophyIcon
            className="size-4 shrink-0 fill-primary/20 text-primary duration-200 ease-[var(--ease-out)] animate-in fade-in-0 motion-safe:zoom-in-90"
            aria-label="Voted best"
            role="img"
          />
        )}
        <StatusIndicator status={status} isThinking={isThinking} />
        {isActive && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Stop this model"
            aria-label={`Stop ${displayLabel}`}
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
        {finishNotice && (
          <p className="flex min-w-0 items-start gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground duration-200 ease-[var(--ease-out)] animate-in fade-in-0 motion-safe:slide-in-from-bottom-1">
            <TriangleAlertIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0">{finishNotice}</span>
          </p>
        )}
        <dl className="grid min-w-0 grid-cols-3 gap-x-2 gap-y-1.5">
          {metrics.map(({ label, value, title, isLive, best, bestIcon: BestIcon = ZapIcon }) => (
            <div key={label} className="flex min-w-0 flex-col" title={best ?? title}>
              <dt className="truncate text-[0.6875rem] leading-4 tracking-wide text-muted-foreground">
                {label}
              </dt>
              <dd
                className={cn(
                  'flex min-w-0 items-center gap-1 font-mono text-xs leading-5 tabular-nums transition-colors duration-200',
                  best
                    ? 'font-semibold text-primary'
                    : isLive
                      ? 'text-muted-foreground'
                      : 'text-foreground'
                )}>
                <span className="truncate">{value}</span>
                {best && (
                  <BestIcon
                    aria-hidden="true"
                    className="size-3 shrink-0 fill-current duration-200 ease-[var(--ease-out)] animate-in fade-in-0 motion-safe:zoom-in-90"
                  />
                )}
                {best && <span className="sr-only"> ({best})</span>}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex min-w-0 items-center justify-end gap-1">
          {/* Settled-only details fade in when the column finishes instead of popping in. */}
          {words > 0 && !isActive && (
            <p className="mr-auto truncate text-xs text-muted-foreground tabular-nums duration-200 ease-[var(--ease-out)] animate-in fade-in-0 motion-safe:slide-in-from-bottom-1">
              {new Intl.NumberFormat().format(words)} {words === 1 ? 'word' : 'words'}
            </p>
          )}
          {hasContent && !isActive && (
            <CopyButton
              text={content}
              label={`${displayLabel} answer`}
              className="size-9 duration-200 ease-[var(--ease-out)] animate-in fade-in-0 motion-safe:slide-in-from-bottom-1"
            />
          )}
          {hasContent && !isActive && (
            <RubricPopover
              label={displayLabel}
              rubric={column.rubric}
              disabled={!canRate}
              onRate={(criterion, score) => onRate(id, criterion, score)}
            />
          )}
          <Button
            type="button"
            size="sm"
            variant={isWinner ? 'default' : 'outline'}
            className="h-9 rounded-full px-3.5"
            disabled={!canVote || !hasContent}
            aria-pressed={isWinner}
            aria-label={`Vote ${displayLabel} as the best answer`}
            onClick={() => onVote(column.model)}>
            <TrophyIcon className={cn('size-3.5', isWinner && 'fill-current')} />
            {isWinner ? 'Best answer' : 'Best'}
          </Button>
        </div>
      </footer>
    </Card>
  );
};

export default memo(CompareColumn);

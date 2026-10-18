import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSetAtom } from 'jotai';
import { useAuth, useClerk } from '@clerk/react-router';
import {
  AlertCircleIcon,
  ArrowRightIcon,
  Columns3Icon,
  HistoryIcon,
  KeyRoundIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { defaultModel } from 'utils';
import { userSettingsOpenAtom, userSettingsScrollTargetAtom } from '@/store';
import { cn } from '@/utils';
import { useByokModelAvailability } from '@/hooks/useByokModelAvailability';
import useCompareRun, {
  isSettledStatus,
  MIN_COMPARE_MODELS,
  type CompareColumnState,
  type CompareRunState,
} from '@/hooks/useCompareRun';
import useCompareHistory from '@/hooks/useCompareHistory';
import useCompareVotes from '@/hooks/useCompareVotes';
import useCompareWorkspace from '@/hooks/useCompareWorkspace';
import useModelPricing from '@/hooks/useModelPricing';
import {
  formatCost,
  getBests,
  resultCost,
  runCost,
  tokensPerSecond,
} from '@/utils/compare-metrics';
import type { ICompareRun, ICompareRunColumn } from '@/utils/lforage';
import CompareColumn from '@/components/Compare/CompareColumn';
import CompareComposer from '@/components/Compare/CompareComposer';
import CompareHistory from '@/components/Compare/CompareHistory';
import ComparePickers, {
  createCompareSlot,
  type CompareSlot,
} from '@/components/Compare/ComparePickers';
import CompareTally from '@/components/Compare/CompareTally';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Loading from '@/loading';

import type { Route } from './+types/compare';

export const meta = ({}: Route.MetaArgs) => [
  { title: 'Compare models - PolyChat' },
  {
    name: 'description',
    content: 'Send one prompt to several AI models and compare their answers side by side.',
  },
];

const suggestions = [
  'Explain the CAP theorem with a real-world analogy.',
  'Write a regex that validates an ISO 8601 date and explain it.',
  'What are the tradeoffs between REST and GraphQL for a mobile app?',
];

const hasAnswer = ({ content }: CompareColumnState) => content.trim().length > 0;

const savedRunDate = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const getRunStatus = (run: CompareRunState, getModelLabel: (model: string) => string) => {
  const total = run.columns.length;
  const settled = run.columns.filter(({ status }) => isSettledStatus(status)).length;

  if (settled < total) return `Comparing ${total} models: ${settled} of ${total} finished.`;
  if (!run.columns.some(hasAnswer)) {
    return 'No model returned an answer. Check the errors and try again.';
  }
  if (run.winner === 'tie') return 'Vote saved: it is a tie.';
  if (run.winner === 'none') return 'Vote saved: no answer was good enough.';
  if (run.winner) return `Vote saved: ${getModelLabel(run.winner)} wins.`;
  return 'All answers are in. Pick the best one, or call it a tie.';
};

const Compare = () => {
  const { isReady, error: workspaceError, retry: retryWorkspace } = useCompareWorkspace();
  const { isSignedIn } = useAuth();
  const clerk = useClerk();
  const setSettingsOpen = useSetAtom(userSettingsOpenAtom);
  const setSettingsScrollTarget = useSetAtom(userSettingsScrollTargetAtom);
  const { textModels, findModel, isModelAvailable, isProviderAvailable } =
    useByokModelAvailability();
  const votes = useCompareVotes(isReady);
  const history = useCompareHistory(isReady);
  const { getPrice } = useModelPricing();
  const { run, isRunning, canVote, start, stop, stopColumn, vote, open, close } = useCompareRun({
    onVoteSaved: votes.refresh,
    onRunSaved: history.refresh,
  });
  const [slots, setSlots] = useState<CompareSlot[]>([]);
  const [prompt, setPrompt] = useState('');

  // Hosted models need a Clerk session; BYOK models need an unlocked key for their provider.
  const runnableModels = useMemo(
    () =>
      textModels.filter(
        (model) =>
          isModelAvailable(model) && (Boolean(isSignedIn) || isProviderAvailable(model.provider))
      ),
    [isModelAvailable, isProviderAvailable, isSignedIn, textModels]
  );

  // Fill the first slots with valid defaults. Existing picks are kept even while BYOK
  // model discovery refreshes; unavailable picks are flagged instead of silently replaced.
  useEffect(() => {
    if (slots.length >= MIN_COMPARE_MODELS) return;
    const names = runnableModels.map(({ name }) => name);
    const preferred = [defaultModel, ...names].filter(
      (name, index, all) => names.includes(name) && all.indexOf(name) === index
    );
    const next = [...slots];
    for (const name of preferred) {
      if (next.length >= MIN_COMPARE_MODELS) break;
      if (!next.some(({ model }) => model === name)) next.push(createCompareSlot(name));
    }
    if (next.length !== slots.length) setSlots(next);
  }, [runnableModels, slots]);

  const selectedModels = useMemo(
    () => slots.flatMap(({ model }) => runnableModels.filter(({ name }) => name === model)),
    [runnableModels, slots]
  );
  const hasValidSelection =
    slots.length >= MIN_COMPARE_MODELS &&
    selectedModels.length === slots.length &&
    new Set(slots.map(({ model }) => model)).size === slots.length;
  const trimmedPrompt = prompt.trim();
  const canSubmit = isReady && hasValidSelection && Boolean(trimmedPrompt) && !isRunning;
  const disabledReason = !trimmedPrompt
    ? 'Type a prompt to compare.'
    : !hasValidSelection
      ? 'Choose at least two different available models.'
      : undefined;

  const getModelLabel = useCallback(
    (model: string) => findModel(model)?.text ?? model,
    [findModel]
  );
  const handleVote = useCallback(
    (winner: Parameters<typeof vote>[0]) => {
      void vote(winner);
    },
    [vote]
  );
  const openByokSettings = () => {
    setSettingsScrollTarget('byok');
    setSettingsOpen(true);
  };
  const getColumnCost = useCallback(
    (column: ICompareRunColumn | CompareColumnState) =>
      resultCost(column, getPrice(column.model, column.provider)),
    [getPrice]
  );
  const getRunCost = useCallback(
    (stored: ICompareRun) => runCost(stored.columns, getColumnCost),
    [getColumnCost]
  );
  // Rerun a saved prompt on the same models. Unavailable models are left for the user to replace.
  const rerun = (stored: ICompareRun) => {
    const models = stored.columns.flatMap(({ model }) =>
      runnableModels.filter(({ name }) => name === model)
    );
    setPrompt(stored.prompt);
    setSlots(models.map(({ name }) => createCompareSlot(name)));
    if (models.length === stored.columns.length && models.length >= MIN_COMPARE_MODELS) {
      start(stored.prompt, models);
    } else {
      toast.error('Some models from that run are unavailable. Pick replacements, then send.');
    }
  };
  const deleteRun = async (runId: string) => {
    await history.remove(runId);
    // A deleted run that stays open would be saved again by its next vote.
    if (run?.id === runId && !isRunning) close();
  };
  const clearHistory = async () => {
    try {
      await history.clear();
      if (run?.isFromHistory) close();
      toast.success('History cleared');
    } catch (error) {
      console.error('Failed to clear compare history', error);
      toast.error('Could not clear history.');
    }
  };
  const clearVotes = async () => {
    try {
      await votes.clear();
      toast.success('Compare results cleared');
    } catch (error) {
      console.error('Failed to clear compare votes', error);
      toast.error('Could not clear compare results.');
    }
  };

  if (workspaceError) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircleIcon className="size-4" />
          <AlertTitle>Compare is unavailable</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <p>{workspaceError} Your chats and votes were not changed.</p>
            <Button type="button" variant="outline" size="sm" onClick={retryWorkspace}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!isReady) return <Loading />;

  const answeredColumns = run
    ? run.columns.filter((column) => column.status === 'done' && hasAnswer(column))
    : [];
  const bests = getBests(answeredColumns, (column) => ({
    ttft: column.ttftMs,
    total: column.totalMs,
    speed: tokensPerSecond(column),
    cost: getColumnCost(column)?.usd,
  }));
  const isSettled = Boolean(run) && !isRunning;
  const totalCost = run && isSettled ? runCost(run.columns, getColumnCost) : undefined;
  const hasEnoughModels = runnableModels.length >= MIN_COMPARE_MODELS;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <CompareTally
        tally={votes.tally}
        total={votes.total}
        ties={votes.ties}
        none={votes.none}
        isLoading={votes.isLoading}
        getModelLabel={getModelLabel}
        onClear={clearVotes}
        actions={
          <CompareHistory
            runs={history.runs}
            isLoading={history.isLoading}
            error={history.error}
            activeRunId={run?.id}
            isRunning={isRunning}
            getModelLabel={getModelLabel}
            getColumnCost={getColumnCost}
            getRunCost={getRunCost}
            onOpenRun={open}
            onRerun={rerun}
            onDelete={deleteRun}
            onRestore={history.restore}
            onRetry={() => void history.refresh()}
            onClear={clearHistory}
          />
        }>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold tracking-tight text-foreground">
            Compare models
          </h2>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            One prompt, up to four models, answers side by side.
          </p>
        </div>
      </CompareTally>

      <section aria-label="Answers" className="flex min-h-0 min-w-0 flex-1 flex-col">
        {run ? (
          <>
            <div className="flex min-w-0 shrink-0 items-center gap-3 px-3 pt-3 sm:px-5">
              {/* Keyed by run so a new prompt settles in instead of swapping text in place. */}
              <div key={run.id} className="chat-message-entry min-w-0 flex-1">
                {run.isFromHistory && (
                  <p className="mb-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <HistoryIcon className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      Saved run - {savedRunDate.format(run.timestamp)}
                    </span>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto shrink-0 p-0 text-xs"
                      onClick={close}>
                      New comparison
                    </Button>
                  </p>
                )}
                <p className="truncate text-sm font-medium text-foreground" title={run.prompt}>
                  {run.prompt}
                </p>
                <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <span role="status" aria-live="polite" className="truncate">
                    {getRunStatus(run, getModelLabel)}
                  </span>
                  {totalCost && (
                    <span
                      className="shrink-0 font-mono tabular-nums duration-200 ease-[var(--ease-out)] animate-in fade-in-0"
                      title={
                        totalCost.isEstimate
                          ? 'Includes estimates from OpenRouter list prices'
                          : 'Reported by the providers'
                      }>
                      Run cost {formatCost(totalCost)}
                    </span>
                  )}
                </p>
              </div>
              {/* A segmented group keeps the run-level verdicts visually apart from the per-answer
                  Best buttons; the pressed segment lifts onto the background like a thumb. */}
              <div
                role="group"
                aria-label="Other votes"
                className={cn(
                  'flex shrink-0 items-center gap-0.5 rounded-full bg-muted p-0.5 transition-opacity duration-200',
                  !canVote && 'opacity-60'
                )}>
                {(['tie', 'none'] as const).map((choice) => {
                  const isPressed = run.winner === choice;
                  return (
                    <Button
                      key={choice}
                      type="button"
                      size="sm"
                      variant="ghost"
                      className={cn(
                        'h-8 rounded-full px-3.5 text-muted-foreground hover:bg-background/60 hover:text-foreground disabled:opacity-100',
                        isPressed &&
                          'bg-background text-foreground shadow-sm hover:bg-background dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent'
                      )}
                      disabled={!canVote}
                      aria-pressed={isPressed}
                      aria-label={choice === 'tie' ? 'Vote tie' : 'Vote none of the answers'}
                      onClick={() => handleVote(choice)}>
                      {choice === 'tie' ? 'Tie' : 'None'}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 snap-x snap-mandatory scroll-px-3 gap-3 overflow-x-auto overscroll-x-contain px-3 py-3 [scrollbar-width:thin] sm:scroll-px-5 sm:px-5 xl:overflow-x-hidden">
              {run.columns.map((column, index) => {
                const cost = getColumnCost(column);
                return (
                  <CompareColumn
                    key={column.id}
                    index={index}
                    column={column}
                    canVote={canVote}
                    isWinner={run.winner === column.model}
                    startedAt={run.startedAt}
                    isBestTtft={bests.ttft === column.id}
                    isBestTotal={bests.total === column.id}
                    isBestSpeed={bests.speed === column.id}
                    isCheapest={bests.cost === column.id}
                    costUsd={cost?.usd}
                    isCostEstimate={Boolean(cost?.isEstimate)}
                    onVote={handleVote}
                    onStop={stopColumn}
                    className="w-[86%] shrink-0 snap-start sm:w-[calc(50%-0.375rem)] xl:w-0 xl:flex-1"
                  />
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 overflow-y-auto px-4 py-6">
            <div className="m-auto flex max-w-lg flex-col items-center gap-3 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                {hasEnoughModels ? (
                  <Columns3Icon className="size-6" aria-hidden="true" />
                ) : (
                  <KeyRoundIcon className="size-6" aria-hidden="true" />
                )}
              </span>
              {hasEnoughModels ? (
                <>
                  <h3 className="text-lg font-semibold tracking-tight text-balance text-foreground">
                    Ask once, compare every answer
                  </h3>
                  <p className="text-sm text-pretty text-muted-foreground">
                    Pick two to four models below and send one prompt. Answers stream side by side
                    with time to first token, total time and token usage. Then vote for the best one
                    to build your own leaderboard.
                  </p>
                  <ul className="mt-1 flex flex-col items-stretch gap-2 sm:items-center">
                    {suggestions.map((suggestion, index) => (
                      <li
                        key={suggestion}
                        className="empty-hint-entry"
                        style={{ animationDelay: `${index * 50}ms` }}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-auto min-h-9 w-full rounded-full px-4 py-2 text-left whitespace-normal text-muted-foreground hover:text-foreground sm:w-auto"
                          onClick={() => setPrompt(suggestion)}>
                          {suggestion}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold tracking-tight text-balance text-foreground">
                    {!isSignedIn
                      ? 'Sign in or add a key to compare models'
                      : 'Compare needs at least two models'}
                  </h3>
                  <p className="text-sm text-pretty text-muted-foreground">
                    {!isSignedIn
                      ? 'The shared models need an account. You can also add your own provider key (BYOK) in Settings to compare the models it unlocks.'
                      : 'Add or unlock a provider key (BYOK) in Settings to unlock more text models.'}
                  </p>
                  <div className="mt-1 flex flex-wrap justify-center gap-2">
                    {!isSignedIn && (
                      <Button type="button" onClick={() => void clerk.redirectToSignIn()}>
                        Sign in
                        <ArrowRightIcon />
                      </Button>
                    )}
                    <Button type="button" variant="outline" onClick={openByokSettings}>
                      <KeyRoundIcon />
                      Open BYOK settings
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Keep the setup (and Stop) mounted while a run exists, even if models become unavailable. */}
      {(hasEnoughModels || run) && (
        <section
          aria-label="Compare setup"
          className="shrink-0 border-t border-border/70 bg-background/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:px-5">
          <div className="mx-auto w-full max-w-5xl min-w-0">
            {!hasEnoughModels && (
              <p role="status" className="mb-2 px-1 text-xs text-muted-foreground">
                Fewer than two models are available right now. Sign in or unlock a provider key to
                compare again.
              </p>
            )}
            <CompareComposer
              value={prompt}
              onChange={setPrompt}
              onSubmit={() => start(trimmedPrompt, selectedModels)}
              onStop={stop}
              isRunning={isRunning}
              canSubmit={canSubmit}
              disabledReason={disabledReason}>
              <ComparePickers
                runnableModels={runnableModels}
                slots={slots}
                findModel={findModel}
                onChange={setSlots}
                disabled={isRunning}
              />
            </CompareComposer>
          </div>
        </section>
      )}
    </div>
  );
};

export default Compare;

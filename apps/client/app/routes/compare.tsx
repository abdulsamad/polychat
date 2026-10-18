import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSetAtom } from 'jotai';
import { useAuth, useClerk } from '@clerk/react-router';
import {
  AlertCircleIcon,
  ArrowRightIcon,
  Columns3Icon,
  EyeIcon,
  EyeOffIcon,
  CornerDownRightIcon,
  HistoryIcon,
  KeyRoundIcon,
  ListChecksIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { defaultModel, type ImageAttachment } from 'utils';
import { userSettingsOpenAtom, userSettingsScrollTargetAtom } from '@/store';
import { cn, MAX_HOSTED_FILE_BYTES, MAX_IMAGE_ATTACHMENTS, readFileAsDataUrl } from '@/utils';
import { useByokModelAvailability } from '@/hooks/useByokModelAvailability';
import useCompareRun, {
  isSettledStatus,
  MAX_COMPARE_MODELS,
  MIN_COMPARE_MODELS,
  type CompareColumnState,
  type CompareEntry,
  type CompareRunState,
} from '@/hooks/useCompareRun';
import { useCompareSuites, useSuiteRunner } from '@/hooks/useCompareSuites';
import { configurationKey } from '@/utils/compare-settings';
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
import type {
  ICompareRun,
  ICompareRunColumn,
  ICompareSuite,
  ICompareVoteResult,
} from '@/utils/lforage';
import CompareColumn from '@/components/Compare/CompareColumn';
import CompareComposer, { COMPARE_IMAGE_TYPES } from '@/components/Compare/CompareComposer';
import CompareHistory from '@/components/Compare/CompareHistory';
import ComparePickers, {
  countSlotColumns,
  createCompareSlot,
  findDuplicateSlotIds,
  type CompareSlot,
} from '@/components/Compare/ComparePickers';
import CompareSuites from '@/components/Compare/CompareSuites';
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

const blindLetters = ['A', 'B', 'C', 'D'] as const;
const blindPreferenceKey = 'polychat-compare-blind';

const readBlindPreference = () => {
  try {
    return window.localStorage.getItem(blindPreferenceKey) === '1';
  } catch {
    return false;
  }
};

/** Rebuilds picker slots from saved columns: one slot per configuration, samples counted. */
const slotsFromColumns = (columns: readonly ICompareRunColumn[]) => {
  const slots = new Map<string, CompareSlot>();
  for (const { model, settings } of columns) {
    const key = configurationKey(model, settings);
    const existing = slots.get(key);
    if (existing) existing.samples = (existing.samples ?? 1) + 1;
    else slots.set(key, createCompareSlot(model, { settings }));
  }
  return [...slots.values()];
};

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
  if (run.blind) return 'Blind run: pick the best answer to reveal the models.';
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
  const { getPrice } = useModelPricing();
  const getVoteResultCost = useCallback(
    ({ model, provider, usage, costUsd }: ICompareVoteResult) =>
      resultCost({ usage, costUsd }, getPrice(model, provider)),
    [getPrice]
  );
  const votes = useCompareVotes(isReady, getVoteResultCost);
  const history = useCompareHistory(isReady);
  const [isBlind, setIsBlind] = useState(readBlindPreference);
  const {
    run,
    isRunning,
    canVote,
    canFollowUp,
    start,
    followUp,
    stop,
    stopColumn,
    vote,
    rate,
    open,
    close,
  } = useCompareRun({
    onVoteSaved: votes.refresh,
    onRunSaved: history.refresh,
  });
  const suites = useCompareSuites(isReady);
  const { activeSuite, startSuite, stopSuite } = useSuiteRunner(run, isRunning);
  const [slots, setSlots] = useState<CompareSlot[]>([]);
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [isFollowUpMode, setIsFollowUpMode] = useState(false);

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
    if (countSlotColumns(slots) >= MIN_COMPARE_MODELS) return;
    const names = runnableModels.map(({ name }) => name);
    const preferred = [defaultModel, ...names].filter(
      (name, index, all) => names.includes(name) && all.indexOf(name) === index
    );
    const next = [...slots];
    for (const name of preferred) {
      if (countSlotColumns(next) >= MIN_COMPARE_MODELS) break;
      if (!next.some(({ model }) => model === name)) next.push(createCompareSlot(name));
    }
    if (next.length !== slots.length) setSlots(next);
  }, [runnableModels, slots]);

  // Each slot becomes one column per sample; samples are numbered only when there are several.
  const entries = useMemo(
    () =>
      slots.flatMap(({ model, settings, samples = 1 }) => {
        const option = runnableModels.find(({ name }) => name === model);
        if (!option) return [];
        return Array.from({ length: samples }, (_, index): CompareEntry => ({
          model: option,
          settings,
          ...(samples > 1 ? { sample: index + 1 } : {}),
        }));
      }),
    [runnableModels, slots]
  );
  const hasUnavailableSlot = slots.some(
    ({ model }) => !runnableModels.some(({ name }) => name === model)
  );
  const hasDuplicateSlots = findDuplicateSlotIds(slots).size > 0;
  const hasValidSelection =
    entries.length >= MIN_COMPARE_MODELS &&
    entries.length <= MAX_COMPARE_MODELS &&
    !hasUnavailableSlot &&
    !hasDuplicateSlots;
  const selectionReason = hasUnavailableSlot
    ? 'Replace the unavailable model.'
    : hasDuplicateSlots
      ? 'Two slots are identical. Change a setting, or use samples.'
      : !hasValidSelection
        ? 'Choose at least two columns to compare.'
        : undefined;
  // Follow-up mode applies only while the shown run can still be continued.
  const isFollowingUp = isFollowUpMode && canFollowUp;
  const followUpModels = isFollowingUp && run ? run.columns.filter(hasAnswer) : [];
  const trimmedPrompt = prompt.trim();
  const canSubmit =
    isReady && Boolean(trimmedPrompt) && !isRunning && (isFollowingUp || hasValidSelection);
  const disabledReason = !trimmedPrompt
    ? 'Type a prompt to compare.'
    : isFollowingUp
      ? undefined
      : selectionReason;
  // Images go to every model in the run, so all of them must accept images.
  const imageTargets = isFollowingUp
    ? followUpModels.map(({ model }) => findModel(model))
    : slots.map(({ model }) => findModel(model));
  const canAttachImages =
    imageTargets.length > 0 && imageTargets.every((model) => model?.supportsVision);
  const attachImagesHint = canAttachImages
    ? `Attach up to ${MAX_IMAGE_ATTACHMENTS} images (2 MB total)`
    : 'Images need models that all accept images';

  const getModelLabel = useCallback(
    (model: string) => findModel(model)?.text ?? model,
    [findModel]
  );
  const handleVote = useCallback(
    (winner: Parameters<typeof vote>[0], winnerColumnId?: string) => {
      void vote(winner, winnerColumnId);
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
  // Rerun a saved prompt with the same configurations (and conversation, for follow-ups).
  // Unavailable models are left in the pickers for the user to replace.
  const rerun = (stored: ICompareRun) => {
    stopSuite();
    setIsFollowUpMode(false);
    setImages([]);
    const rerunEntries = stored.columns.flatMap(({ model, settings, sample, history }) => {
      const option = runnableModels.find(({ name }) => name === model);
      return option ? [{ model: option, settings, sample, history }] : [];
    });
    setPrompt(stored.prompt);
    setSlots(slotsFromColumns(stored.columns));
    if (
      rerunEntries.length === stored.columns.length &&
      rerunEntries.length >= MIN_COMPARE_MODELS
    ) {
      start(stored.prompt, rerunEntries, { blind: Boolean(stored.blind) });
      if (stored.attachments?.length) {
        toast('Images are not kept in history, so this rerun was sent without them.');
      }
    } else {
      toast.error('Some models from that run are unavailable. Pick replacements, then send.');
    }
  };
  const openRun = (stored: ICompareRun) => {
    stopSuite();
    setIsFollowUpMode(false);
    open(stored);
  };
  const submit = () => {
    if (!canSubmit) return;
    stopSuite();
    const started = isFollowingUp
      ? followUp(trimmedPrompt, images)
      : start(trimmedPrompt, entries, { blind: isBlind, imageAttachments: images });
    if (!started) return;
    setImages([]);
    // A follow-up reads like chat, so the box clears; a new comparison keeps its prompt to tweak.
    if (isFollowingUp) setPrompt('');
  };
  const stopAll = () => {
    // End the suite first, so the stopped run does not advance it.
    stopSuite();
    stop();
  };
  const runSuite = (suite: ICompareSuite) => {
    setIsFollowUpMode(false);
    setImages([]);
    startSuite(suite, (suitePrompt, tag) =>
      start(suitePrompt, entries, { blind: isBlind, suite: tag })
    );
  };
  const addImages = async (files: FileList) => {
    const picked = Array.from(files).filter(({ type }) =>
      COMPARE_IMAGE_TYPES.split(',').includes(type)
    );
    if (picked.length < files.length)
      toast.error('Only JPEG, PNG, WebP and GIF images can be attached.');
    const room = MAX_IMAGE_ATTACHMENTS - images.length;
    if (picked.length > room) toast.error(`You can attach up to ${MAX_IMAGE_ATTACHMENTS} images.`);
    let totalBytes = images.reduce((total, { size }) => total + size, 0);
    // The hosted API limit applies to the whole request, so it is enforced for every run.
    const accepted = picked.slice(0, Math.max(0, room)).filter(({ size }) => {
      if (totalBytes + size > MAX_HOSTED_FILE_BYTES) return false;
      totalBytes += size;
      return true;
    });
    if (accepted.length < Math.min(picked.length, Math.max(0, room))) {
      toast.error('Images are limited to 2 MB per comparison.');
    }
    try {
      const attachments = await Promise.all(
        accepted.map(async (file) => ({
          id: crypto.randomUUID(),
          name: file.name,
          mediaType: file.type,
          size: file.size,
          dataUrl: await readFileAsDataUrl(file),
        }))
      );
      setImages((current) => [...current, ...attachments]);
    } catch (error) {
      console.error('Failed to read compare images', error);
      toast.error('Could not read one of the images.');
    }
  };
  const closeRun = () => {
    stopSuite();
    setIsFollowUpMode(false);
    close();
  };
  const deleteRun = async (runId: string) => {
    await history.remove(runId);
    // A deleted run that stays open would be saved again by its next vote.
    if (run?.id === runId && !isRunning) closeRun();
  };
  const clearHistory = async () => {
    try {
      await history.clear();
      if (run?.isFromHistory) closeRun();
      toast.success('History cleared');
    } catch (error) {
      console.error('Failed to clear compare history', error);
      toast.error('Could not clear history.');
    }
  };
  const toggleBlind = () => {
    const next = !isBlind;
    setIsBlind(next);
    try {
      window.localStorage.setItem(blindPreferenceKey, next ? '1' : '0');
    } catch {
      // A per-viewer convenience; the toggle still works for this visit.
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
  const isIdentityHidden = Boolean(run?.blind && !run.winner);
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
        getHeadToHead={votes.getHeadToHead}
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
            onOpenRun={openRun}
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
                      onClick={closeRun}>
                      New comparison
                    </Button>
                  </p>
                )}
                {(run.suite || run.parentRunId) && (
                  <p className="mb-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    {run.suite ? (
                      <>
                        <ListChecksIcon className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          {run.suite.suiteName} - prompt {run.suite.index + 1} of {run.suite.total}
                        </span>
                        {activeSuite?.suiteRunId === run.suite.suiteRunId && (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto shrink-0 p-0 text-xs"
                            onClick={stopSuite}>
                            Stop after this prompt
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <CornerDownRightIcon className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">Follow-up turn</span>
                      </>
                    )}
                  </p>
                )}
                <p className="truncate text-sm font-medium text-foreground" title={run.prompt}>
                  {run.prompt}
                </p>
                <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <span role="status" aria-live="polite" className="truncate">
                    {getRunStatus(run, getModelLabel)}
                  </span>
                  {totalCost && !isIdentityHidden && (
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
                    isWinner={
                      run.winnerColumnId
                        ? run.winnerColumnId === column.id
                        : run.winner === column.model
                    }
                    startedAt={run.startedAt}
                    isBestTtft={bests.ttft === column.id}
                    isBestTotal={bests.total === column.id}
                    isBestSpeed={bests.speed === column.id}
                    isCheapest={bests.cost === column.id}
                    costUsd={cost?.usd}
                    isCostEstimate={Boolean(cost?.isEstimate)}
                    blindLetter={run.blind ? blindLetters[index] : undefined}
                    isIdentityHidden={isIdentityHidden}
                    canRate={canVote}
                    onRate={rate}
                    onVote={handleVote}
                    onStop={stopColumn}
                    currentPrompt={column.history?.length ? run.prompt : undefined}
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
              onSubmit={submit}
              onStop={stopAll}
              isRunning={isRunning}
              canSubmit={canSubmit}
              disabledReason={disabledReason}
              images={images}
              canAttachImages={canAttachImages}
              attachImagesHint={attachImagesHint}
              onAddImages={(files) => void addImages(files)}
              onRemoveImage={(id) =>
                setImages((current) => current.filter((image) => image.id !== id))
              }
              followUp={
                run && canFollowUp
                  ? {
                      isActive: isFollowingUp,
                      parentPrompt: run.prompt,
                      onToggle: () => setIsFollowUpMode((current) => !current),
                    }
                  : undefined
              }>
              <div className="flex min-w-0 items-start gap-1.5">
                <div className="min-w-0 flex-1">
                  <ComparePickers
                    runnableModels={runnableModels}
                    slots={slots}
                    findModel={findModel}
                    onChange={setSlots}
                    disabled={isRunning || isFollowingUp}
                  />
                </div>
                <CompareSuites
                  suites={suites.suites}
                  isLoading={suites.isLoading}
                  canRun={hasValidSelection && !isRunning}
                  runDisabledReason={
                    isRunning ? 'Wait for the current run to finish.' : selectionReason
                  }
                  disabled={isRunning}
                  onSave={suites.save}
                  onDelete={suites.remove}
                  onRun={runSuite}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isRunning}
                  aria-pressed={isBlind}
                  title={
                    isBlind
                      ? 'Blind mode on: columns are shuffled and names stay hidden until you vote'
                      : 'Blind mode off: model names are shown while you judge'
                  }
                  className={cn(
                    'mt-0.5 h-9 shrink-0 gap-1.5 rounded-full px-3 text-muted-foreground hover:text-foreground',
                    isBlind &&
                      'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                  onClick={toggleBlind}>
                  {isBlind ? <EyeOffIcon /> : <EyeIcon />}
                  <span className="hidden sm:inline">Blind</span>
                  <span className="sr-only sm:hidden">Blind mode</span>
                </Button>
              </div>
            </CompareComposer>
          </div>
        </section>
      )}
    </div>
  );
};

export default Compare;

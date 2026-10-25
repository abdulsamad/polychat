import { useCallback, useEffect, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useAuth, useUser } from '@clerk/react-router';
import { toast } from 'sonner';

import { VideoApiError, type ImageAttachment } from 'utils';
import { configAtom, enqueuePersistence, type IMessage, type IVideoMessage } from '@/store';
import { toModelConfig } from '@/utils/compare-settings';
import {
  getGeneratedImage,
  getGeneratedText,
  getGeneratedVideo,
  type ChatStreamPart,
} from '@/utils/api-calls';
import { providerForModel } from '@/utils/byok-providers';
import { getProviderKey, isProviderConfiguredSync } from '@/utils/byok-vault';
import {
  getAnonymousWorkspaceAccount,
  saveCompareRun,
  saveCompareVote,
  type CompareRubric,
  type CompareOutputType,
  type CompareRubricCriterion,
  type CompareSlotSettings,
  type CompareSuiteTag,
  type CompareTurn,
  type CompareWinner,
  type ICompareRun,
  type ICompareRunColumn,
  type ICompareVote,
} from '@/utils/lforage';
import type { ModelOption } from './useByokModelAvailability';

/** Matches the chat stream throttle so four parallel streams do not re-render per chunk. */
const STREAM_UPDATE_INTERVAL_MS = 60;

export const MIN_COMPARE_MODELS = 2;
export const MAX_COMPARE_MODELS = 4;
/** The image request schema accepts at most four reference images. */
const MAX_REFERENCE_IMAGES = 4;
const STOPPED_VIDEO_MESSAGE = 'Stopped checking. The provider may still be generating your video.';

export type CompareColumnStatus = 'waiting' | 'streaming' | 'done' | 'failed' | 'stopped';

/** A live column: the stored shape plus in-flight statuses and the thinking flag. */
export interface CompareColumnState extends Omit<ICompareRunColumn, 'status'> {
  status: CompareColumnStatus;
  isThinking: boolean;
  /** performance.now() when a retried column restarted; live only, never written to history. */
  startedAt?: number;
}

export interface CompareRunState {
  id: string;
  prompt: string;
  timestamp: number;
  /** performance.now() when the run started, for live elapsed timers. 0 for saved runs. */
  startedAt: number;
  columns: CompareColumnState[];
  winner: CompareWinner | null;
  /** True when the run was reopened from history rather than streamed in this session. */
  isFromHistory?: boolean;
  /** Columns were shuffled and model names stay hidden until a vote is cast. */
  blind?: boolean;
  winnerColumnId?: string;
  parentRunId?: string;
  attachments?: ICompareRun['attachments'];
  /** Image data for this run's prompt; live only, never written to history. */
  imageAttachments?: ImageAttachment[];
  suite?: CompareSuiteTag;
  outputType?: ICompareRun['outputType'];
  isMediaPruned?: boolean;
}

/** One column to run: a model configuration, optionally with earlier turns to continue. */
export interface CompareEntry {
  model: Pick<ModelOption, 'name' | 'text' | 'provider' | 'type'>;
  settings?: CompareSlotSettings;
  sample?: number;
  history?: CompareTurn[];
  /** The column's own previous image, sent back so an image follow-up refines it. Live only. */
  referenceImage?: ImageAttachment;
}

export interface CompareStartOptions {
  blind?: boolean;
  /** Keep the given column order even for a blind run (follow-ups keep their letters). */
  keepOrder?: boolean;
  imageAttachments?: ImageAttachment[];
  parentRunId?: string;
  /** Images of the parent prompt, re-sent with that turn so a follow-up keeps its context. */
  parentImageAttachments?: ImageAttachment[];
  suite?: CompareSuiteTag;
}

export const isSettledStatus = (status: CompareColumnStatus) =>
  status === 'done' || status === 'failed' || status === 'stopped';

/** A column produced something to judge: text, an image, or a video that finished. */
export const hasOutput = ({
  content,
  image,
  video,
}: Pick<ICompareRunColumn, 'content' | 'image' | 'video'>) =>
  content.trim().length > 0 || Boolean(image?.url) || video?.status === 'ready';

const isSettledColumn = (
  column: CompareColumnState
): column is CompareColumnState & { status: ICompareRunColumn['status'] } =>
  isSettledStatus(column.status);

/**
 * A settled column as stored. A column still running only reaches history in the snapshot taken
 * once a video job is accepted; it is saved as stopped, so a reload offers to check the job.
 */
const toColumnRecord = (column: CompareColumnState): ICompareRunColumn => {
  const { isThinking: _isThinking, startedAt: _startedAt, ...stored } = column;
  return isSettledColumn(column)
    ? { ...stored, status: column.status }
    : { ...stored, status: 'stopped' };
};

/** A generated image as a reference attachment for the next turn. */
const toReferenceImage = ({
  id,
  image,
}: Pick<ICompareRunColumn, 'id' | 'image'>): ImageAttachment | undefined => {
  const encoded = image?.url.match(/^data:image\/[a-z]+;base64,(.+)$/)?.[1];
  if (!image || !encoded) return undefined;
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return {
    id: `previous-${id}`,
    name: 'previous-image.png',
    mediaType: image.url.slice(5, image.url.indexOf(';')),
    size: Math.max(1, Math.floor((encoded.length * 3) / 4) - padding),
    dataUrl: image.url,
  };
};

const toRunRecord = ({
  id,
  timestamp,
  prompt,
  columns,
  winner,
  winnerColumnId,
  blind,
  parentRunId,
  attachments,
  suite,
  outputType,
  isMediaPruned,
}: CompareRunState): ICompareRun => ({
  id,
  timestamp,
  prompt,
  winner,
  ...(winnerColumnId ? { winnerColumnId } : {}),
  ...(blind ? { blind } : {}),
  ...(parentRunId ? { parentRunId } : {}),
  ...(attachments?.length ? { attachments } : {}),
  ...(suite ? { suite } : {}),
  ...(outputType ? { outputType } : {}),
  ...(isMediaPruned ? { isMediaPruned } : {}),
  columns: columns.map(toColumnRecord),
});

/** Everything about a settled run that the history copy must reflect, including retried columns. */
const getHistorySignature = ({ winner, winnerColumnId, blind, columns }: CompareRunState) =>
  JSON.stringify([
    winner,
    winnerColumnId ?? null,
    Boolean(blind),
    columns.map(({ status, content, error, rubric, image, video }) => [
      status,
      content.length,
      error ?? null,
      rubric ?? null,
      image?.url.length ?? null,
      video?.status ?? null,
      video?.jobId ?? null,
    ]),
  ]);

/** A video run with a job the provider accepted is saved before it settles, to survive a reload. */
const hasPendingVideoJob = ({ outputType, columns }: CompareRunState) =>
  outputType === 'video' &&
  columns.some(({ status, video }) => !isSettledStatus(status) && Boolean(video?.jobId));

const toVoteRecord = (
  run: CompareRunState,
  winner: CompareWinner,
  winnerColumnId?: string
): ICompareVote => ({
  id: run.id,
  timestamp: run.timestamp,
  prompt: run.prompt,
  winner,
  ...(winnerColumnId ? { winnerColumnId } : {}),
  ...(run.blind ? { blind: true } : {}),
  ...(run.outputType ? { outputType: run.outputType } : {}),
  results: run.columns.map((column) => ({
    model: column.model,
    provider: column.provider,
    ttftMs: column.ttftMs ?? null,
    totalMs: column.totalMs ?? null,
    ...(column.usage ? { usage: column.usage } : {}),
    ...(column.costUsd !== undefined ? { costUsd: column.costUsd } : {}),
    ...(column.finishReason ? { finishReason: column.finishReason } : {}),
    ...(column.rubric && Object.keys(column.rubric).length ? { rubric: column.rubric } : {}),
    failed: column.status === 'failed' || !hasOutput(column),
  })),
});

const toTurnMessage = (
  role: IMessage['role'],
  content: string,
  model: string,
  imageAttachments?: ImageAttachment[]
): IMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  type: 'text',
  metadata: { profile: null, timestamp: Date.now(), model },
  ...(imageAttachments?.length ? { imageAttachments } : {}),
});

/**
 * Earlier turns as alternating user/assistant messages, ending with the new prompt. Only the
 * newest earlier turn can carry its images (they are live-only); older turns are text.
 */
const toTurnMessages = (
  history: readonly CompareTurn[],
  prompt: string,
  model: string,
  { latest, previous }: { latest?: ImageAttachment[]; previous?: ImageAttachment[] }
) => [
  ...history.flatMap(({ prompt: turnPrompt, answer }, index) => [
    toTurnMessage('user', turnPrompt, model, index === history.length - 1 ? previous : undefined),
    toTurnMessage('assistant', answer, model),
  ]),
  toTurnMessage('user', prompt, model, latest),
];

/** Fisher-Yates, so every order is equally likely in a blind run. */
const shuffle = <T>(items: readonly T[]) => {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
};

/** Hides the served id when it is just a dated or namespaced form of the picked model. */
const getServedModelId = (picked: string, served?: string) =>
  served && !served.toLowerCase().includes(picked.toLowerCase()) ? served : undefined;

const toErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return 'Something went wrong.';
  // fetch and stream reads reject with a TypeError on network failure ("Failed to fetch",
  // "Load failed", "network error"); an AbortError without our abort means the connection
  // was dropped. Provider and server messages are shown as they are.
  if (error instanceof TypeError || error.name === 'AbortError') {
    return 'Connection closed while waiting for the response.';
  }
  return error.message || 'Something went wrong.';
};

/**
 * Runs one prompt against several models of one output type (text, image or video) in
 * parallel. Each column owns its AbortController, so one failure or stop never affects the
 * other columns. Settled runs and votes are saved to history.
 */
const useCompareRun = ({
  findModel,
  onVoteSaved,
  onRunSaved,
}: {
  /** Resolves a column's model, for its capabilities and media settings at request time. */
  findModel?: (name: string) => ModelOption | undefined;
  onVoteSaved?: () => void;
  onRunSaved?: () => void;
} = {}) => {
  const config = useAtomValue(configAtom);
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();
  const accountId = user?.id ?? getAnonymousWorkspaceAccount();
  const [run, setRun] = useState<CompareRunState | null>(null);
  const runRef = useRef(run);
  runRef.current = run;

  const runIdRef = useRef<string | null>(null);
  const columnsRef = useRef<CompareColumnState[]>([]);
  const controllersRef = useRef<AbortController[]>([]);
  /** The live run's images, kept so a retried column sends the same request. */
  const imagesRef = useRef<{ latest?: ImageAttachment[]; previous?: ImageAttachment[] }>({});
  /** Each live column's own previous image (image follow-ups), by column id. */
  const referencesRef = useRef(new Map<string, ImageAttachment>());
  const outputTypeRef = useRef<CompareOutputType>('text');
  const findModelRef = useRef(findModel);
  findModelRef.current = findModel;
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const onVoteSavedRef = useRef(onVoteSaved);
  onVoteSavedRef.current = onVoteSaved;
  const onRunSavedRef = useRef(onRunSaved);
  onRunSavedRef.current = onRunSaved;
  /** The history signature last written per run, so each settled state is saved once. */
  const persistedRunsRef = useRef(new Map<string, string>());
  /**
   * Set when the saved vote of this run was written before its columns had all settled (a vote
   * cast mid-run, or a retry after the vote), so the vote is saved again with the final results.
   */
  const staleVoteRunRef = useRef<string | null>(null);
  /** The last winner that was actually written for a run, used to roll back a failed change. */
  const savedVoteRef = useRef<{
    runId: string;
    winner: CompareWinner;
    winnerColumnId?: string;
  } | null>(null);

  const flush = useCallback(() => {
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (!mountedRef.current) return;

    const runId = runIdRef.current;
    const columns = columnsRef.current.slice();
    setRun((current) => (current && current.id === runId ? { ...current, columns } : current));
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current === null) {
      flushTimerRef.current = setTimeout(flush, STREAM_UPDATE_INTERVAL_MS);
    }
  }, [flush]);

  const abortAll = useCallback(() => {
    controllersRef.current.forEach((controller) => controller.abort());
  }, []);

  /** Aborts every request and detaches the current run, so late stream updates are ignored. */
  const detachRun = useCallback(() => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current = [];
    imagesRef.current = {};
    referencesRef.current = new Map();
    runIdRef.current = null;
    columnsRef.current = [];
    if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
  }, []);

  // Unmount only: leaving the route aborts every request and drops pending renders. Under
  // StrictMode the simulated unmount runs this too; the remount flips mountedRef back.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      detachRun();
    };
  }, [detachRun]);

  // Account switch: a different account must never see or continue the previous run. The
  // reset runs in the effect body (while mounted), never in a cleanup.
  const accountRef = useRef(accountId);
  useEffect(() => {
    if (accountRef.current === accountId) return;
    accountRef.current = accountId;
    detachRun();
    setRun(null);
  }, [accountId, detachRun]);

  // History: save a run once every column has settled, and again whenever its vote or rubric
  // scores change (including a rolled-back vote). A video run is also saved once a job is
  // accepted, so a reload can resume it. Writes are queued, so they never overtake.
  useEffect(() => {
    if (!run) return;
    const isSettled = run.columns.every(({ status }) => isSettledStatus(status));
    if (!isSettled && !hasPendingVideoJob(run)) return;
    const persisted = persistedRunsRef.current;
    const signature = getHistorySignature(run);
    if (persisted.get(run.id) === signature) return;
    persisted.set(run.id, signature);

    if (
      isSettled &&
      run.winner &&
      staleVoteRunRef.current === run.id &&
      savedVoteRef.current?.runId === run.id
    ) {
      staleVoteRunRef.current = null;
      const vote = toVoteRecord(run, run.winner, run.winnerColumnId);
      enqueuePersistence(() => saveCompareVote(vote))
        .then((saved) => {
          if (saved) onVoteSavedRef.current?.();
        })
        .catch((error) => {
          console.error('Failed to update compare vote', error);
          toast.error('Could not update your vote with the final answers.');
        });
    }

    const record = toRunRecord(run);
    enqueuePersistence(() => saveCompareRun(record))
      .then((saved) => {
        if (saved) onRunSavedRef.current?.();
      })
      .catch((error) => {
        console.error('Failed to save compare run', error);
        persisted.delete(record.id);
        toast.error('Could not save this comparison to history.');
      });
  }, [run]);

  const runColumn = useCallback(
    async (
      runId: string,
      index: number,
      prompt: string,
      signal: AbortSignal,
      images: { latest?: ImageAttachment[]; previous?: ImageAttachment[] }
    ) => {
      const startedAt = performance.now();
      const update = (patch: Partial<CompareColumnState>, immediate = false) => {
        if (runIdRef.current !== runId) return;
        const columns = columnsRef.current;
        columns[index] = { ...columns[index], ...patch };
        if (immediate) flush();
        else scheduleFlush();
      };
      const elapsed = () => Math.round(performance.now() - startedAt);
      const { id: columnId, model, provider, settings, history } = columnsRef.current[index];
      const outputType = outputTypeRef.current;
      const option = findModelRef.current?.(model);
      const slotModel = {
        name: model,
        type: outputType,
        imageCapabilities: option?.imageCapabilities,
        videoCapabilities: option?.videoCapabilities,
      };
      /** The accepted video job, kept so a stop or failure can still offer to check it. */
      let videoJob: IVideoMessage['video_url'] | undefined;

      let reader: ReadableStreamDefaultReader<ChatStreamPart> | undefined;
      let content = '';
      let hasFirstPart = false;
      let settled = false;
      const settle = (patch: Partial<CompareColumnState>) => {
        if (settled) return;
        settled = true;
        update({ ...patch, isThinking: false, totalMs: elapsed() }, true);
      };
      // Settle immediately on Stop, even if a provider stream is slow to reject after abort.
      // A stopped video keeps its job, since the provider may still finish it.
      const onAbort = () => {
        void reader?.cancel().catch(() => undefined);
        settle({
          status: 'stopped',
          ...(videoJob
            ? { video: { ...videoJob, status: 'failed', error: STOPPED_VIDEO_MESSAGE } }
            : {}),
        });
      };
      signal.addEventListener('abort', onAbort, { once: true });

      try {
        const apiKey = getProviderKey(accountId, provider);

        if (outputType === 'image') {
          const imageConfig = toModelConfig(slotModel, settings);
          const reference = referencesRef.current.get(columnId);
          // The column's own image leads, so a full set of attachments never crowds it out.
          const referenceImages = option?.supportsImageReferences
            ? [...(reference ? [reference] : []), ...(images.latest ?? [])].slice(
                0,
                MAX_REFERENCE_IMAGES
              )
            : undefined;
          update({ status: 'streaming' }, true);
          const result = await getGeneratedImage({
            prompt,
            model,
            provider,
            size: imageConfig.size,
            quality: imageConfig.quality ?? 'standard',
            style: imageConfig.style ?? 'vivid',
            referenceImages,
            getToken,
            apiKey,
            signal,
          });
          if (!('b64_json' in result)) {
            throw Object.assign(new Error(result.err), { status: result.status });
          }
          if (signal.aborted) {
            onAbort();
            return;
          }
          const { usage } = result;
          const hasUsage = Boolean(
            usage &&
            [usage.inputTokens, usage.outputTokens, usage.totalTokens].some(
              (value) => typeof value === 'number'
            )
          );
          settle({
            status: 'done',
            image: {
              url: `data:image/png;base64,${result.b64_json}`,
              alt: result.revisedPrompt ?? '',
              size: imageConfig.size ?? '',
            },
            ...(hasUsage ? { usage } : {}),
          });
          return;
        }

        if (outputType === 'video') {
          const videoStartedAt = Date.now();
          update({ status: 'streaming' }, true);
          const result = await getGeneratedVideo({
            prompt,
            model,
            provider,
            apiKey,
            modelConfig: toModelConfig(slotModel, settings),
            inputReferences: images.latest,
            signal,
            onJob: (job, downloading) => {
              videoJob = {
                url: '',
                mediaType: 'video/mp4',
                size: 0,
                status: 'generating',
                jobId: job.id,
                startedAt: videoStartedAt,
                jobStatus: downloading
                  ? 'completed'
                  : job.status === 'pending'
                    ? 'pending'
                    : 'in_progress',
              };
              if (!settled) update({ video: videoJob }, true);
            },
          });
          if (!('url' in result)) {
            throw Object.assign(new Error(result.err), { status: result.status });
          }
          if (signal.aborted) {
            onAbort();
            return;
          }
          settle({
            status: 'done',
            video: { ...result, startedAt: videoStartedAt },
            ...(typeof result.cost === 'number' ? { costUsd: result.cost } : {}),
          });
          return;
        }

        const request = {
          model,
          provider,
          // The neutral profile keeps every model on the same system prompt unless the slot
          // picks another preset. The custom profile is never offered in compare.
          profile: settings?.profile ?? 'normal',
          language: config.language,
          modelConfig: toModelConfig(slotModel, settings),
          getToken,
          apiKey,
          // Compare measures each answer, so a hidden retry would hide the failure and add its
          // backoff to the timings. Failed columns get a visible Retry instead.
          maxRetries: 0,
          signal,
        };
        const result = await getGeneratedText(
          history?.length
            ? { ...request, messages: toTurnMessages(history, prompt, model, images) }
            : { ...request, prompt, imageAttachments: images.latest }
        );

        if ('success' in result) {
          throw Object.assign(new Error(result.err), { status: result.status });
        }

        reader = result.getReader();
        if (signal.aborted) {
          onAbort();
          return;
        }
        while (true) {
          const { value, done } = await reader.read();
          if (signal.aborted) break;
          if (done) break;

          if (!hasFirstPart) {
            hasFirstPart = true;
            update({ status: 'streaming' }, true);
          }

          if (value.type === 'text') {
            content += value.text;
            const isFirstToken = columnsRef.current[index].ttftMs === undefined;
            update(
              { content, isThinking: false, ...(isFirstToken ? { ttftMs: elapsed() } : {}) },
              isFirstToken
            );
          } else if (value.type === 'reasoning') {
            if (!content) {
              const isFirstReasoning = columnsRef.current[index].reasoningStartMs === undefined;
              update({
                isThinking: true,
                ...(isFirstReasoning ? { reasoningStartMs: elapsed() } : {}),
              });
            }
          } else if (value.type === 'reasoning-end') {
            update({ isThinking: false });
          } else if (value.type === 'metadata') {
            const { usage, finishReason, costUsd, modelId } = value.metadata;
            update({
              usage,
              finishReason,
              costUsd,
              servedModelId: getServedModelId(model, modelId),
            });
          } else if (value.type === 'error') {
            throw new Error(value.error);
          }
        }

        if (signal.aborted) {
          onAbort();
          return;
        }

        settle({
          status: 'done',
          ...(content.trim() ? {} : { error: 'The model returned an empty response.' }),
        });
      } catch (error) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        void reader?.cancel().catch(() => undefined);
        console.error(error);
        const message = toErrorMessage(error);
        settle({
          status: 'failed',
          error: message,
          // A failed job can often still be checked without paying for another generation.
          ...(videoJob
            ? {
                video: {
                  ...videoJob,
                  status: 'failed',
                  error: message,
                  terminal: error instanceof VideoApiError && error.terminal,
                },
              }
            : {}),
        });
      } finally {
        signal.removeEventListener('abort', onAbort);
      }
    },
    [accountId, config.language, flush, getToken, scheduleFlush]
  );

  /** Returns false when the run could not start, so the caller can keep the prompt. */
  const start = useCallback(
    (rawPrompt: string, entries: readonly CompareEntry[], options: CompareStartOptions = {}) => {
      const { blind = false, keepOrder = false, imageAttachments, parentRunId, suite } = options;
      const prompt = rawPrompt.trim();
      if (!prompt || entries.length < MIN_COMPARE_MODELS) return false;

      const picked = entries.slice(0, MAX_COMPARE_MODELS);
      // Votes and metrics only compare like with like, so a run has one output type.
      const outputTypes = new Set(picked.map(({ model }) => model.type));
      if (outputTypes.size !== 1) return false;
      const [outputType] = outputTypes;
      // Blind runs shuffle the picker order, so a column's position says nothing about its model.
      const ordered = blind && !keepOrder ? shuffle(picked) : picked;
      const columns = ordered.map(({ model, settings, sample, history }): CompareColumnState => ({
        id: crypto.randomUUID(),
        model: model.name,
        modelLabel: model.text,
        provider: providerForModel(model.name, model.provider),
        status: 'waiting',
        content: '',
        isThinking: false,
        ...(settings && Object.keys(settings).length ? { settings } : {}),
        ...(sample ? { sample } : {}),
        ...(history?.length ? { history } : {}),
      }));

      // Mirror the chat composer: a configured but locked vault key must be unlocked first.
      const lockedProviders = [
        ...new Set(
          columns
            .map(({ provider }) => provider)
            .filter(
              (provider) =>
                isProviderConfiguredSync(accountId, provider) &&
                !getProviderKey(accountId, provider)
            )
        ),
      ];
      if (lockedProviders.length) {
        toast.error(`Unlock your ${lockedProviders.join(', ')} BYOK vault key before comparing.`);
        return false;
      }
      const needsSignIn = columns.some(({ provider }) => !getProviderKey(accountId, provider));
      if (needsSignIn && !isSignedIn) {
        toast.error('Sign in or add a BYOK key to use the shared models.');
        return false;
      }

      abortAll();
      const runId = crypto.randomUUID();
      const controllers = columns.map(() => new AbortController());
      runIdRef.current = runId;
      columnsRef.current = columns;
      controllersRef.current = controllers;
      outputTypeRef.current = outputType;
      referencesRef.current = new Map(
        ordered.flatMap(({ referenceImage }, index) =>
          referenceImage ? [[columns[index].id, referenceImage] as const] : []
        )
      );
      if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;

      setRun({
        id: runId,
        prompt,
        timestamp: Date.now(),
        startedAt: performance.now(),
        columns: columns.slice(),
        winner: null,
        ...(blind ? { blind } : {}),
        ...(parentRunId ? { parentRunId } : {}),
        ...(imageAttachments?.length
          ? {
              imageAttachments,
              attachments: imageAttachments.map(({ name, mediaType, size }) => ({
                name,
                mediaType,
                size,
              })),
            }
          : {}),
        ...(suite ? { suite } : {}),
        ...(outputType !== 'text' ? { outputType } : {}),
      });
      const images = { latest: imageAttachments, previous: options.parentImageAttachments };
      imagesRef.current = images;
      columns.forEach((_, index) => {
        void runColumn(runId, index, prompt, controllers[index].signal, images);
      });
      return true;
    },
    [abortAll, accountId, isSignedIn, runColumn]
  );

  /**
   * Continues the current run with a new prompt. Every column that answered keeps its own
   * conversation (and settings), so models are judged on how they follow up on themselves.
   * Image columns get their previous image back as a reference to refine; media requests take
   * no earlier turns, so those keep only their prompts. The new turn is a separate run with its
   * own vote.
   */
  const followUp = useCallback(
    (rawPrompt: string, imageAttachments?: ImageAttachment[]) => {
      const parent = runRef.current;
      if (!parent || !parent.columns.every(({ status }) => isSettledStatus(status))) return false;

      const entries = parent.columns.filter(hasOutput).map((column): CompareEntry => {
        const referenceImage = toReferenceImage(column);
        return {
          model: {
            name: column.model,
            text: column.modelLabel,
            provider: column.provider,
            type: parent.outputType ?? 'text',
          },
          settings: column.settings,
          sample: column.sample,
          history: [
            ...(column.history ?? []),
            { prompt: parent.prompt, answer: parent.outputType ? '' : column.content },
          ],
          ...(referenceImage ? { referenceImage } : {}),
        };
      });
      if (entries.length < MIN_COMPARE_MODELS) {
        toast.error('A follow-up needs at least two answers to continue.');
        return false;
      }

      return start(rawPrompt, entries, {
        // A revealed blind run stays revealed; an unvoted one keeps its letters and secrecy.
        blind: Boolean(parent.blind && !parent.winner),
        keepOrder: true,
        imageAttachments,
        parentRunId: parent.id,
        parentImageAttachments: parent.imageAttachments,
      });
    },
    [start]
  );

  const stopColumn = useCallback((columnId: string) => {
    const index = columnsRef.current.findIndex(({ id }) => id === columnId);
    if (index !== -1) controllersRef.current[index]?.abort();
  }, []);

  /**
   * Sends a failed column's request again, keeping the other answers. Only the live run can be
   * retried. A saved vote is written again once the retried column settles; the voted column
   * itself cannot be retried, so a vote never points at an answer that changed.
   */
  const retryColumn = useCallback(
    (columnId: string) => {
      const current = runRef.current;
      const runId = runIdRef.current;
      if (!current || current.id !== runId || current.winnerColumnId === columnId) return;

      const index = columnsRef.current.findIndex(({ id }) => id === columnId);
      const column = columnsRef.current[index];
      if (!column || column.status !== 'failed') return;
      if (savedVoteRef.current?.runId === runId) staleVoteRunRef.current = runId;

      const { id, model, modelLabel, provider, settings, sample, history } = column;
      columnsRef.current[index] = {
        id,
        model,
        modelLabel,
        provider,
        status: 'waiting',
        content: '',
        isThinking: false,
        startedAt: performance.now(),
        ...(settings ? { settings } : {}),
        ...(sample ? { sample } : {}),
        ...(history ? { history } : {}),
      };
      const controller = new AbortController();
      controllersRef.current[index] = controller;
      flush();
      void runColumn(runId, index, current.prompt, controller.signal, imagesRef.current);
    },
    [flush, runColumn]
  );

  /**
   * A column id identifies the winner when the same model runs in several columns. A finished
   * answer can win while other columns still stream; tie and none judge every answer, so they
   * wait for the whole run. A vote cast mid-run is saved again once the run settles.
   */
  const vote = useCallback(async (winner: CompareWinner, winnerColumnId?: string) => {
    const run = runRef.current;
    if (!run) return;
    const isRunSettled = run.columns.every(({ status }) => isSettledStatus(status));
    if (winner === 'tie' || winner === 'none') {
      if (!isRunSettled) return;
    } else {
      const column = run.columns.find(({ id }) => id === winnerColumnId);
      if (!column || !isSettledStatus(column.status) || !hasOutput(column)) return;
    }

    const record = toVoteRecord(run, winner, winnerColumnId);
    setRun((current) =>
      current?.id === run.id ? { ...current, winner, winnerColumnId } : current
    );
    try {
      const saved = await enqueuePersistence(() => saveCompareVote(record));
      if (!saved) throw new Error('No active workspace');
      savedVoteRef.current = { runId: run.id, winner, winnerColumnId };
      if (!isRunSettled) staleVoteRunRef.current = run.id;
      onVoteSavedRef.current?.();
    } catch (error) {
      console.error('Failed to save compare vote', error);
      toast.error('Could not save your vote locally.');
      if (mountedRef.current) {
        const saved = savedVoteRef.current?.runId === run.id ? savedVoteRef.current : null;
        setRun((current) =>
          current?.id === run.id &&
          current.winner === winner &&
          current.winnerColumnId === winnerColumnId
            ? {
                ...current,
                winner: saved?.winner ?? null,
                winnerColumnId: saved?.winnerColumnId,
              }
            : current
        );
      }
    }
  }, []);

  /**
   * Sets or clears (score undefined, or the same score again) one rubric score. A run that was
   * already voted on also updates its vote, so the leaderboard sees the new scores.
   */
  const rate = useCallback(
    (columnId: string, criterion: CompareRubricCriterion, score?: number) => {
      const run = runRef.current;
      const target = run?.columns.find(({ id }) => id === columnId);
      if (!run || !target || !isSettledStatus(target.status)) return;

      const columns = run.columns.map((column) => {
        if (column.id !== columnId) return column;
        const rubric: CompareRubric = { ...column.rubric };
        if (score === undefined || rubric[criterion] === score) delete rubric[criterion];
        else rubric[criterion] = score;
        return { ...column, rubric };
      });
      // Keep the ref current, so a second tap before the next render builds on this one.
      runRef.current = { ...run, columns };
      setRun((current) => (current?.id === run.id ? { ...current, columns } : current));

      const winner = run.winner;
      if (!winner || savedVoteRef.current?.runId !== run.id) return;
      if (!run.columns.every(({ status }) => isSettledStatus(status))) {
        // The settle-time vote refresh picks this score up with the final answers.
        staleVoteRunRef.current = run.id;
        return;
      }
      enqueuePersistence(() =>
        saveCompareVote(toVoteRecord({ ...run, columns }, winner, run.winnerColumnId))
      )
        .then((saved) => {
          if (saved) onVoteSavedRef.current?.();
        })
        .catch((error) => {
          console.error('Failed to save compare rubric', error);
          toast.error('Could not save your rating locally.');
        });
    },
    []
  );

  /**
   * Hides or reveals model names on the current run until it is voted on. Columns keep their
   * order; only a run started blind was shuffled. A vote records whether names were hidden.
   */
  const setBlind = useCallback((blind: boolean) => {
    setRun((current) =>
      current && !current.winner && Boolean(current.blind) !== blind
        ? { ...current, blind }
        : current
    );
  }, []);

  /** Shows a saved run read-only (votes can still change). Any live run is aborted first. */
  const open = useCallback(
    (stored: ICompareRun) => {
      detachRun();
      const run: CompareRunState = {
        ...stored,
        startedAt: 0,
        isFromHistory: true,
        columns: stored.columns.map((column) => ({ ...column, isThinking: false })),
      };
      persistedRunsRef.current.set(stored.id, getHistorySignature(run));
      savedVoteRef.current = stored.winner
        ? { runId: stored.id, winner: stored.winner, winnerColumnId: stored.winnerColumnId }
        : null;
      setRun(run);
    },
    [detachRun]
  );

  const close = useCallback(() => {
    detachRun();
    setRun(null);
  }, [detachRun]);

  /**
   * Applies a video card's own update (a resumed, expired or failed check) to a settled
   * column. The history effect then saves it like any other change to a settled run.
   */
  const updateColumnVideo = useCallback((columnId: string, video: IVideoMessage['video_url']) => {
    const patch = (column: CompareColumnState): CompareColumnState =>
      column.id === columnId
        ? {
            ...column,
            video,
            // A stopped or failed job that finished on a later check is now a real answer.
            ...(video.status === 'ready' ? { status: 'done', error: undefined } : {}),
            ...(typeof video.cost === 'number' ? { costUsd: video.cost } : {}),
          }
        : column;
    // The live run is also tracked in the ref, so a later stream flush keeps the change.
    if (runIdRef.current && runIdRef.current === runRef.current?.id) {
      columnsRef.current = columnsRef.current.map(patch);
    }
    setRun((current) => (current ? { ...current, columns: current.columns.map(patch) } : current));
  }, []);

  const isRunning = Boolean(run?.columns.some(({ status }) => !isSettledStatus(status)));
  /** True once any answer has finished; tie and none additionally wait for `isRunning`. */
  const canVote = Boolean(
    run?.columns.some((column) => isSettledStatus(column.status) && hasOutput(column))
  );

  const canFollowUp = Boolean(
    run && !isRunning && run.columns.filter(hasOutput).length >= MIN_COMPARE_MODELS
  );

  return {
    run,
    isRunning,
    canVote,
    canFollowUp,
    start,
    followUp,
    stop: abortAll,
    stopColumn,
    retryColumn,
    vote,
    rate,
    setBlind,
    updateColumnVideo,
    open,
    close,
  };
};

export default useCompareRun;

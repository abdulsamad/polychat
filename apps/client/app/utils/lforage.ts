import localforage from 'localforage';

import type {
  ChatResponseMetadata,
  enabledModelsType,
  modelProviderType,
  profilesType,
} from 'utils';
import { getDefaultModelConfig, profiles } from 'utils';
import type { IConfig, IMessage, IThreadSettings, IThreads } from '@/store';

export const settingsKey = 'config';
export const threadsKey = 'threads';
export const userSettingsKey = 'user-settings';

export const messagesKey = 'messages';
export const startedToastKey = 'has-seen-started-toast';
export const demoThreadsDismissedKey = 'demo-threads-dismissed';
export const compareVotesKey = 'compare-votes';
/** Only the newest compare votes are kept so the store stays small. */
export const MAX_COMPARE_VOTES = 500;
export const compareRunsKey = 'compare-runs';
/** Runs include full answers, so history keeps fewer records than votes. */
export const MAX_COMPARE_RUNS = 100;
/** Shared, account-independent cache of public model prices. */
export const modelPricingKey = 'openrouter-model-pricing';
export const compareSuitesKey = 'compare-suites';
export const MAX_COMPARE_SUITES = 50;
export const MAX_SUITE_PROMPTS = 20;
const anonymousWorkspaceKey = 'anonymous-workspace-account';

export const lforage = localforage.createInstance({
  name: 'polychat',
  description: 'A chat application',
  version: 1.0,
});

let activeWorkspaceAccount: string | null = null;

export const getAnonymousWorkspaceAccount = () => {
  if (typeof window === 'undefined') return 'anonymous-server';

  const stored = window.localStorage.getItem(anonymousWorkspaceKey);
  if (stored) return stored;

  const accountId = `anonymous-${crypto.randomUUID()}`;
  window.localStorage.setItem(anonymousWorkspaceKey, accountId);
  return accountId;
};

const scopedKey = (key: string) =>
  activeWorkspaceAccount ? `${key}:${activeWorkspaceAccount}` : null;

export const setActiveWorkspaceAccount = (accountId: string | null) => {
  activeWorkspaceAccount = accountId;
};

export const getActiveWorkspaceAccount = () => activeWorkspaceAccount;

export const getConfig = async (): Promise<IConfig | null> => {
  const key = scopedKey(settingsKey);
  return key ? ((await lforage.getItem(key)) as IConfig | null) : null;
};

export const setConfig = async (config: IConfig) => {
  const key = scopedKey(settingsKey);
  if (key) await lforage.setItem(key, config);
};

export const getThreads = async (): Promise<IThreads | null> => {
  const key = scopedKey(threadsKey);
  if (!key) return null;

  const stored = (await lforage.getItem(key)) as IThreads | null;
  if (!stored) return null;

  return stored.map((thread) => {
    return {
      ...thread,
        settings: {
          ...thread.settings,
          modelConfig: {
            ...getDefaultModelConfig(thread.settings.model),
            ...thread.settings.modelConfig,
          },
          profile: profiles.some(({ code }) => code === thread.settings.profile)
          ? thread.settings.profile
          : 'normal',
      },
    };
  });
};

export const setThreads = async (threads: IThreads) => {
  const key = scopedKey(threadsKey);
  if (key) await lforage.setItem(key, threads);
};

export const getUserSettings = async (): Promise<Partial<
  IThreadSettings<enabledModelsType>
> | null> => {
  const key = scopedKey(userSettingsKey);
  if (!key) return null;

  const settings = (await lforage.getItem(key)) as Partial<
    IThreadSettings<enabledModelsType>
  > | null;
  if (!settings) return null;
  return {
    ...settings,
    profile:
      settings.profile && profiles.some(({ code }) => code === settings.profile)
        ? settings.profile
        : 'normal',
  };
};

export const setUserSettings = async (settings: IThreadSettings<enabledModelsType>) => {
  const key = scopedKey(userSettingsKey);
  if (key) await lforage.setItem(key, settings);
};

export const getMessages = async (): Promise<Record<string, IMessage[]> | null> => {
  const key = scopedKey(messagesKey);
  if (!key) return null;

  const messages = (await lforage.getItem(key)) as Record<string, IMessage[]>;
  return messages;
};

export const setMessages = async (messages: Record<string, IMessage[]>) => {
  const key = scopedKey(messagesKey);
  if (key) await lforage.setItem(key, messages);
};

export const markStartedToastAsSeen = async () => {
  const key = scopedKey(startedToastKey);
  if (!key) return false;

  const hasSeen = await lforage.getItem<boolean>(key);
  if (hasSeen) return false;

  await lforage.setItem(key, true);
  return true;
};

export const hasSeenStartedToast = async () => {
  const key = scopedKey(startedToastKey);
  return key ? Boolean(await lforage.getItem<boolean>(key)) : false;
};

export const hasDismissedDemoThreads = async () => {
  const key = scopedKey(demoThreadsDismissedKey);
  return key ? Boolean(await lforage.getItem<boolean>(key)) : false;
};

export const removeDemoThreads = async () => {
  const [threads, messages] = await Promise.all([getThreads(), getMessages()]);
  const demoIds = new Set<string>(
    (threads || []).filter((thread) => thread.metadata.isDemo).map(({ id }) => id)
  );
  if (!demoIds.size) return false;

  await Promise.all([
    setThreads((threads || []).filter(({ id }) => !demoIds.has(id))),
    setMessages(
      Object.fromEntries(Object.entries(messages || {}).filter(([id]) => !demoIds.has(id)))
    ),
  ]);
  const dismissedKey = scopedKey(demoThreadsDismissedKey);
  if (dismissedKey) await lforage.setItem(dismissedKey, true);
  return true;
};

export const deleteAllChats = async () => {
  const threadsStorageKey = scopedKey(threadsKey);
  const messagesStorageKey = scopedKey(messagesKey);
  await Promise.all(
    [threadsStorageKey, messagesStorageKey]
      .filter((key): key is string => Boolean(key))
      .map((key) => lforage.removeItem(key))
  );
};

export type CompareWinner = enabledModelsType | 'tie' | 'none';

export interface ICompareVoteResult {
  model: enabledModelsType;
  provider: modelProviderType;
  ttftMs: number | null;
  totalMs: number | null;
  usage?: ChatResponseMetadata['usage'];
  /** Exact provider-reported cost. Estimates are derived at read time from current prices. */
  costUsd?: number;
  finishReason?: string;
  rubric?: CompareRubric;
  failed: boolean;
}

export const compareRubricCriteria = ['correctness', 'clarity', 'conciseness'] as const;
export type CompareRubricCriterion = (typeof compareRubricCriteria)[number];
/** Optional 1-5 scores per criterion for one answer. */
export type CompareRubric = Partial<Record<CompareRubricCriterion, number>>;

/** A settled compare column as stored in run history. */
export interface ICompareRunColumn {
  id: string;
  model: enabledModelsType;
  modelLabel: string;
  provider: modelProviderType;
  status: 'done' | 'failed' | 'stopped';
  content: string;
  error?: string;
  /** Milliseconds from request start; reasoning start is set only when reasoning was streamed. */
  ttftMs?: number;
  totalMs?: number;
  reasoningStartMs?: number;
  usage?: ChatResponseMetadata['usage'];
  finishReason?: string;
  /** The model that actually served the request, when the provider reports a different id. */
  servedModelId?: string;
  costUsd?: number;
  rubric?: CompareRubric;
  /** Per-slot overrides of the model's default settings. */
  settings?: CompareSlotSettings;
  /** 1-based sample number when a slot ran the same configuration more than once. */
  sample?: number;
  /** Earlier turns of this column's conversation, oldest first (follow-up runs only). */
  history?: CompareTurn[];
}

/** Overrides a compare slot can apply on top of the model's default config. */
export interface CompareSlotSettings {
  temperature?: number;
  maxTokens?: number;
  profile?: profilesType;
}

export interface CompareTurn {
  prompt: string;
  answer: string;
}

/** Saved prompt list run in sequence against the same models. */
export interface ICompareSuite {
  id: string;
  name: string;
  prompts: string[];
  createdAt: number;
}

/** Ties a run to one execution of a suite. */
export interface CompareSuiteTag {
  suiteId: string;
  suiteName: string;
  /** One id per suite execution, shared by all of its runs. */
  suiteRunId: string;
  /** 0-based position of this prompt within the suite. */
  index: number;
  total: number;
}

export interface ICompareRun {
  id: string;
  timestamp: number;
  prompt: string;
  columns: ICompareRunColumn[];
  winner: CompareWinner | null;
  /** The voted column, which disambiguates runs with the same model in several columns. */
  winnerColumnId?: string;
  /** Columns were shuffled and model names hidden until the vote. */
  blind?: boolean;
  /** The run this one followed up on. */
  parentRunId?: string;
  /** Names and types of attached images; the image data is not kept in history. */
  attachments?: Array<{ name: string; mediaType: string; size: number }>;
  suite?: CompareSuiteTag;
}

export interface ICompareVote {
  /** The compare run id, so changing a vote replaces the earlier record. */
  id: string;
  timestamp: number;
  prompt: string;
  results: ICompareVoteResult[];
  winner: CompareWinner;
  winnerColumnId?: string;
  blind?: boolean;
}

export const getCompareVotes = async (): Promise<ICompareVote[]> => {
  const key = scopedKey(compareVotesKey);
  if (!key) return [];

  const votes = await lforage.getItem<ICompareVote[]>(key);
  return Array.isArray(votes) ? votes : [];
};

/** Insert or replace a vote by run id, keeping the newest MAX_COMPARE_VOTES records. */
export const saveCompareVote = async (vote: ICompareVote) => {
  const key = scopedKey(compareVotesKey);
  if (!key) return false;

  const votes = await getCompareVotes();
  const nextVotes = [vote, ...votes.filter(({ id }) => id !== vote.id)]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_COMPARE_VOTES);
  await lforage.setItem(key, nextVotes);
  return true;
};

export const clearCompareVotes = async () => {
  const key = scopedKey(compareVotesKey);
  if (key) await lforage.removeItem(key);
};

export const getCompareRuns = async (): Promise<ICompareRun[]> => {
  const key = scopedKey(compareRunsKey);
  if (!key) return [];

  const runs = await lforage.getItem<ICompareRun[]>(key);
  return Array.isArray(runs) ? runs : [];
};

/** Insert or replace a run by id, keeping the newest MAX_COMPARE_RUNS records. */
export const saveCompareRun = async (run: ICompareRun) => {
  const key = scopedKey(compareRunsKey);
  if (!key) return false;

  const runs = await getCompareRuns();
  const nextRuns = [run, ...runs.filter(({ id }) => id !== run.id)]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_COMPARE_RUNS);
  await lforage.setItem(key, nextRuns);
  return true;
};

export const deleteCompareRun = async (runId: string) => {
  const key = scopedKey(compareRunsKey);
  if (!key) return;

  const runs = await getCompareRuns();
  await lforage.setItem(key, runs.filter(({ id }) => id !== runId));
};

export const getCompareSuites = async (): Promise<ICompareSuite[]> => {
  const key = scopedKey(compareSuitesKey);
  if (!key) return [];

  const suites = await lforage.getItem<ICompareSuite[]>(key);
  return Array.isArray(suites) ? suites : [];
};

/** Insert or replace a suite by id, newest first. */
export const saveCompareSuite = async (suite: ICompareSuite) => {
  const key = scopedKey(compareSuitesKey);
  if (!key) return false;

  const suites = await getCompareSuites();
  const nextSuites = [suite, ...suites.filter(({ id }) => id !== suite.id)]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_COMPARE_SUITES);
  await lforage.setItem(key, nextSuites);
  return true;
};

export const deleteCompareSuite = async (suiteId: string) => {
  const key = scopedKey(compareSuitesKey);
  if (!key) return;

  const suites = await getCompareSuites();
  await lforage.setItem(key, suites.filter(({ id }) => id !== suiteId));
};

export const clearCompareRuns = async () => {
  const key = scopedKey(compareRunsKey);
  if (key) await lforage.removeItem(key);
};

export const clearLocalData = async () => {
  const keys = [
    settingsKey,
    threadsKey,
    userSettingsKey,
    messagesKey,
    startedToastKey,
    demoThreadsDismissedKey,
    compareVotesKey,
    compareRunsKey,
    compareSuitesKey,
  ]
    .map(scopedKey)
    .filter((key): key is string => Boolean(key));
  await Promise.all(keys.map((key) => lforage.removeItem(key)));
};

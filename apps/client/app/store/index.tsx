import { atom } from 'jotai';
import { atomEffect } from 'jotai-effect';
import { getTime, format } from 'date-fns';

import type { profilesType, supportedLanguagesType, enabledModelsType, ImageSizeType } from 'utils';

import { defaultModel } from 'utils';

import { getThreads, getMessages, setConfig, setMessages, setThreads } from '@/utils/lforage';

// Editor

export const editorAtom = atom('');

// Chats

export const speechPlaybackAtom = atom(false);
export const userSettingsOpenAtom = atom(false);
export const threadSettingsOpenAtom = atom(false);
export type UserSettingsScrollTarget = 'custom-instructions' | 'byok';
export const userSettingsScrollTargetAtom = atom<UserSettingsScrollTarget | null>(null);
export const workspaceReadyAtom = atom(false);

export interface IMessageCommons {
  id: ReturnType<typeof crypto.randomUUID>;
  role: 'assistant' | 'user';
  content: string; // URL or Text
  metadata: {
    profile: null | profilesType; // null is for self
    timestamp: number;
    model: enabledModelsType;
    usage?: IMessageUsage;
    finishReason?: string;
    cancelled?: boolean;
    responseId?: string;
    responseModelId?: string;
    responseTimestamp?: string;
    requestId?: string;
    requestState?: 'queued' | 'streaming' | 'failed' | 'interrupted';
  };
}

export interface IMessageUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
}

export interface ITextMessage {
  type: 'text';
}

export interface IImageMessage {
  type: 'image_url';
  image_url: { url: string; alt: string; size: string };
}

export type IMessage = IMessageCommons & (ITextMessage | IImageMessage);

export type ThreadId = string;

/** All loaded thread messages. Streams always update this map by thread id. */
export const threadMessagesAtom = atom<Record<ThreadId, IMessage[]>>({});

/** The selected thread's message view, retained for existing consumers. */
export const messagesAtom = atom((get) => {
  const thread = get(threadAtom);
  return thread ? get(threadMessagesAtom)[thread.id] || [] : [];
});

/** Replace messages when the active route/thread changes. */
export const replaceMessagesAtom = atom(null, (get, set, messages: IMessage[]) => {
  const thread = get(threadAtom);
  if (!thread) return;
  set(threadMessagesAtom, { ...get(threadMessagesAtom), [thread.id]: messages });
});

/** Hydrate storage without replacing newer in-memory stream updates. */
export const hydrateThreadMessagesAtom = atom(
  null,
  (get, set, storedMessages: Record<ThreadId, IMessage[]>) => {
    const current = get(threadMessagesAtom);
    const next = { ...storedMessages, ...current };
    set(threadMessagesAtom, next);
  }
);

export const clearThreadMessagesAtom = atom(null, (_get, set) => {
  set(threadMessagesAtom, {});
});

export const removeThreadMessagesAtom = atom(null, (get, set, threadId: ThreadId) => {
  const current = get(threadMessagesAtom);
  if (!(threadId in current)) return;

  const { [threadId]: _removed, ...remaining } = current;
  set(threadMessagesAtom, remaining);
});

/** Append a new message, or replace an existing message while it streams. */
export const upsertMessageAtom = atom(null, (get, set, message: IMessage) => {
  const thread = get(threadAtom);
  if (!thread) return;
  set(upsertThreadMessageAtom, { threadId: thread.id, message });
});

export const upsertThreadMessageAtom = atom(
  null,
  (get, set, update: { threadId: ThreadId; message: IMessage }) => {
    const messages = get(threadMessagesAtom)[update.threadId] || [];
    const index = messages.findIndex(({ id }) => id === update.message.id);

    if (index === -1) {
      const requestId = update.message.metadata.requestId;
      const pairedMessageIndex = requestId
        ? messages.findIndex(
            (message) =>
              message.metadata.requestId === requestId && message.role !== update.message.role
          )
        : -1;
      const insertionIndex =
        pairedMessageIndex === -1
          ? messages.length
          : update.message.role === 'user'
            ? pairedMessageIndex
            : pairedMessageIndex + 1;
      const nextMessages = messages.slice();
      nextMessages.splice(insertionIndex, 0, update.message);

      set(threadMessagesAtom, {
        ...get(threadMessagesAtom),
        [update.threadId]: nextMessages,
      });
      return;
    }

    const nextMessages = messages.slice();
    nextMessages[index] = update.message;
    set(threadMessagesAtom, { ...get(threadMessagesAtom), [update.threadId]: nextMessages });
  }
);

export const removeThreadMessageAtom = atom(
  null,
  (get, set, update: { threadId: ThreadId; id: string }) => {
    const messages = get(threadMessagesAtom)[update.threadId] || [];
    set(threadMessagesAtom, {
      ...get(threadMessagesAtom),
      [update.threadId]: messages.filter((message) => message.id !== update.id),
    });
  }
);

// Base Configuration for all models
export interface IBaseModelConfig {
  maxTokens?: number;
}

// Base types for different model categories
interface IBaseImageModelConfig extends IBaseModelConfig {
  size: ImageSizeType;
}

// Model-specific configurations
interface IDallE3Config extends IBaseImageModelConfig {
  quality: 'standard' | 'hd';
  style: 'vivid' | 'natural';
}

interface IStableDiffusionConfig extends IBaseImageModelConfig {
  samplingMethod: 'DDIM' | 'PLMS' | 'K_EULER';
  guidanceScale: number;
}

export type ModelConfigMap = {
  [K in enabledModelsType]: K extends 'dall-e-3'
    ? IDallE3Config
    : K extends 'stable-diffusion'
      ? IStableDiffusionConfig
      : IBaseModelConfig;
};

export type ModelConfig<T extends enabledModelsType> = ModelConfigMap[T];

export type ConversationContextMode = 'single-turn' | 'multi-turn';

// Thread Settings interface
export interface IThreadSettings<T extends enabledModelsType> {
  model: T;
  profile: profilesType;
  conversationContextMode: ConversationContextMode;
  isTextToSpeechEnabled: boolean;
  showDetailedUsage: boolean;
  modelConfig: ModelConfig<T>;
}

export interface IThread<T extends enabledModelsType> {
  id: ReturnType<typeof crypto.randomUUID>;
  settings: IThreadSettings<T>;
  metadata: {
    name: string;
    nameSource: 'default' | 'custom';
    timestamp: number;
    status: 'idle' | 'streaming' | 'saving';
    version: number;
  };
  queue?: {
    pending: IMessage[];
    failed: Array<{ message: IMessage; error: string }>;
  };
}

export const getDefaultThreadName = (date = new Date()) =>
  `New chat - ${format(date, "MMM d, yyyy 'at' h:mm a")}`;

export const getDefaultThread = (
  settings: Partial<IThreadSettings<enabledModelsType>> = {}
): IThread<enabledModelsType> => {
  const defaultSettings: IThreadSettings<enabledModelsType> = {
    model: defaultModel,
    profile: 'normal',
    conversationContextMode: 'single-turn',
    isTextToSpeechEnabled: false,
    showDetailedUsage: false,
    modelConfig: {
      maxTokens: 3000,
    },
  };

  return {
    id: crypto.randomUUID(),
    settings: {
      ...defaultSettings,
      ...settings,
      modelConfig: { ...defaultSettings.modelConfig, ...settings.modelConfig },
    } as IThreadSettings<enabledModelsType>,
    metadata: {
      name: getDefaultThreadName(),
      nameSource: 'default',
      timestamp: getTime(new Date()),
      status: 'idle',
      version: 2,
    },
    queue: {
      pending: [],
      failed: [],
    },
  };
};

export const threadAtom = atom<IThread<enabledModelsType> | null>(null);

export interface ChatJob {
  id: IMessage['id'];
  accountId: string;
  threadId: ThreadId;
  prompt: string;
  userMessageId: IMessage['id'];
  assistantMessageId: IMessage['id'];
  thread: IThread<enabledModelsType>;
  messages: IMessage[];
  config: IConfig;
  createdAt: number;
}

export const activeChatJobAtom = atom<ChatJob | null>(null);
export const queuedChatJobsAtom = atom<ChatJob[]>([]);
export const threadChatErrorsAtom = atom<Record<ThreadId, string>>({});

export const enqueueChatJobAtom = atom(null, (get, set, job: ChatJob) => {
  const activeJob = get(activeChatJobAtom);
  const queuedJobs = get(queuedChatJobsAtom);

  if (
    activeJob?.threadId === job.threadId ||
    queuedJobs.some((queuedJob) => queuedJob.threadId === job.threadId)
  ) {
    return false;
  }

  set(upsertThreadMessageAtom, {
    threadId: job.threadId,
    message: {
      id: job.userMessageId,
      role: 'user',
      content: job.prompt,
      metadata: {
        model: job.thread.settings.model,
        profile: null,
        timestamp: job.createdAt,
        requestId: job.id,
        requestState: activeJob || queuedJobs.length ? 'queued' : 'streaming',
      },
      type: 'text',
    },
  });
  set(queuedChatJobsAtom, [...queuedJobs, job]);
  return true;
});

export const cancelQueuedChatJobAtom = atom(null, (get, set, threadId: ThreadId) => {
  const queuedJobs = get(queuedChatJobsAtom);
  const job = queuedJobs.find((queuedJob) => queuedJob.threadId === threadId);
  if (!job) return null;

  set(
    queuedChatJobsAtom,
    queuedJobs.filter((queuedJob) => queuedJob.id !== job.id)
  );
  set(removeThreadMessageAtom, { threadId, id: job.userMessageId });
  return job.prompt;
});

export const dequeueNextChatJobAtom = atom(null, (get, set) => {
  if (get(activeChatJobAtom)) return;

  const [nextJob, ...remainingJobs] = get(queuedChatJobsAtom);
  if (!nextJob) return;

  set(queuedChatJobsAtom, remainingJobs);
  set(activeChatJobAtom, nextJob);
});

export const resetChatQueueAtom = atom(null, (get, set) => {
  const currentMessages = get(threadMessagesAtom);
  let didInterruptMessage = false;
  const interruptedMessages = Object.fromEntries(
    Object.entries(currentMessages).map(([threadId, messages]) => [
      threadId,
      messages.map((message) => {
        if (
          message.metadata.requestState !== 'queued' &&
          message.metadata.requestState !== 'streaming'
        ) {
          return message;
        }

        didInterruptMessage = true;
        return {
          ...message,
          metadata: { ...message.metadata, requestState: 'interrupted' as const },
        };
      }),
    ])
  );

  if (didInterruptMessage) set(threadMessagesAtom, interruptedMessages);
  set(activeChatJobAtom, null);
  set(queuedChatJobsAtom, []);
  set(threadChatErrorsAtom, {});
});

export const threadChatStateAtom = atom((get) => {
  const active = get(activeChatJobAtom);
  const queued = get(queuedChatJobsAtom);
  const result: Record<ThreadId, { state: 'streaming' | 'queued'; position?: number }> = {};

  if (active) result[active.threadId] = { state: 'streaming' };
  queued.forEach((job, index) => {
    if (!result[job.threadId]) {
      result[job.threadId] = { state: 'queued', position: index + 1 };
    }
  });

  return result;
});

export const threadLoadingAtom = atom((get) => {
  const thread = get(threadAtom);
  return Boolean(thread && get(activeChatJobAtom)?.threadId === thread.id);
});

export const threadQueuedJobAtom = atom((get) => {
  const thread = get(threadAtom);
  return thread ? get(queuedChatJobsAtom).find((job) => job.threadId === thread.id) || null : null;
});

export const clearThreadChatErrorAtom = atom(null, (get, set, threadId: ThreadId) => {
  const { [threadId]: _cleared, ...remaining } = get(threadChatErrorsAtom);
  set(threadChatErrorsAtom, remaining);
});

export const threadsRefreshAtom = atom(0);
export const refreshThreadsAtom = atom(null, (_get, set) => {
  set(threadsRefreshAtom, (value) => value + 1);
});

export const updateThreadSettingsAtom = atom(
  null,
  (get, set, update: Partial<IThreadSettings<enabledModelsType>>) => {
    const thread = get(threadAtom);
    if (!thread) return;

    set(threadAtom, {
      ...thread,
      settings: { ...thread.settings, ...update },
    });
  }
);

export type IThreads = IThread<enabledModelsType>[];

// Offline storage (Threads & Messages)

// Serialize writes so a fast stream update cannot overwrite a newer snapshot
// with the result of an older async read.
let persistenceQueue: Promise<void> = Promise.resolve();

export const enqueuePersistence = <T,>(write: () => Promise<T>) => {
  let result!: T;
  const run = async () => {
    result = await write();
  };

  persistenceQueue = persistenceQueue.then(run, run);
  return persistenceQueue.then(() => result);
};

export const waitForPersistence = () => persistenceQueue;

export const threadSaveEffect = atomEffect((get, set) => {
  const thread = get(threadAtom);
  const workspaceReady = get(workspaceReadyAtom);
  if (!thread || !workspaceReady) return;

  void enqueuePersistence(async () => {
    const threads = (await getThreads()) || [];
    const existingThreadIndex = threads.findIndex(({ id }) => id === thread.id);

    if (existingThreadIndex >= 0) {
      threads[existingThreadIndex] = thread;
    } else {
      threads.unshift(thread);
    }

    await setThreads(threads);
  }).catch((err) => console.error('Failed to save thread', err));
});

export const messageSaveEffect = atomEffect((get, set) => {
  const messagesByThread = get(threadMessagesAtom);
  const workspaceReady = get(workspaceReadyAtom);
  if (!workspaceReady) return;

  void enqueuePersistence(async () => {
    await setMessages(messagesByThread);
  }).catch((err) => console.error('Failed to save messages', err));
});

// Flags

// export const configCatClientAtom = atom(
//   configcat.getClient(import.meta.env.NEXT_PUBLIC_CONFIGCAT_API_KEY)
// );

// export const identifierAtom = atom('');

// export const flagsAtom = atom(async (get) => {
//   const identifier = get(identifierAtom);

//   if (identifier) {
//     const userObject = new configcat.User(identifier);
//     const client = get(configCatClientAtom);

//     const gpt4Enabled = await client.getValueAsync('enable-GPT-4', false, userObject);

//     const dallE3Enabled = await client.getValueAsync('enable-DALL-E-3', false, userObject);

//     return {
//       gpt4Enabled,
//       dallE3Enabled,
//     };
//   }

//   return null;
// });

// Config

export interface IConfig {
  language: supportedLanguagesType;
  imageSize: ImageSizeType;
  quality: 'standard' | 'hd';
  style: 'vivid' | 'natural';
  customInstructions: string;
}

export const defaultConfig: IConfig = {
  language: 'en-IN',
  imageSize: '1024x1024',
  quality: 'standard',
  style: 'vivid',
  customInstructions: '',
};

export const configAtom = atom<IConfig>(defaultConfig);

export const configSaveEffect = atomEffect((get) => {
  const config = get(configAtom);
  const workspaceReady = get(workspaceReadyAtom);
  if (!workspaceReady) return;

  void enqueuePersistence(() => setConfig(config)).catch((err) =>
    console.error('Failed to save config', err)
  );
});

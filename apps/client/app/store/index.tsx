import { atom } from 'jotai';
import { atomEffect } from 'jotai-effect';
import { getTime, format } from 'date-fns';

import type { profilesType, supportedLanguagesType, enabledModelsType, ImageSizeType } from 'utils';

import { defaultModel } from 'utils';

import {
  threadsKey,
  lforage,
  getThreads,
  messagesKey,
  getMessages,
  setConfig,
} from '@/utils/lforage';

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

export interface ThreadActivity {
  status: 'streaming';
  startedAt: number;
}

export const threadMessagesAtom = atom<Record<ThreadId, IMessage[]>>({});

/** Messages for the selected thread. Background streams update threadMessagesAtom directly. */
export const messagesAtom = atom(
  (get) => {
    const thread = get(threadAtom);
    return thread ? get(threadMessagesAtom)[thread.id] || [] : [];
  },
  (get, set, messages: IMessage[] | ((current: IMessage[]) => IMessage[])) => {
    const thread = get(threadAtom);
    if (!thread) return;

    const current = get(threadMessagesAtom)[thread.id] || [];
    const nextMessages = typeof messages === 'function' ? messages(current) : messages;
    set(threadMessagesAtom, { ...get(threadMessagesAtom), [thread.id]: nextMessages });
  }
);

export const threadActivityAtom = atom<Record<ThreadId, ThreadActivity>>({});

export const threadLoadingAtom = atom((get) => {
  const thread = get(threadAtom);
  return Boolean(thread && get(threadActivityAtom)[thread.id]);
});

export const anyThreadLoadingAtom = atom((get) => Object.keys(get(threadActivityAtom)).length > 0);

export const setThreadMessagesAtom = atom(
  null,
  (get, set, update: { threadId: ThreadId; messages: IMessage[] }) => {
    const messagesByThread = get(threadMessagesAtom);
    set(threadMessagesAtom, { ...messagesByThread, [update.threadId]: update.messages });
  }
);

export const hydrateThreadMessagesAtom = atom(
  null,
  (get, set, storedMessages: Record<ThreadId, IMessage[]>) => {
    const currentMessages = get(threadMessagesAtom);
    const nextMessages = { ...currentMessages };

    for (const [threadId, messages] of Object.entries(storedMessages)) {
      const current = nextMessages[threadId];
      if (!current || messages.length > current.length) nextMessages[threadId] = messages;
    }

    set(threadMessagesAtom, nextMessages);
  }
);

export const clearThreadMessagesAtom = atom(null, (_get, set) => {
  set(threadMessagesAtom, {});
});

/** Replace messages when the active route/thread changes. */
export const replaceMessagesAtom = atom(null, (_get, set, messages: IMessage[]) => {
  set(messagesAtom, messages);
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
      set(threadMessagesAtom, {
        ...get(threadMessagesAtom),
        [update.threadId]: [...messages, update.message],
      });
      return;
    }

    const nextMessages = messages.slice();
    nextMessages[index] = update.message;
    set(threadMessagesAtom, { ...get(threadMessagesAtom), [update.threadId]: nextMessages });
  }
);

export const startThreadActivityAtom = atom(null, (get, set, threadId: ThreadId) => {
  set(threadActivityAtom, {
    ...get(threadActivityAtom),
    [threadId]: { status: 'streaming', startedAt: Date.now() },
  });
});

export const finishThreadActivityAtom = atom(null, (get, set, threadId: ThreadId) => {
  const { [threadId]: _finished, ...remaining } = get(threadActivityAtom);
  set(threadActivityAtom, remaining);
});

export const clearThreadActivityAtom = atom(null, (_get, set) => {
  set(threadActivityAtom, {});
});

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
let persistenceQueue = Promise.resolve();

const enqueuePersistence = (write: () => Promise<void>) => {
  persistenceQueue = persistenceQueue.then(write, write);
  return persistenceQueue;
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

    await lforage.setItem(threadsKey, threads);
  }).catch((err) => console.error('Failed to save thread', err));
});

export const messageSaveEffect = atomEffect((get, set) => {
  const messagesByThread = get(threadMessagesAtom);
  const workspaceReady = get(workspaceReadyAtom);
  if (!workspaceReady) return;

  void enqueuePersistence(async () => {
    const allMessages = (await getMessages()) || {};
    await lforage.setItem(messagesKey, { ...allMessages, ...messagesByThread });
  }).catch((err) => console.error('Failed to save messages', err));
});

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

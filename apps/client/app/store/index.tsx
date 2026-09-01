import { atom } from 'jotai';
import { atomEffect } from 'jotai-effect';
import { atomWithStorage } from 'jotai/utils';
import { getTime, format } from 'date-fns';

import type {
  variationsType,
  supportedLanguagesType,
  enabledModelsType,
  ImageSizeType,
} from 'utils';

import { defaultModel } from 'utils';

import {
  settingsKey,
  threadsKey,
  lforage,
  getThreads,
  messagesKey,
  getMessages,
} from '@/utils/lforage';

// Editor

export const editorAtom = atom('');

// Chats

export const threadLoadingAtom = atom(false);
export const speechPlaybackAtom = atom(false);
export const userSettingsOpenAtom = atom(false);

export interface IMessageCommons {
  id: ReturnType<typeof crypto.randomUUID>;
  role: 'assistant' | 'user';
  content: string; // URL or Text
  metadata: {
    variation: null | variationsType; // null is for self
    timestamp: number;
    model: enabledModelsType;
    usage?: IMessageUsage;
    finishReason?: string;
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

/** The active thread's messages. Mutations go through the action atoms below. */
export const messagesAtom = atom<IMessage[]>([]);

/** Replace messages when the active route/thread changes. */
export const replaceMessagesAtom = atom(null, (_get, set, messages: IMessage[]) => {
  set(messagesAtom, messages);
});

/** Append a new message, or replace an existing message while it streams. */
export const upsertMessageAtom = atom(null, (get, set, message: IMessage) => {
  const messages = get(messagesAtom);
  const index = messages.findIndex(({ id }) => id === message.id);

  if (index === -1) {
    set(messagesAtom, [...messages, message]);
    return;
  }

  const nextMessages = messages.slice();
  nextMessages[index] = message;
  set(messagesAtom, nextMessages);
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
  variation: variationsType;
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
    variation: 'normal',
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
  if (!thread) return;

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
  const thread = get(threadAtom);
  const messages = get(messagesAtom);
  if (!thread) return;

  void enqueuePersistence(async () => {
    const allMessages = (await getMessages()) || {};
    await lforage.setItem(messagesKey, { ...allMessages, [thread.id]: messages });
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

export const configAtom = atomWithStorage<IConfig>(settingsKey, defaultConfig);

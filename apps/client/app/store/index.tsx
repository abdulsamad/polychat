import { atom, type WritableAtom, type SetStateAction } from 'jotai';
import { atomEffect } from 'jotai-effect';
import { atomWithStorage } from 'jotai/utils';
import { getTime, format } from 'date-fns';

import type {
  variationsType,
  supportedLanguagesType,
  enabledModelsType,
  ImageSizeType,
} from 'utils';

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

export interface IMessageCommons {
  id: ReturnType<typeof crypto.randomUUID>;
  role: 'assistant' | 'user';
  content: string; // URL or Text
  metadata: {
    variation: null | variationsType; // null is for self
    timestamp: number;
    model: enabledModelsType;
  };
}

export interface ITextMessage {
  type: 'text';
}

export interface IImageMessage {
  type: 'image_url';
  image_url: { url: string; alt: string; size: string };
}

export type IMessage = IMessageCommons & (ITextMessage | IImageMessage);

export const messagesAtom: WritableAtom<IMessage[], IMessage[], void> = atom(
  [],
  (get, set, update, reset) => {
    // Reset current chat
    if (reset) {
      set(messagesAtom, update);
      return;
    }

    // Add chat normally
    const state = get(messagesAtom);
    const threadIndex = state.findIndex((chat) => chat.id === update.id);

    if (threadIndex !== -1) {
      // Create a new array to trigger re-render
      const newState = [...state];
      newState[threadIndex] = {
        ...update, // Use the entire update object instead of just concatenating messages
      };
      set(messagesAtom, newState as unknown as IMessage);
    } else {
      set(messagesAtom, [...state, update] as unknown as IMessage);
    }
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

// Thread Settings interface
export interface IThreadSettings<T extends enabledModelsType> {
  model: T;
  variation: variationsType;
  isContextAware: boolean;
  isTextToSpeechEnabled: boolean;
  modelConfig: ModelConfig<T>;
}

export interface IThread<T extends enabledModelsType> {
  id: ReturnType<typeof crypto.randomUUID>;
  settings: IThreadSettings<T>;
  metadata: {
    name: string;
    timestamp: number;
    status: 'idle' | 'streaming' | 'saving';
    version: number;
  };
  queue?: {
    pending: IMessage[];
    failed: Array<{ message: IMessage; error: string }>;
  };
}

export const getDefaultThread = (): IThread<enabledModelsType> => ({
  id: crypto.randomUUID(),
  settings: {
    model: 'gemini-2.0-flash',
    variation: 'normal',
    isContextAware: false,
    isTextToSpeechEnabled: false,
    modelConfig: {
      maxTokens: 3000,
    },
  },
  metadata: {
    name: `Chat (${format(new Date(), 'hh:mm - dd/MM/yy')})`,
    timestamp: getTime(new Date()),
    status: 'idle',
    version: 1,
  },
  queue: {
    pending: [],
    failed: [],
  },
});

export const threadAtom: WritableAtom<
  IThread<enabledModelsType> | null,
  [SetStateAction<IThread<enabledModelsType> | null>],
  void
> = atom<IThread<enabledModelsType> | null>(null);

export type IThreads = IThread<enabledModelsType>[];

// Offline storage (Threads & Messages)

export const threadSaveEffect = atomEffect((get, set) => {
  (async () => {
    try {
      const thread = get(threadAtom);

      if (!thread) return null;

      const threads = await getThreads();

      if (!threads?.length) {
        await lforage.setItem(threadsKey, [thread]);
      } else {
        const existingThreadIndex = threads.findIndex((t) => t.id === thread.id);

        if (existingThreadIndex >= 0) {
          threads[existingThreadIndex] = thread;
          await lforage.setItem(threadsKey, threads);
        } else {
          await lforage.setItem(threadsKey, [thread, ...threads]);
        }
      }

      return () => {
        // cleanup
      };
    } catch (err) {
      console.error(err);
    }
  })();
});

export const messageSaveEffect = atomEffect((get, set) => {
  (async () => {
    try {
      const thread = get(threadAtom);
      const messages = get(messagesAtom);

      if (!thread || !messages?.length) return null;

      const allMessages = await getMessages();

      await lforage.setItem(messagesKey, {
        ...allMessages,
        [thread.id]: get(messagesAtom),
      });

      return () => {
        // cleanup
      };
    } catch (err) {
      console.error(err);
    }
  })();
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
}

export const configAtom = atomWithStorage<IConfig>(settingsKey, {
  language: 'en-IN',
  imageSize: '1024x1024',
  quality: 'standard',
  style: 'vivid',
});

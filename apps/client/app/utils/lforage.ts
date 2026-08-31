import localforage from 'localforage';

import type { IMessage, IThreads } from '@/store';

export const settingsKey = 'config';

export const getConfig = (setting: string) => {
  if (typeof window === 'undefined') return null;

  if (setting) {
    const settings = localStorage.getItem(settingsKey);
    const config = settings ? JSON.parse(settings)[setting] : null;
    return config;
  }

  const settings = localStorage.getItem(settingsKey);
  const config = settings ? JSON.parse(settings) : null;
  return config;
};

export const threadsKey = 'threads';

export const messagesKey = 'messages';
export const startedToastKey = 'has-seen-started-toast';

export const lforage = localforage.createInstance({
  name: 'polychat',
  description: 'A chat application',
  version: 1.0,
});

export const getThreads = async (): Promise<IThreads | null> => {
  return (await lforage.getItem(threadsKey)) as IThreads | null;
};

export const getMessages = async (): Promise<Record<string, IMessage[]> | null> => {
  const messages = (await lforage.getItem(messagesKey)) as Record<string, IMessage[]>;
  return messages;
};

export const markStartedToastAsSeen = async () => {
  const hasSeen = await lforage.getItem<boolean>(startedToastKey);
  if (hasSeen) return false;

  await lforage.setItem(startedToastKey, true);
  return true;
};

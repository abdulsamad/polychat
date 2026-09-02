import localforage from 'localforage';

import type { enabledModelsType } from 'utils';
import { profiles } from 'utils';
import type { IConfig, IMessage, IThreadSettings, IThreads } from '@/store';

export const settingsKey = 'config';
export const threadsKey = 'threads';
export const userSettingsKey = 'user-settings';

export const messagesKey = 'messages';
export const startedToastKey = 'has-seen-started-toast';

export const lforage = localforage.createInstance({
  name: 'polychat',
  description: 'A chat application',
  version: 1.0,
});

let activeWorkspaceAccount: string | null = null;

const scopedKey = (key: string) =>
  activeWorkspaceAccount ? `${key}:${activeWorkspaceAccount}` : null;

export const setActiveWorkspaceAccount = (accountId: string | null) => {
  activeWorkspaceAccount = accountId;
};

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

export const markStartedToastAsSeen = async () => {
  const key = scopedKey(startedToastKey);
  if (!key) return false;

  const hasSeen = await lforage.getItem<boolean>(key);
  if (hasSeen) return false;

  await lforage.setItem(key, true);
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

export const clearLocalData = async () => {
  const keys = [settingsKey, threadsKey, userSettingsKey, messagesKey, startedToastKey]
    .map(scopedKey)
    .filter((key): key is string => Boolean(key));
  await Promise.all(keys.map((key) => lforage.removeItem(key)));
};

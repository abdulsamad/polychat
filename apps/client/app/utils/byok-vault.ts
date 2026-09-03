import localforage from 'localforage';

import type { modelProviderType } from 'utils';

export type ByokProvider = modelProviderType;

export type ProviderKeys = Partial<Record<ByokProvider, string>>;

interface VaultEnvelope {
  version: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: { name: 'AES-GCM'; iv: string; ciphertext: string };
}

const ITERATIONS = 600_000;
const vaultStore = localforage.createInstance({
  name: 'polychat-secrets',
  storeName: 'byok_vault',
  description: 'Encrypted PolyChat provider credentials',
});
const metadataKey = (accountId: string) => `byok-meta:${accountId}`;

let activeAccount: string | null = null;
let activeKey: CryptoKey | null = null;
let activeKeys: ProviderKeys = {};
let sessionKeys: ProviderKeys = {};
const configuredProviders = new Map<string, Set<ByokProvider>>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());
const storageKey = (accountId: string) => `byok-vault:${accountId}`;

const encode = (value: Uint8Array) => btoa(String.fromCharCode(...value));
const decode = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const deriveKey = async (passphrase: string, salt: Uint8Array) => {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

const encrypt = async (key: CryptoKey, keys: ProviderKeys, salt: Uint8Array) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(keys));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  return {
    version: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: encode(salt) },
    cipher: { name: 'AES-GCM', iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) },
  } satisfies VaultEnvelope;
};

const decrypt = async (key: CryptoKey, envelope: VaultEnvelope) => {
  if (
    envelope.version !== 1 ||
    envelope.kdf.name !== 'PBKDF2' ||
    envelope.cipher.name !== 'AES-GCM'
  ) {
    throw new Error('Unsupported BYOK vault version');
  }

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(envelope.cipher.iv) },
    key,
    decode(envelope.cipher.ciphertext)
  );
  const value: unknown = JSON.parse(new TextDecoder().decode(plaintext));
  if (!value || typeof value !== 'object') throw new Error('Invalid BYOK vault');
  return value as ProviderKeys;
};

const ensureAccount = (accountId: string) => {
  if (activeAccount !== accountId || !activeKey) throw new Error('Unlock your BYOK vault first');
};

export const subscribeVault = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setActiveAccount = (accountId: string | null) => {
  if (activeAccount === accountId) return;
  lockVault();
  activeAccount = accountId;
  if (accountId) {
    void vaultStore.getItem<ByokProvider[]>(metadataKey(accountId)).then((providers) => {
      configuredProviders.set(accountId, new Set(providers || []));
      notify();
    });
  }
  notify();
};

export const lockVault = () => {
  activeKey = null;
  activeKeys = {};
  sessionKeys = {};
  notify();
};

export const hasVault = async (accountId: string) => {
  const exists = Boolean(await vaultStore.getItem<VaultEnvelope>(storageKey(accountId)));
  if (exists && !configuredProviders.has(accountId)) {
    const providers = await vaultStore.getItem<ByokProvider[]>(metadataKey(accountId));
    configuredProviders.set(accountId, new Set(providers || []));
  }
  return exists;
};

export const isVaultUnlocked = (accountId: string) =>
  activeAccount === accountId && activeKey !== null;

export const createVault = async (
  accountId: string,
  passphrase: string,
  provider: ByokProvider,
  value: string
) => {
  if (!passphrase.trim() || !value.trim()) throw new Error('Passphrase and API key are required');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  const keys = { [provider]: value.trim() } satisfies ProviderKeys;
  await vaultStore.setItem(storageKey(accountId), await encrypt(key, keys, salt));
  configuredProviders.set(accountId, new Set([provider]));
  await vaultStore.setItem(metadataKey(accountId), [provider]);
  activeAccount = accountId;
  activeKey = key;
  activeKeys = keys;
  configuredProviders.set(accountId, new Set(Object.keys(keys) as ByokProvider[]));
  sessionKeys = {};
  notify();
};

export const unlockVault = async (accountId: string, passphrase: string) => {
  const envelope = await vaultStore.getItem<VaultEnvelope>(storageKey(accountId));
  if (!envelope) throw new Error('No saved BYOK vault exists');
  const key = await deriveKey(passphrase, decode(envelope.kdf.salt));
  const keys = await decrypt(key, envelope);
  activeAccount = accountId;
  activeKey = key;
  activeKeys = keys;
  sessionKeys = {};
  notify();
};

export const saveProviderKey = async (accountId: string, provider: ByokProvider, value: string) => {
  ensureAccount(accountId);
  if (!value.trim()) throw new Error('API key is required');
  const envelope = await vaultStore.getItem<VaultEnvelope>(storageKey(accountId));
  if (!envelope || !activeKey) throw new Error('Unlock your BYOK vault first');
  const nextKeys = { ...activeKeys, [provider]: value.trim() };
  await vaultStore.setItem(
    storageKey(accountId),
    await encrypt(activeKey, nextKeys, decode(envelope.kdf.salt))
  );
  configuredProviders.set(accountId, new Set(Object.keys(nextKeys) as ByokProvider[]));
  await vaultStore.setItem(metadataKey(accountId), Object.keys(nextKeys));
  activeKeys = nextKeys;
  notify();
};

export const removeProviderKey = async (accountId: string, provider: ByokProvider) => {
  ensureAccount(accountId);
  const envelope = await vaultStore.getItem<VaultEnvelope>(storageKey(accountId));
  if (!envelope || !activeKey) throw new Error('Unlock your BYOK vault first');
  const nextKeys = { ...activeKeys };
  delete nextKeys[provider];
  delete sessionKeys[provider];
  await vaultStore.setItem(
    storageKey(accountId),
    await encrypt(activeKey, nextKeys, decode(envelope.kdf.salt))
  );
  configuredProviders.set(accountId, new Set(Object.keys(nextKeys) as ByokProvider[]));
  await vaultStore.setItem(metadataKey(accountId), Object.keys(nextKeys));
  activeKeys = nextKeys;
  notify();
};

export const setSessionProviderKey = (accountId: string, provider: ByokProvider, value: string) => {
  if (activeAccount !== accountId) {
    lockVault();
    activeAccount = accountId;
  }
  sessionKeys = { ...sessionKeys, [provider]: value.trim() };
  notify();
};

export const getProviderKey = (accountId: string, provider: ByokProvider) => {
  if (activeAccount !== accountId) return undefined;
  return sessionKeys[provider] || activeKeys[provider];
};

export const isProviderConfigured = async (accountId: string, provider: ByokProvider) => {
  if (!configuredProviders.has(accountId)) {
    const providers = await vaultStore.getItem<ByokProvider[]>(metadataKey(accountId));
    configuredProviders.set(accountId, new Set(providers || []));
  }
  return configuredProviders.get(accountId)?.has(provider) ?? false;
};

export const isProviderConfiguredSync = (accountId: string, provider: ByokProvider) =>
  configuredProviders.get(accountId)?.has(provider) ?? false;

export const getVaultSnapshot = (accountId: string) => ({
  hasVault: activeAccount === accountId ? true : false,
  unlocked: isVaultUnlocked(accountId),
  providers: activeAccount === accountId ? Object.keys({ ...activeKeys, ...sessionKeys }) : [],
});

export const resetVault = async (accountId: string) => {
  await vaultStore.removeItem(storageKey(accountId));
  await vaultStore.removeItem(metadataKey(accountId));
  configuredProviders.delete(accountId);
  if (activeAccount === accountId) lockVault();
};

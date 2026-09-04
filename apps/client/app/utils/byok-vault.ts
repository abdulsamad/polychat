import localforage from 'localforage';

import type { modelProviderType } from 'utils';

export type ByokProvider = modelProviderType;
export type ProviderKeys = Partial<Record<ByokProvider, string>>;

interface VaultEnvelope {
  version: 4;
  cipher: { name: 'AES-GCM'; iv: string; ciphertext: string };
  device?: { credentialId: string; prfSalt: string; wrappedVaultKey?: { iv: string; ciphertext: string } };
  recovery: {
    kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
    wrappedVaultKey: { iv: string; ciphertext: string };
  };
}

interface LegacyVaultEnvelope {
  version: 1 | 2;
}

const ITERATIONS = 600_000;
const vaultStore = localforage.createInstance({
  name: 'polychat-secrets',
  storeName: 'byok_vault',
  description: 'Passphrase-encrypted PolyChat provider credentials',
});
const metadataKey = (accountId: string) => `byok-meta:${accountId}`;
const storageKey = (accountId: string) => `byok-vault:${accountId}`;
const vaultContext = (accountId: string, purpose: 'payload' | 'vault-key') =>
  new TextEncoder().encode(`polychat:byok:v3:${purpose}:${accountId}`);

let activeAccount: string | null = null;
let activeKey: CryptoKey | null = null;
let activeKeys: ProviderKeys = {};
let sessionKeys: ProviderKeys = {};
const configuredProviders = new Map<string, Set<ByokProvider>>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());
const encode = (value: Uint8Array) => btoa(String.fromCharCode(...value));
const decode = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));
const logVaultError = (stage: string, error: unknown) => {
  const details =
    error instanceof DOMException
      ? { name: error.name, message: error.message, code: error.code }
      : error instanceof Error
        ? { name: error.name, message: error.message }
        : { value: String(error) };
  console.error(`[BYOK vault] ${stage} failed`, details);
};

const importAesKey = (rawKey: BufferSource) =>
  crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
const derivePassphraseKey = async (passphrase: string, salt: Uint8Array) => {
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
      hash: 'SHA-256',
      iterations: ITERATIONS,
      salt: salt as unknown as BufferSource,
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};
const encrypt = async (
  key: CryptoKey,
  value: Uint8Array,
  accountId: string,
  purpose: 'payload' | 'vault-key'
) => {
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: vaultContext(accountId, purpose) },
    key,
    value as unknown as BufferSource
  );
  return { iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) };
};
const decrypt = (
  key: CryptoKey,
  value: { iv: string; ciphertext: string },
  accountId: string,
  purpose: 'payload' | 'vault-key'
) =>
  crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(value.iv), additionalData: vaultContext(accountId, purpose) },
    key,
    decode(value.ciphertext)
  );

const createDeviceCredential = async (accountId: string) => {
  const prfSalt = randomBytes(32);
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: 'PolyChat', id: window.location.hostname },
        user: {
          id: new TextEncoder().encode(accountId),
          name: accountId,
          displayName: 'PolyChat vault',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
        attestation: 'none',
        timeout: 60_000,
        extensions: { prf: { eval: { first: prfSalt as unknown as BufferSource } } },
      },
    })) as PublicKeyCredential | null;
    if (!credential) throw new Error('Device authentication setup was not completed.');
    const extensions = (credential as PublicKeyCredential & { getClientExtensionResults?: () => any })
      .getClientExtensionResults?.();
    return extensions?.prf?.enabled
      ? { credentialId: new Uint8Array(credential.rawId), prfSalt }
      : null;
  } catch (error) {
    logVaultError('WebAuthn device credential setup', error);
    throw error;
  }
};
const verifyDevice = async (credentialId: Uint8Array, prfSalt: Uint8Array) => {
  try {
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32) as unknown as BufferSource,
        allowCredentials: [{ id: credentialId as unknown as BufferSource, type: 'public-key' }],
        userVerification: 'required',
        timeout: 60_000,
        extensions: { prf: { eval: { first: prfSalt as unknown as BufferSource } } },
      },
    });
    if (!credential) throw new Error('Device authentication was not completed.');
    const extensions = (credential as PublicKeyCredential & { getClientExtensionResults?: () => any })
      .getClientExtensionResults?.();
    const output = extensions?.prf?.results?.first;
    if (!output) throw new Error('This device could not provide a secure unlock secret.');
    return importAesKey(output as BufferSource);
  } catch (error) {
    logVaultError('WebAuthn device assertion', error);
    throw error;
  }
};
const verifyDeviceLegacy = async (credentialId: Uint8Array) => {
  await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32) as unknown as BufferSource,
      allowCredentials: [{ id: credentialId as unknown as BufferSource, type: 'public-key' }],
      userVerification: 'required',
      timeout: 60_000,
    },
  });
};
const ensureAccount = (accountId: string) => {
  if (activeAccount !== accountId || !activeKey) throw new Error('Unlock your BYOK vault first');
};

export const isDeviceUnlockSupported = () =>
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  typeof PublicKeyCredential !== 'undefined' &&
  Boolean(navigator.credentials?.create) &&
  Boolean(navigator.credentials?.get);
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
  const exists = Boolean(
    await vaultStore.getItem<VaultEnvelope | LegacyVaultEnvelope>(storageKey(accountId))
  );
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
  if (!isDeviceUnlockSupported())
    throw new Error('Device authentication requires HTTPS and WebAuthn support.');
  const deviceCredential = await createDeviceCredential(accountId);
  const vaultKeyRaw = randomBytes(32);
  const vaultKey = await importAesKey(vaultKeyRaw);
  const salt = randomBytes(16);
  const passphraseKey = await derivePassphraseKey(passphrase, salt);
  const keys = { [provider]: value.trim() } satisfies ProviderKeys;
  const cipher = await encrypt(
    vaultKey,
    new TextEncoder().encode(JSON.stringify(keys)),
    accountId,
    'payload'
  );
  const wrappedVaultKey = await encrypt(passphraseKey, vaultKeyRaw, accountId, 'vault-key');
  const deviceWrappedVaultKey = deviceCredential
    ? await encrypt(
        await verifyDevice(deviceCredential.credentialId, deviceCredential.prfSalt),
        vaultKeyRaw,
        accountId,
        'vault-key'
      )
    : undefined;
  await vaultStore.setItem(storageKey(accountId), {
    version: 4,
    cipher: { name: 'AES-GCM', ...cipher },
    ...(deviceCredential
      ? {
          device: {
            credentialId: encode(deviceCredential.credentialId),
            prfSalt: encode(deviceCredential.prfSalt),
            wrappedVaultKey: deviceWrappedVaultKey,
          },
        }
      : {}),
    recovery: {
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: encode(salt) },
      wrappedVaultKey,
    },
  } satisfies VaultEnvelope);
  configuredProviders.set(accountId, new Set(Object.keys(keys) as ByokProvider[]));
  await vaultStore.setItem(metadataKey(accountId), Object.keys(keys));
  activeAccount = accountId;
  activeKey = vaultKey;
  activeKeys = keys;
  sessionKeys = {};
  notify();
};
export const unlockVault = async (accountId: string, passphrase?: string) => {
  const envelope = await vaultStore.getItem<VaultEnvelope | LegacyVaultEnvelope>(
    storageKey(accountId)
  );
  if (!envelope) throw new Error('No saved BYOK vault exists');
  if (envelope.version === 3) {
    if (!passphrase) throw new Error('Enter your vault passphrase to migrate this older vault.');
    await verifyDeviceLegacy(decode((envelope as any).device.credentialId));
    const passphraseKey = await derivePassphraseKey(passphrase, decode((envelope as any).recovery.kdf.salt));
    let legacyVaultKey: CryptoKey;
    try {
      legacyVaultKey = await importAesKey(
        await decrypt(passphraseKey, (envelope as any).recovery.wrappedVaultKey, accountId, 'vault-key')
      );
    } catch {
      throw new Error('Incorrect vault passphrase.');
    }
    const plaintext = await decrypt(legacyVaultKey, (envelope as any).cipher, accountId, 'payload');
    const keys: unknown = JSON.parse(new TextDecoder().decode(plaintext));
    if (!keys || typeof keys !== 'object') throw new Error('Invalid BYOK vault');
    activeAccount = accountId;
    activeKey = legacyVaultKey;
    activeKeys = keys as ProviderKeys;
    sessionKeys = {};
    notify();
    return;
  }
  if (envelope.version !== 4) throw new Error('Unsupported BYOK vault version.');
  let vaultKey: CryptoKey;
  try {
    if (!envelope.device?.wrappedVaultKey) throw new Error('Device PRF is unavailable');
    vaultKey = await verifyDevice(decode(envelope.device.credentialId), decode(envelope.device.prfSalt));
    vaultKey = await importAesKey(
      await decrypt(vaultKey, envelope.device.wrappedVaultKey!, accountId, 'vault-key')
    );
  } catch (deviceError) {
    if (!passphrase) {
      throw new Error(
        'This passkey does not support device-only unlock. Enter your vault passphrase instead.'
      );
    }
    const passphraseKey = await derivePassphraseKey(passphrase, decode(envelope.recovery.kdf.salt));
    try {
      vaultKey = await importAesKey(
        await decrypt(passphraseKey, envelope.recovery.wrappedVaultKey, accountId, 'vault-key')
      );
    } catch {
      throw new Error('Incorrect vault passphrase.');
    }
  }
  const plaintext = await decrypt(vaultKey, envelope.cipher, accountId, 'payload');
  const keys: unknown = JSON.parse(new TextDecoder().decode(plaintext));
  if (!keys || typeof keys !== 'object') throw new Error('Invalid BYOK vault');
  activeAccount = accountId;
  activeKey = vaultKey;
  activeKeys = keys as ProviderKeys;
  sessionKeys = {};
  notify();
};
export const saveProviderKey = async (accountId: string, provider: ByokProvider, value: string) => {
  ensureAccount(accountId);
  if (!value.trim()) throw new Error('API key is required');
  const envelope = await vaultStore.getItem<VaultEnvelope>(storageKey(accountId));
  if (!envelope || envelope.version !== 4 || !activeKey)
    throw new Error('Unlock your BYOK vault first');
  const nextKeys = { ...activeKeys, [provider]: value.trim() };
  const cipher = await encrypt(
    activeKey,
    new TextEncoder().encode(JSON.stringify(nextKeys)),
    accountId,
    'payload'
  );
  await vaultStore.setItem(storageKey(accountId), {
    ...envelope,
    cipher: { name: 'AES-GCM', ...cipher },
  });
  configuredProviders.set(accountId, new Set(Object.keys(nextKeys) as ByokProvider[]));
  await vaultStore.setItem(metadataKey(accountId), Object.keys(nextKeys));
  activeKeys = nextKeys;
  notify();
};
export const removeProviderKey = async (accountId: string, provider: ByokProvider) => {
  ensureAccount(accountId);
  const envelope = await vaultStore.getItem<VaultEnvelope>(storageKey(accountId));
  if (!envelope || envelope.version !== 4 || !activeKey)
    throw new Error('Unlock your BYOK vault first');
  const nextKeys = { ...activeKeys };
  delete nextKeys[provider];
  delete sessionKeys[provider];
  const cipher = await encrypt(
    activeKey,
    new TextEncoder().encode(JSON.stringify(nextKeys)),
    accountId,
    'payload'
  );
  await vaultStore.setItem(storageKey(accountId), {
    ...envelope,
    cipher: { name: 'AES-GCM', ...cipher },
  });
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
export const getProviderKey = (accountId: string, provider: ByokProvider) =>
  activeAccount === accountId ? sessionKeys[provider] || activeKeys[provider] : undefined;
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
  hasVault: activeAccount === accountId,
  unlocked: isVaultUnlocked(accountId),
  providers: activeAccount === accountId ? Object.keys({ ...activeKeys, ...sessionKeys }) : [],
});
export const resetVault = async (accountId: string) => {
  await vaultStore.removeItem(storageKey(accountId));
  await vaultStore.removeItem(metadataKey(accountId));
  configuredProviders.delete(accountId);
  if (activeAccount === accountId) lockVault();
};

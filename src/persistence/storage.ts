import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { createMMKV } from 'react-native-mmkv';

import { hmacSha256, safeEqual } from '../core/hmac';

export const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

function randomHex(bytes: number): string {
  return Array.from(getRandomBytes(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

function keychainSecret(item: string, bytes: number): string {
  const existing = SecureStore.getItem(item, KEYCHAIN_OPTIONS);
  if (existing) return existing;
  const secret = randomHex(bytes);
  SecureStore.setItem(item, secret, KEYCHAIN_OPTIONS);
  return secret;
}

const MMKV_KEY = keychainSecret('mmkv-encryption-key', 16);
const HMAC_KEY = keychainSecret('hmac-key', 32);

const SIGNED_FLAG = 'signed-saves-v1';
const acceptUnsigned = SecureStore.getItem(SIGNED_FLAG, KEYCHAIN_OPTIONS) === null;
if (acceptUnsigned) SecureStore.setItem(SIGNED_FLAG, '1', KEYCHAIN_OPTIONS);

export const storage = createMMKV({ id: 'local-state', encryptionKey: MMKV_KEY, encryptionType: 'AES-256' });

export interface Backend {
  get: (key: string) => string | undefined;
  set: (key: string, value: string) => void;
}

export const mmkvBackend: Backend = {
  get: (key) => storage.getString(key),
  set: (key, value) => storage.set(key, value),
};

export const keychainBackend: Backend = {
  get: (key) => SecureStore.getItem(key, KEYCHAIN_OPTIONS) ?? undefined,
  set: (key, value) => SecureStore.setItem(key, value, KEYCHAIN_OPTIONS),
};

interface Envelope {
  v: string;
  h: string;
}

const sign = (key: string, payload: string) => hmacSha256(HMAC_KEY, `${key}\n${payload}`);

function verified(key: string, raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as Envelope;
    return typeof env.v === 'string' && typeof env.h === 'string' && safeEqual(env.h, sign(key, env.v)) ? env.v : null;
  } catch {
    return null;
  }
}

const backupKey = (key: string) => `${key}.bak`;

export function readSigned<T extends object>(backend: Backend, key: string, fallback: T): T {
  const merge = (payload: string): T => ({ ...fallback, ...JSON.parse(payload) });
  try {
    const current = verified(key, backend.get(key));
    if (current !== null) return merge(current);

    const backup = backend.get(backupKey(key));
    const restored = verified(key, backup);
    if (restored !== null && backup) {
      backend.set(key, backup);
      return merge(restored);
    }

    const raw = backend.get(key);
    if (raw && acceptUnsigned) {
      const value = merge(raw);
      writeSigned(backend, key, value);
      return value;
    }
  } catch {
  }
  return fallback;
}

export function writeSigned(backend: Backend, key: string, value: unknown) {
  const previous = backend.get(key);
  if (verified(key, previous) !== null && previous) backend.set(backupKey(key), previous);
  const payload = JSON.stringify(value);
  const env: Envelope = { v: payload, h: sign(key, payload) };
  backend.set(key, JSON.stringify(env));
}

export function readJson<T extends object>(key: string, fallback: T): T {
  return readSigned(mmkvBackend, key, fallback);
}

export function writeJson(key: string, value: unknown) {
  writeSigned(mmkvBackend, key, value);
}

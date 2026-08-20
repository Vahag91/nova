import { v4 as uuidv4 } from 'uuid';
import * as Keychain from 'react-native-keychain';
import { Storage } from './storage';

const KEYCHAIN_SERVICE = 'com.tortnisoft.chatcloud.deviceId.v1';
let memoizedId = null;
let inFlightIdPromise = null;

function normalize(id) {
  return String(id || '').trim();
}

async function setKeychainId(id) {
  const val = normalize(id);
  if (!val) throw new Error('empty id');
  // username is arbitrary ('device'), password holds the id
  await Keychain.setGenericPassword('device', val, {
    service: KEYCHAIN_SERVICE,
  });
  return val;
}

async function resolveDeviceId() {

  // 1) Try Keychain
  try {
    const kc = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    const found = normalize(kc?.password);
    if (found) {
      memoizedId = found;
      try { await Storage.getOrCreateDeviceId(() => found); } catch {}
      return memoizedId;
    }
  } catch (e) {
    // Keychain read error handled silently
  }

  // 2) Legacy fallback (your existing storage)
  try {
    const legacy = normalize(await Storage.getOrCreateDeviceId(() => null));
    if (legacy) {
      try { await setKeychainId(legacy); } catch {}
      memoizedId = legacy;
      return memoizedId;
    }
  } catch {}

  // 3) Generate fresh, write to Keychain (+ mirror)
  const fresh = uuidv4();
  try {
    await setKeychainId(fresh);
  } catch (err) {
    // one quick retry (simulator hiccups)
    try { await setKeychainId(fresh); } catch {}
  }
  try { await Storage.getOrCreateDeviceId(() => fresh); } catch {}
  memoizedId = fresh;
  return memoizedId;
}

export function ensureDeviceId() {
  if (memoizedId) return Promise.resolve(memoizedId);
  if (inFlightIdPromise) return inFlightIdPromise;

  inFlightIdPromise = resolveDeviceId().finally(() => {
    inFlightIdPromise = null;
  });
  return inFlightIdPromise;
}

// Handy for QA: wipe only in debug builds
export async function __resetDeviceId_devOnly() {
  if (!__DEV__) return;
  try { await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE }); } catch {}
  try { await Storage.getOrCreateDeviceId(() => ''); } catch {}
  memoizedId = null;
  inFlightIdPromise = null;
}

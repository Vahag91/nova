import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_BASE, SUPABASE_ANON_KEY } from '../config/endpoints';
import { SOURCE_WORKSPACE_ENABLED } from '../constants/featureFlags';
import { supportsSourceWorkspace } from '../lib/sourceWorkspaceAvailability';

let available = {
  contractVersion: 2,
  available: SOURCE_WORKSPACE_ENABLED,
  sources: {
    document: SOURCE_WORKSPACE_ENABLED,
    transcript: SOURCE_WORKSPACE_ENABLED,
    upload: SOURCE_WORKSPACE_ENABLED,
    youtube: false,
  },
};
let pending;
let checkedAt = 0;
const CACHE_KEY = 'source_workspace_capabilities_v2';
let restored = false;
const listeners = new Set();
function publish(value) {
  if (available === value) return;
  available = value;
  listeners.forEach(listener => listener());
}
async function refresh() {
  if (pending || Date.now() - checkedAt < 30000) return;
  checkedAt = Date.now();
  pending = (async () => {
    if (!restored) {
      try {
        const saved = JSON.parse(await AsyncStorage.getItem(CACHE_KEY));
        if (saved?.contractVersion === 2) publish(saved);
      } catch {}
      restored = true;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(
        `${SUPABASE_BASE}/functions/v1/source-analyze`,
        {
          method: 'GET',
          signal: controller.signal,
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        },
      );
      if (response.ok) {
        const capabilities = await response.json();
        publish(capabilities);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(capabilities));
      }
    } catch {
      /* Retain previously confirmed access to the offline library. */
    } finally {
      clearTimeout(timeout);
    }
  })();
  try {
    await pending;
  } finally {
    pending = null;
  }
}
const subscribe = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => available;
export function useSourceCapabilities() {
  const capabilities = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, []);
  return capabilities;
}
export function useSourceWorkspaceAvailability(type) {
  return supportsSourceWorkspace(useSourceCapabilities(), type);
}

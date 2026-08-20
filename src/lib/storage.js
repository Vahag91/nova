import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildThreadIndexEntry,
  buildThreadStateFromArray,
  hasRenderableMessages,
  mergeThreadRecord,
  normalizeThreadRecord,
  sortThreadIndex,
} from './threadIndex';

const KEY_THREADS = 'threads_v1';
const KEY_THREAD_INDEX = 'threads_index_v2';
const KEY_SETTINGS = 'settings_v1';
const KEY_DEVICE_ID = 'device_id_v1';
const KEY_IMAGES = 'images_v1';
const THREAD_RECORD_PREFIX = 'thread_v2_';

function threadRecordKey(id) {
  return `${THREAD_RECORD_PREFIX}${id}`;
}

function compactThreadIndex(index) {
  return sortThreadIndex(
    (Array.isArray(index) ? index : []).filter(entry => entry?.id && entry.hasMessages)
  );
}

async function loadThreadIndexOnly() {
  try {
    const raw = await AsyncStorage.getItem(KEY_THREAD_INDEX);
    const parsed = raw ? JSON.parse(raw) : [];
    return compactThreadIndex(parsed);
  } catch {
    return [];
  }
}

async function loadThreadRecordsByKeys(keys = [], { throwOnReadError = false } = {}) {
  if (!Array.isArray(keys) || keys.length === 0) {
    return [];
  }

  try {
    const records = [];
    const batchSize = 8;
    for (let offset = 0; offset < keys.length; offset += batchSize) {
      const pairs = await AsyncStorage.multiGet(
        keys.slice(offset, offset + batchSize),
      );

      for (const [, raw] of pairs) {
        if (!raw) continue;

        try {
          const parsed = JSON.parse(raw);
          const normalized = normalizeThreadRecord(parsed);
          if (normalized?.id && hasRenderableMessages(normalized.messages)) {
            records.push(normalized);
          }
        } catch {}
      }

      await new Promise(resolve => setTimeout(resolve, 0));
    }
    return records;
  } catch (error) {
    if (throwOnReadError) throw error;
    return [];
  }
}

async function loadThreadRecordsOnly() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const recordKeys = keys.filter(key => key.startsWith(THREAD_RECORD_PREFIX));
    return loadThreadRecordsByKeys(recordKeys);
  } catch {
    return [];
  }
}

export const Storage = {
  // Threads
  async loadThreadIndex() {
    return loadThreadIndexOnly();
  },
  async loadThreadBodies(threadIndex) {
    try {
      const persistedIndex = compactThreadIndex(threadIndex);
      const records = await loadThreadRecordsByKeys(
        persistedIndex.map(entry => threadRecordKey(entry.id)),
        { throwOnReadError: true },
      );
      return { ...buildThreadStateFromArray(records), loadSucceeded: true };
    } catch {
      return { threadIndex: [], threadsById: {}, loadSucceeded: false };
    }
  },
  async loadThreadState() {
    try {
      const persistedIndex = await loadThreadIndexOnly();

      if (persistedIndex.length > 0) {
        const indexedThreads = await loadThreadRecordsByKeys(
          persistedIndex.map(entry => threadRecordKey(entry.id))
        );

        if (indexedThreads.length > 0) {
          const nextState = buildThreadStateFromArray(indexedThreads);
          const needsIndexRefresh =
            nextState.threadIndex.length !== persistedIndex.length
            || persistedIndex.some(entry => typeof entry?.hasMessages !== 'boolean')
            || persistedIndex.some(entry => typeof entry?.preview !== 'string');

          if (needsIndexRefresh) {
            await this.saveThreadState(nextState.threadIndex, nextState.threadsById);
          }

          return nextState;
        }
      }

      const storedThreadRecords = await loadThreadRecordsOnly();
      if (storedThreadRecords.length > 0) {
        const nextState = buildThreadStateFromArray(storedThreadRecords);
        await this.saveThreadState(nextState.threadIndex, nextState.threadsById);
        await AsyncStorage.removeItem(KEY_THREADS);
        return nextState;
      }

      const raw = await AsyncStorage.getItem(KEY_THREADS);
      const arr = raw ? JSON.parse(raw) : [];
      const legacyThreads = Array.isArray(arr)
        ? arr.filter(thread => hasRenderableMessages(thread?.messages))
        : [];
      const nextState = buildThreadStateFromArray(legacyThreads);

      if (nextState.threadIndex.length > 0) {
        await this.saveThreadState(nextState.threadIndex, nextState.threadsById);
      }

      await AsyncStorage.removeItem(KEY_THREADS);
      return nextState;
    } catch {
      return { threadIndex: [], threadsById: {} };
    }
  },
  async loadThreads() {
    try {
      const { threadIndex, threadsById } = await this.loadThreadState();
      return threadIndex
        .map(entry => threadsById[entry.id] || mergeThreadRecord(entry, null))
        .filter(Boolean);
    }
    catch { return []; }
  },
  async saveThreads(threads) {
    try {
      const nextState = buildThreadStateFromArray(threads);
      await this.saveThreadState(nextState.threadIndex, nextState.threadsById);
    } catch {}
  },
  async saveThreadState(threadIndex, threadsById) {
    try {
      const persistedIndex = compactThreadIndex(threadIndex);
      // During metadata-first startup, older thread bodies may not be loaded
      // yet. Never overwrite those persisted records with index-only shells.
      const bodyPairs = persistedIndex
        .filter(entry => !!threadsById?.[entry.id])
        .map(entry => {
          const normalized = normalizeThreadRecord(threadsById[entry.id]);
          return [threadRecordKey(entry.id), JSON.stringify(normalized)];
        });

      await AsyncStorage.setItem(KEY_THREAD_INDEX, JSON.stringify(persistedIndex));

      if (bodyPairs.length > 0) {
        await AsyncStorage.multiSet(bodyPairs);
      }

      const keys = await AsyncStorage.getAllKeys();
      const staleKeys = keys.filter(
        key => key.startsWith(THREAD_RECORD_PREFIX)
          && !persistedIndex.some(entry => threadRecordKey(entry.id) === key)
      );

      if (staleKeys.length > 0) {
        await AsyncStorage.multiRemove(staleKeys);
      }

      await AsyncStorage.removeItem(KEY_THREADS);
    } catch {}
  },
  async saveThread(thread) {
    try {
      const normalized = normalizeThreadRecord(thread);
      const indexEntry = buildThreadIndexEntry(normalized);
      const currentIndex = await loadThreadIndexOnly();
      const nextIndex = compactThreadIndex([
        ...currentIndex.filter(entry => entry.id !== normalized.id),
        indexEntry,
      ]);

      if (!indexEntry.hasMessages) {
        await AsyncStorage.setItem(
          KEY_THREAD_INDEX,
          JSON.stringify(nextIndex.filter(entry => entry.id !== normalized.id))
        );
        await AsyncStorage.removeItem(threadRecordKey(normalized.id));
        return;
      }

      await AsyncStorage.multiSet([
        [KEY_THREAD_INDEX, JSON.stringify(nextIndex)],
        [threadRecordKey(normalized.id), JSON.stringify(normalized)],
      ]);
      await AsyncStorage.removeItem(KEY_THREADS);
    } catch {}
  },
  async replaceThread(thread) {
    await this.saveThread(thread);
    return this.loadThreads();
  },
  async deleteThread(id) {
    const currentIndex = await loadThreadIndexOnly();
    const nextIndex = currentIndex.filter(entry => entry.id !== id);
    await AsyncStorage.setItem(KEY_THREAD_INDEX, JSON.stringify(nextIndex));
    await AsyncStorage.removeItem(threadRecordKey(id));
    return this.loadThreads();
  },

  // Settings
  async loadSettings() {
    try { const raw = await AsyncStorage.getItem(KEY_SETTINGS); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  },
  async saveSettings(settings) {
    try { await AsyncStorage.setItem(KEY_SETTINGS, JSON.stringify(settings)); } catch {}
  },

  // DeviceId
  async getOrCreateDeviceId(makeId) {
    try {
      let id = await AsyncStorage.getItem(KEY_DEVICE_ID);
      if (!id) {
        id = makeId();
        await AsyncStorage.setItem(KEY_DEVICE_ID, id);
      }
      return id;
    } catch (error) {
      throw error;
    }
  },

  // Images
  async loadImages() {
    try { 
      const raw = await AsyncStorage.getItem(KEY_IMAGES); 
      return raw ? JSON.parse(raw) : [];
    }
    catch (error) { 
      return []; 
    }
  },
  async saveImages(jobs) {
    try { 
      await AsyncStorage.setItem(KEY_IMAGES, JSON.stringify(jobs));
    } catch (error) {
      // Silent save failure
    }
  },
};

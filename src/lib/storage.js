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

export const Storage = {
  // Threads
  async loadThreadState() {
    try {
      const threadIndex = await loadThreadIndexOnly();

      if (threadIndex.length > 0) {
        const pairs = await AsyncStorage.multiGet(
          threadIndex.map(entry => threadRecordKey(entry.id))
        );

        const threadsById = {};

        for (const [key, raw] of pairs) {
          const id = key.replace(THREAD_RECORD_PREFIX, '');
          const indexEntry = threadIndex.find(entry => entry.id === id);

          if (!indexEntry) continue;

          let record = null;
          try {
            record = raw ? JSON.parse(raw) : null;
          } catch {
            record = null;
          }

          threadsById[id] = mergeThreadRecord(indexEntry, record);
        }

        return { threadIndex, threadsById };
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
      const bodyPairs = persistedIndex.map(entry => {
        const normalized = normalizeThreadRecord(
          threadsById?.[entry.id] || mergeThreadRecord(entry, null)
        );
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

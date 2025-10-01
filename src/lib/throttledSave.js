// Payload size management to prevent "payload too large" errors
import { Storage } from './storage';

const SAVE_INTERVAL_MS = 300; // Save at most every 300ms
const saveQueue = new Map(); // Map<threadId, threadData>
let saveTimer = null;

function flushQueue() {
  if (saveQueue.size === 0) {
    saveTimer = null;
    return;
  }

  const threadsToSave = Array.from(saveQueue.values());
  saveQueue.clear(); // Clear the queue immediately

  // Load all threads, update the ones in the queue, then save all
  Storage.loadThreads()
    .then(allThreads => {
      const updatedThreadsMap = new Map(allThreads.map(t => [t.id, t]));
      threadsToSave.forEach(t => updatedThreadsMap.set(t.id, t));
      const finalThreads = Array.from(updatedThreadsMap.values());
      return Storage.saveThreads(finalThreads);
    })
    .catch(error => {
      console.error('ThrottledSave: Error flushing queue:', error);
    })
    .finally(() => {
      saveTimer = null; // Reset timer after flush
    });
}

export const throttledSave = {
  queueSave: (threadId, threadData) => {
    saveQueue.set(threadId, threadData);
    if (!saveTimer) {
      saveTimer = setTimeout(flushQueue, SAVE_INTERVAL_MS);
    }
  },
  immediateSave: (threadId, threadData) => {
    // Clear any pending throttled save for this thread
    saveQueue.delete(threadId);
    if (saveTimer && saveQueue.size === 0) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }

    // Perform immediate save
    Storage.loadThreads()
      .then(allThreads => {
        const updatedThreadsMap = new Map(allThreads.map(t => [t.id, t]));
        updatedThreadsMap.set(threadId, threadData);
        const finalThreads = Array.from(updatedThreadsMap.values());
        return Storage.saveThreads(finalThreads);
      })
      .catch(error => {
        console.error('ThrottledSave: Error during immediate save:', error);
      });
  },
  // For testing/debugging
  _getQueueSize: () => saveQueue.size,
  _clearQueue: () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveQueue.clear();
  },
};

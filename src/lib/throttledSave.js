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

  Promise.all(threadsToSave.map(thread => Storage.saveThread(thread)))
    .catch(error => {
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
  immediateSave: (threadId, threadData, options) => {
    // Clear any pending throttled save for this thread
    saveQueue.delete(threadId);
    if (saveTimer && saveQueue.size === 0) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }

    // Perform immediate save
    return Storage.saveThread(threadData, options);
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

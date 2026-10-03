import { create } from 'zustand';
import { Storage } from '../lib/storage';
import { throttledSave } from '../lib/throttledSave';
import { buildThreadIndexEntry, sortThreadIndex } from '../lib/threadIndex';
import { DEFAULT_CHAT_MODEL } from '../config/models';
import { newThread } from './types';

const DEFAULT_THREAD_TITLE = 'assistant';
let hydrationPromise = null;
let threadBodiesHydrationPromise = null;

function normalizeThreadTitle(title) {
  const trimmed = typeof title === 'string' ? title.trim() : '';
  if (!trimmed) return DEFAULT_THREAD_TITLE;
  const lower = trimmed.toLowerCase();
  if (lower === 'new chat' || lower === 'new conversation') {
    return DEFAULT_THREAD_TITLE;
  }
  return trimmed;
}

function upsertThreadRecord(state, thread) {
  const nextThread = {
    ...(state.threadsById?.[thread.id] || {}),
    ...thread,
  };

  const nextIndexEntry = buildThreadIndexEntry(nextThread);
  const nextIndex = sortThreadIndex([
    nextIndexEntry,
    ...(state.threadIndex || []).filter(entry => entry.id !== nextThread.id),
  ]);

  return {
    threadIndex: nextIndex,
    threadsById: {
      ...(state.threadsById || {}),
      [nextThread.id]: nextThread,
    },
    thread: nextThread,
  };
}

export const useThreadsStore = create((set, get) => ({
  threadIndex: [],
  threadsById: {},
  activeThreadId: null,
  hydrated: false,
  threadBodiesHydrated: false,
  threadBodiesLoadFailed: false,

  // Performance monitoring
  _debug: {
    lastUpdate: null,
    updateCount: 0,
    renderTime: null,
  },

  hydrate: async () => {
    if (get().hydrated) return;
    if (hydrationPromise) return hydrationPromise;

    hydrationPromise = (async () => {
      const threadIndex = await Storage.loadThreadIndex();
      if (!get().hydrated) {
        if (threadIndex.length === 0) {
          // An empty v2 index can also mean an upgrade from legacy storage or
          // recoverable orphan records. Complete that one-time migration before
          // the UI can save a new thread and remove the legacy source.
          const loaded = await Storage.loadThreadState();
          if (get().hydrated) return;
          set({
            threadIndex: loaded.threadIndex || [],
            threadsById: loaded.threadsById || {},
            activeThreadId: null,
            hydrated: true,
            threadBodiesHydrated: true,
          });
        } else {
          set({
            threadIndex,
            threadsById: {},
            activeThreadId: null,
            hydrated: true,
          });
        }
      }
    })().finally(() => {
      hydrationPromise = null;
    });

    return hydrationPromise;
  },

  hydrateThreadBodies: async () => {
    if (get().threadBodiesHydrated) return;
    if (threadBodiesHydrationPromise) return threadBodiesHydrationPromise;

    threadBodiesHydrationPromise = (async () => {
      await get().hydrate();
      if (get().threadBodiesHydrated) return;

      const snapshotIndex = get().threadIndex || [];
      const snapshotIndexById = new Map(
        snapshotIndex.filter(entry => entry?.id).map(entry => [entry.id, entry]),
      );
      const snapshotBodies = get().threadsById || {};
      // This read is deliberately migration-free. Delayed startup hydration
      // must never write stale records over a concurrent delete/reset/new chat.
      set({ threadBodiesLoadFailed: false });
      let loaded = await Storage.loadThreadBodies(snapshotIndex);
      if (!loaded.loadSucceeded) {
        await new Promise(resolve => setTimeout(resolve, 350));
        loaded = await Storage.loadThreadBodies(snapshotIndex);
      }
      if (!loaded.loadSucceeded) {
        if (!get().threadBodiesHydrated) {
          set({ threadBodiesLoadFailed: true });
        }
        return;
      }
      set(state => {
        const loadedIndexById = new Map(
          (loaded.threadIndex || [])
            .filter(entry => entry?.id)
            .map(entry => [entry.id, entry]),
        );
        const nextIndex = [];
        const nextBodies = {};

        (state.threadIndex || []).forEach(currentEntry => {
          const id = currentEntry?.id;
          if (!id) return;

          const snapshotEntry = snapshotIndexById.get(id);
          const currentBody = state.threadsById?.[id];
          const bodyChanged = currentBody !== snapshotBodies[id];
          const entryChanged = currentEntry !== snapshotEntry;
          const addedWhileLoading = !snapshotEntry;
          const localEmptyThread = currentBody && !currentEntry.hasMessages;

          if (
            addedWhileLoading ||
            entryChanged ||
            bodyChanged ||
            localEmptyThread
          ) {
            nextIndex.push(currentEntry);
            if (currentBody) nextBodies[id] = currentBody;
            return;
          }

          const loadedBody = loaded.threadsById?.[id];
          const loadedEntry = loadedIndexById.get(id);
          // Missing/corrupt bodies are omitted instead of leaving ghost rows.
          if (loadedBody && loadedEntry) {
            nextIndex.push(loadedEntry);
            nextBodies[id] = loadedBody;
          }
        });

        const sortedIndex = sortThreadIndex(nextIndex);
        const activeThreadStillExists = sortedIndex.some(
          entry => entry.id === state.activeThreadId,
        );

        return {
          threadIndex: sortedIndex,
          threadsById: nextBodies,
          activeThreadId: activeThreadStillExists
            ? state.activeThreadId
            : (sortedIndex[0]?.id ?? null),
          threadBodiesHydrated: true,
          threadBodiesLoadFailed: false,
        };
      });
    })().finally(() => {
      threadBodiesHydrationPromise = null;
    });

    return threadBodiesHydrationPromise;
  },

  createThread: ({ title = DEFAULT_THREAD_TITLE, model = DEFAULT_CHAT_MODEL, system = null } = {}) => {
    const normalizedTitle = normalizeThreadTitle(title);
    const thread = newThread({ title: normalizedTitle, model, system });

    set(state => {
      const next = upsertThreadRecord(state, thread);
      return {
        threadIndex: next.threadIndex,
        threadsById: next.threadsById,
        activeThreadId: thread.id,
      };
    });

    return thread;
  },

  setActiveThread: (id) => set({ activeThreadId: id }),

  addMessage: (threadId, message) => {
    set(state => {
      const current = state.threadsById?.[threadId];
      if (!current) return {};

      const nextThread = {
        ...current,
        messages: [...(current.messages || []), message],
        updatedAt: message.createdAt || Date.now(),
      };
      const next = upsertThreadRecord(state, nextThread);
      Storage.saveThread(next.thread);
      return {
        threadIndex: next.threadIndex,
        threadsById: next.threadsById,
      };
    });
  },

  updateMessage: (threadId, messageId, updater) => {
    set(state => {
      const current = state.threadsById?.[threadId];
      if (!current) return {};

      const messages = [...(current.messages || [])];
      const messageIndex = messages.findIndex(message => message.id === messageId);
      if (messageIndex < 0) return {};

      const previous = messages[messageIndex];
      const patch = typeof updater === 'function' ? updater(previous) : updater;
      if (!patch) return {};

      messages[messageIndex] = { ...previous, ...patch };
      const nextThread = {
        ...current,
        messages,
        updatedAt: Date.now(),
      };
      const next = upsertThreadRecord(state, nextThread);
      throttledSave.queueSave(threadId, next.thread);
      return {
        threadIndex: next.threadIndex,
        threadsById: next.threadsById,
      };
    });
  },

  removeMessage: (threadId, messageId) => {
    set(state => {
      const current = state.threadsById?.[threadId];
      if (!current) return {};

      const nextThread = {
        ...current,
        messages: (current.messages || []).filter(message => message.id !== messageId),
        updatedAt: Date.now(),
      };
      const next = upsertThreadRecord(state, nextThread);
      Storage.saveThread(next.thread);
      return {
        threadIndex: next.threadIndex,
        threadsById: next.threadsById,
      };
    });
  },

  updateLastAssistantContent: (threadId, updater) => {
    set(state => {
      const current = state.threadsById?.[threadId];
      if (!current) return {};

      const messages = [...(current.messages || [])];
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i].role !== 'assistant') continue;

        const previous = messages[i].content || '';
        const nextContent = updater(previous);
        if (previous !== nextContent) {
          const nextMeta = { ...messages[i].meta };
          if (nextMeta.activity) {
            delete nextMeta.activity;
          }
          messages[i] = {
            ...messages[i],
            content: nextContent,
            meta: nextMeta,
          };
        }
        break;
      }

      const nextThread = {
        ...current,
        messages,
        updatedAt: Date.now(),
      };
      const next = upsertThreadRecord(state, nextThread);
      throttledSave.queueSave(threadId, next.thread);
      return {
        threadIndex: next.threadIndex,
        threadsById: next.threadsById,
      };
    });
  },

  updateThread: (id, patch) => {
    set(state => {
      const current = state.threadsById?.[id];
      if (!current) return {};

      const nextThread = {
        ...current,
        ...patch,
        updatedAt: Date.now(),
      };
      const next = upsertThreadRecord(state, nextThread);
      Storage.saveThread(next.thread);
      return {
        threadIndex: next.threadIndex,
        threadsById: next.threadsById,
      };
    });
  },

  pinThread: (id, pinned) => {
    set(state => {
      const current = state.threadsById?.[id];
      if (!current) return {};

      const nextThread = {
        ...current,
        pinned: !!pinned,
      };
      const next = upsertThreadRecord(state, nextThread);
      Storage.saveThread(next.thread);
      return {
        threadIndex: next.threadIndex,
        threadsById: next.threadsById,
      };
    });
  },

  renameThread: (id, title) => {
    set(state => {
      const current = state.threadsById?.[id];
      if (!current) return {};

      const nextThread = {
        ...current,
        title,
      };
      const next = upsertThreadRecord(state, nextThread);
      Storage.saveThread(next.thread);
      return {
        threadIndex: next.threadIndex,
        threadsById: next.threadsById,
      };
    });
  },

  deleteThread: (threadId) => {
    set(state => {
      const nextThreadsById = { ...(state.threadsById || {}) };
      delete nextThreadsById[threadId];

      const nextThreadIndex = (state.threadIndex || []).filter(entry => entry.id !== threadId);
      const nextActiveThreadId = state.activeThreadId === threadId
        ? (nextThreadIndex[0]?.id ?? null)
        : state.activeThreadId;

      Storage.deleteThread(threadId);

      return {
        threadIndex: nextThreadIndex,
        threadsById: nextThreadsById,
        activeThreadId: nextActiveThreadId,
      };
    });
  },

  reset: async () => {
    try {
      await Storage.saveThreadState([], {});
    } catch (_) {}
    set({
      threadIndex: [],
      threadsById: {},
      activeThreadId: null,
      threadBodiesHydrated: true,
      threadBodiesLoadFailed: false,
    });
  },

  // ===== PRIVATE =====
  privateActive: false,
  privateThread: null,

  startPrivate: (model, title) => {
    const thread = newThread({ title, model, system: null });
    thread.isPrivate = true;
    set({ privateActive: true, privateThread: thread });
  },

  endPrivate: () => set({ privateActive: false, privateThread: null }),

  addPrivateMessage: (message) => {
    set(state => {
      const thread = state.privateThread;
      if (!state.privateActive || !thread) {
        return {};
      }
      return {
        privateThread: {
          ...thread,
          messages: [...(thread.messages || []), message],
          updatedAt: Date.now(),
        },
      };
    });
  },

  updatePrivateMessage: (messageId, updater) => {
    set(state => {
      const thread = state.privateThread;
      if (!state.privateActive || !thread) return {};

      const messages = [...(thread.messages || [])];
      const messageIndex = messages.findIndex(message => message.id === messageId);
      if (messageIndex < 0) return {};

      const previous = messages[messageIndex];
      const patch = typeof updater === 'function' ? updater(previous) : updater;
      if (!patch) return {};

      messages[messageIndex] = { ...previous, ...patch };
      return {
        privateThread: {
          ...thread,
          messages,
          updatedAt: Date.now(),
        },
      };
    });
  },

  removePrivateMessage: (messageId) => {
    set(state => {
      const thread = state.privateThread;
      if (!state.privateActive || !thread) return {};
      return {
        privateThread: {
          ...thread,
          messages: (thread.messages || []).filter(message => message.id !== messageId),
          updatedAt: Date.now(),
        },
      };
    });
  },

  updateLastAssistantContentPrivate: (updater) => {
    set(state => {
      const thread = state.privateThread;
      if (!state.privateActive || !thread) {
        return {};
      }

      const messages = [...(thread.messages || [])];
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i].role !== 'assistant') continue;
        const previous = messages[i].content || '';
        const nextContent = updater(previous);
        const nextMeta = { ...messages[i].meta };
        if (nextMeta.activity) {
          delete nextMeta.activity;
        }
        messages[i] = {
          ...messages[i],
          content: nextContent,
          meta: nextMeta,
        };
        break;
      }

      return {
        privateThread: {
          ...thread,
          messages,
          updatedAt: Date.now(),
        },
      };
    });
  },

  forceSaveThread: (threadId, options) => {
    const thread = get().threadsById?.[threadId];
    if (thread) return throttledSave.immediateSave(threadId, thread, options);
  },

  setThreadSummary: (threadId, summary, metaPatch) => set(state => {
    const current = state.threadsById?.[threadId];
    if (!current) return {};

    const nonSystemCount = (current.messages || []).filter(message => message.role !== 'system').length;
    const nextThread = {
      ...current,
      summary,
      summaryUpdatedAt: metaPatch?.summaryUpdatedAt ?? Date.now(),
      meta: {
        ...current.meta,
        summaryLastMsgCount: metaPatch?.summaryLastMsgCount ?? nonSystemCount,
      },
      updatedAt: Date.now(),
    };
    const next = upsertThreadRecord(state, nextThread);
    Storage.saveThread(next.thread);
    return {
      threadIndex: next.threadIndex,
      threadsById: next.threadsById,
    };
  }),

  insertToChatCallback: null,
  setInsertToChatCallback: (callback) => set({ insertToChatCallback: callback }),
  clearInsertToChatCallback: () => set({ insertToChatCallback: null }),
  insertToChat: (content) => {
    const state = get();
    if (state.insertToChatCallback) {
      try {
        state.insertToChatCallback(content);
      } catch (_) {
        // ignore insert errors from consumers
      }
    }
  },
}));

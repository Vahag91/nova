import { create } from 'zustand';
import { Storage } from '../lib/storage';
import { throttledSave } from '../lib/throttledSave';
import { buildThreadIndexEntry, sortThreadIndex } from '../lib/threadIndex';
import { newThread } from './types';

const DEFAULT_THREAD_TITLE = 'assistant';

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

  // Performance monitoring
  _debug: {
    lastUpdate: null,
    updateCount: 0,
    renderTime: null,
  },

  hydrate: async () => {
    const { threadIndex, threadsById } = await Storage.loadThreadState();
    set({
      threadIndex,
      threadsById,
      activeThreadId: null,
      hydrated: true,
    });
  },

  createThread: ({ title = DEFAULT_THREAD_TITLE, model = 'gpt-5-nano', system = null } = {}) => {
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
    set({ threadIndex: [], threadsById: {}, activeThreadId: null });
  },

  // ===== PRIVATE =====
  privateActive: false,
  privateThread: null,

  startPrivate: (model) => {
    const thread = newThread({ title: 'Private chat', model, system: null });
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

  forceSaveThread: (threadId) => {
    const thread = get().threadsById?.[threadId];
    if (thread) throttledSave.immediateSave(threadId, thread);
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

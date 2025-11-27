import { create } from 'zustand';
import { Storage } from '../lib/storage';
import { throttledSave } from '../lib/throttledSave';
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

function bump(arr, id, patch = {}) {
  return arr.map(t => t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t);
}

function safeSaveThreads(threads) {
  try {
    const maybePromise = Storage.saveThreads(threads);
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.catch(() => {});
    }
  } catch (_) {
    // keep UI responsive on storage failures
  }
}

function isArray(value) {
  return Array.isArray(value);
}

export const useThreadsStore = create((set, get) => ({
  threads: [],
  activeThreadId: null,
  hydrated: false,
  
  // Performance monitoring
  _debug: {
    lastUpdate: null,
    updateCount: 0,
    renderTime: null
  },
  hydrate: async () => {
    let threads = [];
    try {
      const loaded = await Storage.loadThreads();
      threads = isArray(loaded) ? loaded : [];
    } catch (_) {
      threads = [];
    }
    set({
      threads,
      activeThreadId: null,
      hydrated: true,
    });
  },
  // TIP: if you want to default to the new OpenAI chat model everywhere, change model below.
  createThread: ({ title = DEFAULT_THREAD_TITLE, model = 'gpt-5-nano', system = null } = {}) => {
    const normalizedTitle = normalizeThreadTitle(title);
    const t = newThread({ title: normalizedTitle, model, system });
    set(state => {
      const threads = [t, ...state.threads];
      safeSaveThreads(threads);
      return { 
        threads, 
        activeThreadId: t.id
      };
    });
    return t;
  },
  setActiveThread: (id) => set({ activeThreadId: id }),
  addMessage: (threadId, message) => {
    set(state => {
      const next = state.threads.map(t => {
        if (t.id !== threadId) return t;
        return {
          ...t,
          messages: [...(t.messages || []), message],
          updatedAt: message.createdAt,
        };
      });
      safeSaveThreads(next);
      return { threads: next };
    });
  },
  removeMessage: (threadId, messageId) => {
    set(state => {
      const next = state.threads.map(t => {
        if (t.id !== threadId) return t;
        return {
          ...t,
          messages: (t.messages || []).filter(m => m.id !== messageId),
          updatedAt: Date.now(),
        };
      });
      safeSaveThreads(next);
      return { threads: next };
    });
  },
  updateLastAssistantContent: (threadId, updater) => {
    set(state => {
      const next = state.threads.map(t => {
        if (t.id !== threadId) return t;
        const msgs = [...(t.messages || [])];
        let found = false;
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === 'assistant') {
            const prev = msgs[i].content || '';
            const newContent = updater(prev);
            if (prev !== newContent) {
              // Clear activity text when content is updated (streaming completed)
              const updatedMeta = { ...msgs[i].meta };
              if (updatedMeta.activity) {
                delete updatedMeta.activity;
              }
              msgs[i] = { 
                ...msgs[i], 
                content: newContent,
                meta: updatedMeta,
              };
            }
            found = true;
            break;
          }
        }
        const updatedThread = { ...t, messages: msgs, updatedAt: Date.now() };
        throttledSave.queueSave(threadId, updatedThread);
        return updatedThread;
      });
      return { threads: next };
    });
  },
  updateThread: (id, patch) => {
    set((state) => {
      const next = bump(state.threads, id, patch);
      safeSaveThreads(next);
      return { threads: next };
    });
  },
  pinThread: (id, pinned) => {
    set((state) => {
      const next = state.threads.map(t => t.id === id ? { ...t, pinned: !!pinned } : t);
      safeSaveThreads(next);
      return { threads: next };
    });
  },
  renameThread: (id, title) => {
    set((state) => {
      const next = state.threads.map(t => t.id === id ? { ...t, title } : t);
      safeSaveThreads(next);
      return { threads: next };
    });
  },
  deleteThread: (threadId) => {
    set(state => {
      const threads = state.threads.filter(t => t.id !== threadId);
      const activeThreadId = state.activeThreadId === threadId
        ? (threads[0]?.id ?? null)
        : state.activeThreadId;
      safeSaveThreads(threads);
      return { threads, activeThreadId };
    });
  },
  reset: async () => {
    try {
      await Storage.saveThreads([]);
    } catch (_) {}
    set({ threads: [], activeThreadId: null });
  },

  // ===== PRIVATE =====
  privateActive: false,
  privateThread: null,

  startPrivate: (model) => {
    const t = newThread({ title: 'Private chat', model, system: null });
    t.isPrivate = true;
    set({ privateActive: true, privateThread: t });
  },
  endPrivate: () => set({ privateActive: false, privateThread: null }),

  addPrivateMessage: (message) => {
    set(state => {
      const t = state.privateThread;
      if (!state.privateActive || !t) {
        return {};
      }
      return {
        privateThread: { ...t, messages: [...(t.messages || []), message], updatedAt: Date.now() }
      };
    });
  },
  updateLastAssistantContentPrivate: (updater) => {
    set(state => {
      const t = state.privateThread;
      if (!state.privateActive || !t) {
        return {};
      }
      const msgs = [...(t.messages || [])];
      let found = false;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          const prev = msgs[i].content || '';
          const updated = updater(prev);
          // Clear activity text when content is updated (streaming completed)
          const updatedMeta = { ...msgs[i].meta };
          if (updatedMeta.activity) {
            delete updatedMeta.activity;
          }
          msgs[i] = { 
            ...msgs[i], 
            content: updated,
            meta: updatedMeta,
          };
          found = true;
          break;
        }
      }
      const updatedThread = { ...t, messages: msgs, updatedAt: Date.now() };
      return { privateThread: updatedThread };
    });
  },

  forceSaveThread: (threadId) => {
    const state = get();
    const thread = state.threads.find(t => t.id === threadId);
    if (thread) throttledSave.immediateSave(threadId, thread);
  },

  setThreadSummary: (threadId, summary, metaPatch) => set(state => {
    const next = state.threads.map(t => {
      if (t.id !== threadId) return t;
      const nonSystemCount = (t.messages || []).filter(m => m.role !== 'system').length;
      return {
        ...t,
        summary,
        summaryUpdatedAt: metaPatch?.summaryUpdatedAt ?? Date.now(),
        meta: {
          ...t.meta,
          summaryLastMsgCount: metaPatch?.summaryLastMsgCount ?? nonSystemCount,
        },
        updatedAt: Date.now(),
      };
    });
    safeSaveThreads(next);
    return { threads: next };
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

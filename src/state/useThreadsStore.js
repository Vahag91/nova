// state/useThreadsStore.js
import { create } from 'zustand';
import { Storage } from '../lib/storage';
import { throttledSave } from '../lib/throttledSave';
import { newThread } from './types';

function bump(arr, id, patch = {}) {
  return arr.map(t => t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t);
}

export const useThreadsStore = create((set, get) => ({
  threads: [],
  activeThreadId: null,
  hydrated: false,
  hydrate: async () => {
    const threads = await Storage.loadThreads();
    set({
      threads,
      activeThreadId: threads[0]?.id ?? null,
      hydrated: true,
    });
  },
  createThread: ({ title = 'Untitled', model = 'gpt-4o-mini', system = null } = {}) => {
    const t = newThread({ title, model, system });
    set(state => {
      const threads = [t, ...state.threads];
      Storage.saveThreads(threads);
      return { threads, activeThreadId: t.id };
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
          updatedAt: message.createdAt, // Use message timestamp, not current time
        };
      });
      Storage.saveThreads(next);
      return { threads: next };
    });
  },
  updateLastAssistantContent: (threadId, updater) => {
    set(state => {
      const next = state.threads.map(t => {
        if (t.id !== threadId) return t;
        const msgs = [...(t.messages || [])];
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === 'assistant') {
            const prev = msgs[i].content || '';
            const newContent = updater(prev);
            if (prev !== newContent) msgs[i] = { ...msgs[i], content: newContent };
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
      Storage.saveThreads(next);
      return { threads: next };
    });
  },
  pinThread: (id, pinned) => {
    set((state) => {
      const next = state.threads.map(t => t.id === id ? { ...t, pinned: !!pinned } : t);
      Storage.saveThreads(next);
      return { threads: next };
    });
  },
  renameThread: (id, title) => {
    set((state) => {
      const next = state.threads.map(t => t.id === id ? { ...t, title } : t);
      Storage.saveThreads(next);
      return { threads: next };
    });
  },
  deleteThread: (threadId) => {
    set(state => {
      const threads = state.threads.filter(t => t.id !== threadId);
      const activeThreadId = state.activeThreadId === threadId
        ? (threads[0]?.id ?? null)
        : state.activeThreadId;
      Storage.saveThreads(threads);
      return { threads, activeThreadId };
    });
  },
  reset: async () => {
    await Storage.saveThreads([]);
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
      if (!state.privateActive || !t) return {};
      return {
        privateThread: { ...t, messages: [...(t.messages || []), message], updatedAt: Date.now() }
      };
    });
  },
  updateLastAssistantContentPrivate: (updater) => {
    set(state => {
      const t = state.privateThread;
      if (!state.privateActive || !t) return {};
      const msgs = [...(t.messages || [])];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          const prev = msgs[i].content || '';
          msgs[i] = { ...msgs[i], content: updater(prev) };
          break;
        }
      }
      const updatedThread = { ...t, messages: msgs, updatedAt: Date.now() };
      throttledSave.queueSave(t.id, updatedThread);
      return { privateThread: updatedThread };
    });
  },

  forceSaveThread: (threadId) => {
    const state = get();
    const thread = state.threads.find(t => t.id === threadId) || state.privateThread;
    if (thread) throttledSave.immediateSave(threadId, thread);
  },

  // ✅ Accepts metaPatch so summary cadence stays accurate
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
    Storage.saveThreads(next);
    return { threads: next };
  }),

  // Insert content callback (used by images studio)
  insertToChatCallback: null,
  setInsertToChatCallback: (callback) => set({ insertToChatCallback: callback }),
  clearInsertToChatCallback: () => set({ insertToChatCallback: null }),
  insertToChat: (content) => {
    const state = get();
    if (state.insertToChatCallback) state.insertToChatCallback(content);
  },
}));

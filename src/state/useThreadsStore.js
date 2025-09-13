// useThreadsStore.js
import { create } from 'zustand';
import { Storage } from '../lib/storage';
import { newThread } from './types';

// Helper: bump updatedAt and persist
function bump(arr, id, patch = {}) {
  return arr.map(t => t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t);
}

export const useThreadsStore = create((set, get) => ({
  // ===== persisted (normal) =====
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
          updatedAt: Date.now(),
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
            msgs[i] = { ...msgs[i], content: updater(prev) };
            break;
          }
        }
        return { ...t, messages: msgs, updatedAt: Date.now() };
      });
      Storage.saveThreads(next);
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
      const next = bump(state.threads, id, { pinned: !!pinned });
      Storage.saveThreads(next);
      return { threads: next };
    });
  },
  renameThread: (id, title) => {
    set((state) => {
      const next = bump(state.threads, id, { title });
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

  // ===== PRIVATE (ephemeral, never persisted) =====
  privateActive: false,
  privateThread: null, // { ...thread, isPrivate:true }

  startPrivate: (model) => {
    const t = newThread({ title: 'Private chat', model, system: null });
    t.isPrivate = true; // marker
    set({ privateActive: true, privateThread: t });
  },
  endPrivate: () => set({ privateActive: false, privateThread: null }),

  addPrivateMessage: (message) => {
    set(state => {
      const t = state.privateThread;
      if (!state.privateActive || !t) return {};
      return {
        privateThread: {
          ...t,
          messages: [...(t.messages || []), message],
          updatedAt: Date.now(),
        }
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
      return { privateThread: { ...t, messages: msgs, updatedAt: Date.now() } };
    });
  },
}));

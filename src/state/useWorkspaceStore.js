import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WORKSPACE_STORAGE_KEY } from '../lib/workspace';
import { validateWorkspaceRecord } from '../lib/workspaceContract';

let hydration;
let writes = Promise.resolve();

export const useWorkspaceStore = create((set, get) => ({
  records: [],
  hydrated: false,
  error: null,
  hydrate: () => {
    if (get().hydrated) return Promise.resolve();
    if (hydration) return hydration;
    hydration = (async () => {
      try {
        const raw = await AsyncStorage.getItem(WORKSPACE_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) throw new Error('Invalid workspace data');
        set({ records: parsed.map(validateWorkspaceRecord), hydrated: true, error: null });
      } catch (error) {
        set({ error: 'load' });
        throw error;
      } finally { hydration = null; }
    })();
    return hydration;
  },
  save: record => {
    const operation = writes.catch(() => {}).then(async () => {
      await get().hydrate();
      const validated = validateWorkspaceRecord(record);
      const records = [validated, ...get().records.filter(r => r.id !== validated.id)];
      await AsyncStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(records));
      set({ records, error: null });
    });
    writes = operation;
    return operation;
  },
  remove: id => {
    const operation = writes.catch(() => {}).then(async () => {
      await get().hydrate();
      const records = get().records.filter(r => r.id !== id);
      await AsyncStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(records));
      set({ records, error: null });
    });
    writes = operation;
    return operation;
  },
}));

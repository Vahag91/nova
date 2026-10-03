import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const key = 'source_workspace_pending_v2';
let writes = Promise.resolve();
let loading;
export const useWorkspaceJobs = create((set, get) => ({
  jobs: [],
  hydrated: false,
  error: false,
  hydrate: () => {
    if (get().hydrated) return Promise.resolve();
    if (!loading)
      loading = (async () => {
        try {
          const raw = await AsyncStorage.getItem(key);
          const jobs = raw ? JSON.parse(raw) : [];
          if (
            !Array.isArray(jobs) ||
            jobs.some(j => !j.id || !j.type || !Array.isArray(j.documents))
          )
            throw new Error('Invalid pending analyses');
          set({ jobs, hydrated: true, error: false });
        } catch (error) {
          set({ error: true });
          throw error;
        } finally {
          loading = null;
        }
      })();
    return loading;
  },
  save: job => {
    const operation = writes
      .catch(() => {})
      .then(async () => {
        await get().hydrate();
        const jobs = [job, ...get().jobs.filter(j => j.id !== job.id)];
        await AsyncStorage.setItem(key, JSON.stringify(jobs));
        set({ jobs });
      });
    writes = operation;
    return operation;
  },
  remove: id => {
    const operation = writes
      .catch(() => {})
      .then(async () => {
        await get().hydrate();
        const jobs = get().jobs.filter(j => j.id !== id);
        await AsyncStorage.setItem(key, JSON.stringify(jobs));
        set({ jobs });
      });
    writes = operation;
    return operation;
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_THREADS = 'threads_v1';
const KEY_SETTINGS = 'settings_v1';
const KEY_DEVICE_ID = 'device_id_v1';

export const Storage = {
  // Threads
  async loadThreads() {
    try { const raw = await AsyncStorage.getItem(KEY_THREADS); return raw ? JSON.parse(raw) : []; }
    catch { return []; }
  },
  async saveThreads(threads) {
    try { await AsyncStorage.setItem(KEY_THREADS, JSON.stringify(threads)); } catch {}
  },
  async replaceThread(thread) {
    const all = await this.loadThreads();
    const idx = all.findIndex(t => t.id === thread.id);
    if (idx >= 0) all[idx] = thread; else all.unshift(thread);
    await this.saveThreads(all);
    return all;
  },
  async deleteThread(id) {
    const all = await this.loadThreads();
    const filtered = all.filter(t => t.id !== id);
    await this.saveThreads(filtered);
    return filtered;
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
      console.log('Storage.getOrCreateDeviceId: Starting...');
      let id = await AsyncStorage.getItem(KEY_DEVICE_ID);
      console.log('Storage.getOrCreateDeviceId: Existing ID:', id);
      if (!id) {
        console.log('Storage.getOrCreateDeviceId: Creating new ID...');
        id = makeId();
        console.log('Storage.getOrCreateDeviceId: Generated ID:', id);
        await AsyncStorage.setItem(KEY_DEVICE_ID, id);
        console.log('Storage.getOrCreateDeviceId: Saved to storage');
      }
      console.log('Storage.getOrCreateDeviceId: Returning ID:', id);
      return id;
    } catch (error) {
      console.error('Storage.getOrCreateDeviceId: Error:', error);
      throw error;
    }
  },
};

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_THREADS = 'threads_v1';
const KEY_SETTINGS = 'settings_v1';
const KEY_DEVICE_ID = 'device_id_v1';
const KEY_IMAGES = 'images_v1';

export const Storage = {
  // Threads
  async loadThreads() {
    try {
      const raw = await AsyncStorage.getItem(KEY_THREADS);
      const arr = raw ? JSON.parse(raw) : [];
      // Filter out empty threads (no user/assistant messages)
      return Array.isArray(arr) ? arr.filter(t => Array.isArray(t?.messages) && t.messages.some(m => m.role === 'user' || m.role === 'assistant')) : [];
    }
    catch { return []; }
  },
  async saveThreads(threads) {
    try {
      const filtered = Array.isArray(threads)
        ? threads.filter(t => Array.isArray(t?.messages) && t.messages.some(m => m.role === 'user' || m.role === 'assistant'))
        : [];
      await AsyncStorage.setItem(KEY_THREADS, JSON.stringify(filtered));
    } catch {}
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
      let id = await AsyncStorage.getItem(KEY_DEVICE_ID);
      if (!id) {
        id = makeId();
        await AsyncStorage.setItem(KEY_DEVICE_ID, id);
      }
      return id;
    } catch (error) {
      throw error;
    }
  },

  // Images
  async loadImages() {
    try { 
      const raw = await AsyncStorage.getItem(KEY_IMAGES); 
      return raw ? JSON.parse(raw) : [];
    }
    catch (error) { 
      return []; 
    }
  },
  async saveImages(jobs) {
    try { 
      await AsyncStorage.setItem(KEY_IMAGES, JSON.stringify(jobs));
    } catch (error) {
      // Silent save failure
    }
  },
};

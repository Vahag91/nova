// src/state/useSettingsStore.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import DEFAULT_MODELS from '../config/models';
import { isPremiumModel, FREE_MODEL } from '../config/premium';

const SETTINGS_V2 = 'settings.v2';
const SETTINGS_V1 = 'settings.v1'; // legacy (global temperature only)

export const useSettingsStore = create((set, get) => ({
  hydrated: false,

  // current selection
  model: 'gpt-5-nano',
  
  // Performance monitoring
  _debug: {
    lastUpdate: null,
    updateCount: 0,
    renderTime: null
  },

  // GLOBAL default temperature (fallback)
  temperature: 0.7,

  // per-model overrides
  perModelTemp: {}, // { [modelKey]: number }

  // model registry (server-provided, fallback to local defaults)
  models: DEFAULT_MODELS,

  // ---------- actions ----------
  setModel: (model) => {
    // Validate premium - if free user tries to set premium model, reset to free model
    // Note: This check happens at the component level too, but this is a safety net
    set({ model });
    get().save();
  },
  
  // Validate current model against premium status
  validateModelForPremium: (isPremium) => {
    const currentModel = get().model;
    if (!isPremium && isPremiumModel(currentModel)) {
      set({ model: FREE_MODEL });
      get().save();
    }
  },
  // keep old API (global default)
  setTemperature: (t) => {
    set({ temperature: t });
    get().save();
  },

  // per-model override
  setModelTemp: (modelKey, t) => {
    const map = { ...(get().perModelTemp || {}) };
    map[modelKey] = t;
    set({ perModelTemp: map });
    get().save();
  },

  // clear override → use global default
  clearModelTemp: (modelKey) => {
    const map = { ...(get().perModelTemp || {}) };
    if (map[modelKey] != null) {
      delete map[modelKey];
      set({ perModelTemp: map });
      get().save();
    }
  },

  // registry
  setModels: (incoming) => {
    // Merge server models (left wins) over local defaults for easy rollout.
    const merged = { ...DEFAULT_MODELS, ...(incoming && typeof incoming === 'object' ? incoming : {}) };
    set({ models: merged });

    // If current model is missing (e.g., renamed upstream), fall back gracefully.
    const cur = get().model;
    if (!merged[cur]) {
      set({ model: 'gpt-5-nano' });
      get().save();
    }
  },

  // Force refresh models from server
  forceRefreshModels: async () => {
    try {
      // Clear only settings cache, not the actual registry module.
      try {
        await AsyncStorage.removeItem(SETTINGS_V2);
        await AsyncStorage.removeItem(SETTINGS_V1);
      } catch {}

      const { fetchModels } = await import('../api/models'); // you already call MODELS_URL elsewhere
      const incoming = await fetchModels();
      if (incoming && Object.keys(incoming).length > 0) {
        const merged = { ...DEFAULT_MODELS, ...incoming };
        set({ models: merged });

        // guard current selection
        const cur = get().model;
        if (!merged[cur]) set({ model: 'gpt-5-nano' });
        return true;
      }
    } catch {}
    return false;
  },

  // compute the effective temperature for a given model
  getEffectiveTemp: (modelKey) => {
    const { perModelTemp, temperature } = get();
    if (modelKey && perModelTemp && perModelTemp[modelKey] != null) {
      return perModelTemp[modelKey];
    }
    return temperature;
  },

  // ---------- persistence ----------
  save: async () => {
    const { model, temperature, perModelTemp } = get();
    try {
      await AsyncStorage.setItem(
        SETTINGS_V2,
        JSON.stringify({ model, temperature, perModelTemp })
      );
    } catch {}
  },

  hydrate: async () => {
    try {
      // v2 first (has perModelTemp)
      const raw2 = await AsyncStorage.getItem(SETTINGS_V2);
      if (raw2) {
        const data = JSON.parse(raw2);
        set({
          model: data.model ?? 'gpt-5-nano',
          temperature: typeof data.temperature === 'number' ? data.temperature : 0.7,
          perModelTemp: data.perModelTemp || {},
        });
        set({ hydrated: true });
        return;
      }

      // migrate from v1 (only temperature + model)
      const raw1 = await AsyncStorage.getItem(SETTINGS_V1);
      if (raw1) {
        const data = JSON.parse(raw1);
        set({
          model: data.model ?? 'gpt-5-nano',
          temperature: typeof data.temperature === 'number' ? data.temperature : 0.7,
          perModelTemp: {},
        });
        await get().save(); // write as v2
        set({ hydrated: true });
        return;
      }
    } catch {}

    // fresh install defaults
    set({ hydrated: true });
  },

  // Danger zone
  reset: async () => {
    try {
      await AsyncStorage.removeItem(SETTINGS_V2);
      await AsyncStorage.removeItem(SETTINGS_V1);
    } catch {}
    set({
      model: 'gpt-5-nano',
      temperature: 0.7,
      perModelTemp: {},
      // keep models as-is
    });
  },
}));

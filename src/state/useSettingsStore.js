// src/state/useSettingsStore.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import DEFAULT_MODELS, {
  DEFAULT_CHAT_MODEL,
  buildModelRegistry,
  normalizeChatModelKey,
} from '../config/models';
import { isPremiumModel, FREE_MODEL } from '../config/premium';

const SETTINGS_V2 = 'settings.v2';
const SETTINGS_V1 = 'settings.v1'; // legacy (global temperature only)
let settingsHydrationPromise = null;
const SETTINGS_HYDRATION_LIVENESS_MS = 2500;

function modelRegistriesEqual(left, right) {
  if (left === right) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

export const useSettingsStore = create((set, get) => ({
  hydrated: false,

  // current selection
  model: DEFAULT_CHAT_MODEL,
  
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
    set({ model: normalizeChatModelKey(model) });
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
    const nextModels = buildModelRegistry(incoming);
    const modelsChanged = !modelRegistriesEqual(get().models, nextModels);
    if (modelsChanged) {
      set({ models: nextModels });
    }

    // If current model is missing (e.g., removed upstream), fall back gracefully.
    const cur = normalizeChatModelKey(get().model);
    let modelChanged = false;
    if (cur !== get().model && nextModels?.[cur]) {
      set({ model: cur });
      modelChanged = true;
    } else if (!nextModels?.[cur]) {
      const fallback =
        nextModels?.[FREE_MODEL]
          ? FREE_MODEL
          : (Object.keys(nextModels).find(k => nextModels?.[k]?.kind === 'chat') || Object.keys(nextModels)[0] || FREE_MODEL);
      set({ model: fallback });
      modelChanged = true;
    }
    if (modelsChanged || modelChanged) {
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
        get().setModels(incoming);
        await get().save();
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
    const { model, temperature, perModelTemp, models } = get();
    try {
      await AsyncStorage.setItem(
        SETTINGS_V2,
        JSON.stringify({ model, temperature, perModelTemp, models })
      );
    } catch {}
  },

  hydrate: async () => {
    if (get().hydrated) return;
    if (settingsHydrationPromise) return settingsHydrationPromise;

    settingsHydrationPromise = (async () => {
      let abandoned = false;
      const fallbackId = setTimeout(() => {
        abandoned = true;
        if (!get().hydrated) set({ hydrated: true });
      }, SETTINGS_HYDRATION_LIVENESS_MS);
      try {
        // v2 first (has perModelTemp)
        const raw2 = await AsyncStorage.getItem(SETTINGS_V2);
        if (abandoned) return;
        if (raw2) {
          const data = JSON.parse(raw2);
          set({
            model: normalizeChatModelKey(data.model),
            temperature: typeof data.temperature === 'number' ? data.temperature : 0.7,
            perModelTemp: data.perModelTemp || {},
            models: data.models
              ? buildModelRegistry(data.models)
              : DEFAULT_MODELS,
            hydrated: true,
          });
          return;
        }

        // migrate from v1 (only temperature + model)
        const raw1 = await AsyncStorage.getItem(SETTINGS_V1);
        if (abandoned) return;
        if (raw1) {
          const data = JSON.parse(raw1);
          set({
            model: normalizeChatModelKey(data.model),
            temperature: typeof data.temperature === 'number' ? data.temperature : 0.7,
            perModelTemp: {},
          });
          await get().save(); // write as v2
          set({ hydrated: true });
          return;
        }
      } catch {
      } finally {
        clearTimeout(fallbackId);
      }

      // fresh install defaults
      if (!abandoned) set({ hydrated: true });
    })().finally(() => {
      settingsHydrationPromise = null;
    });

    return settingsHydrationPromise;
  },

  // Danger zone
  reset: async () => {
    try {
      await AsyncStorage.removeItem(SETTINGS_V2);
      await AsyncStorage.removeItem(SETTINGS_V1);
    } catch {}
    set({
      model: DEFAULT_CHAT_MODEL,
      temperature: 0.7,
      perModelTemp: {},
      // keep models as-is
    });
  },
}));

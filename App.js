import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import DrawerNavigator from './src/navigation/DrawerNavigator';
import { useSettingsStore } from './src/state/useSettingsStore';
import { useThreadsStore } from './src/state/useThreadsStore';
import { useImagesStore } from './src/state/useImagesStore';
import { ensureDeviceId } from './src/lib/deviceId';
import { MODELS_URL, SUPABASE_ANON_KEY } from './src/config/endpoints';


export default function App() {
  const hydrateSettings = useSettingsStore(s => s.hydrate);
  const settingsHydrated = useSettingsStore(s => s.hydrated);
  const setModels = useSettingsStore(s => s.setModels);

  const hydrateThreads = useThreadsStore(s => s.hydrate);
  const threadsHydrated = useThreadsStore(s => s.hydrated);

  const hydrateImages = useImagesStore(s => s.hydrate);
  const imagesHydrated = useImagesStore(s => s.hydrated);

  const [deviceIdReady, setDeviceIdReady] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false); // NEW

  useEffect(() => {
    (async () => {
      const deviceId = await ensureDeviceId();
      console.log('Device ID:', deviceId);
      setDeviceIdReady(true);
    })();
    hydrateSettings();
    hydrateThreads();
    hydrateImages();

    // --- Fetch models (non-blocking; flips modelsLoaded when done) ---
    (async () => {
      try {
        const r = await fetch(MODELS_URL, {
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });
        if (r.ok) {
          const json = await r.json();
          console.log('App - models API response:', json);
          // The API might return models directly or in a models property
          const modelsData = json?.models || json;
          if (modelsData && typeof modelsData === 'object') {
            setModels(modelsData);
          }
        } else {
          console.log('Models fetch failed:', r.status);
        }
      } catch (e) {
        console.log('Models fetch error:', e?.message);
      } finally {
        setModelsLoaded(true);
      }
    })();
  }, []);

  const ready = settingsHydrated && threadsHydrated && imagesHydrated && deviceIdReady && modelsLoaded;

  if (!ready) return null; // simple loader; optional spinner

  return (
    <KeyboardProvider statusBarTranslucent>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <DrawerNavigator />
      </GestureHandlerRootView>
    </KeyboardProvider>
  );
}
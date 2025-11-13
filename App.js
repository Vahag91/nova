import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DrawerNavigator from './src/navigation/DrawerNavigator';
import { useSettingsStore } from './src/state/useSettingsStore';
import { useThreadsStore } from './src/state/useThreadsStore';
import { useImagesStore } from './src/state/useImagesStore';
import { ensureDeviceId } from './src/lib/deviceId';
import IntroductionAnimationScreen from './src/screens/IntroductionAnimationScreen';
import { MODELS_URL, SUPABASE_ANON_KEY } from './src/config/endpoints';
import GlobalErrorBoundary from './src/components/GlobalErrorBoundary';
import OfflineBanner from './src/components/OfflineBanner'; // ← NEW
import './src/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import UsageTrackingService from './src/services/UsageTrackingService';

export default function App() {
  const hydrateSettings = useSettingsStore(s => s.hydrate);
  const settingsHydrated = useSettingsStore(s => s.hydrated);
  const setModels = useSettingsStore(s => s.setModels);

  const hydrateThreads = useThreadsStore(s => s.hydrate);
  const threadsHydrated = useThreadsStore(s => s.hydrated);

  const hydrateImages = useImagesStore(s => s.hydrate);
  const imagesHydrated = useImagesStore(s => s.hydrated);

  const [deviceIdReady, setDeviceIdReady] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [firstLaunch, setFirstLaunch] = useState(null);

  useEffect(() => {
    (async () => {
      await ensureDeviceId();
      setDeviceIdReady(true);
    })();

    hydrateSettings();
    hydrateThreads();
    hydrateImages();
    
    // Initialize usage tracking (first launch date)
    UsageTrackingService.initializeFirstLaunch();

    (async () => {
      try {
        const v = await AsyncStorage.getItem('hasLaunched');
        if (v === null) {
          await AsyncStorage.setItem('hasLaunched', 'true');
          setFirstLaunch(true);
        } else {
          setFirstLaunch(false);
        }
      } catch {
        setFirstLaunch(false);
      }
    })();

    (async () => {
      try {
        const r = await fetch(MODELS_URL, {
          headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        });
        if (r.ok) {
          const json = await r.json();
          const modelsData = json?.models || json;
          console.log('modelsData', modelsData);
          
          if (modelsData && typeof modelsData === 'object') setModels(modelsData);
        }
      } catch {
      } finally {
        setModelsLoaded(true);
      }
    })();
  }, []);

  const bootReady =
    settingsHydrated &&
    threadsHydrated &&
    imagesHydrated &&
    deviceIdReady &&
    modelsLoaded;

    
  if (firstLaunch === null) return null;
  if (firstLaunch && deviceIdReady) {
    return (
      <GlobalErrorBoundary>
        <SafeAreaProvider>
          <SubscriptionProvider>
            <KeyboardProvider statusBarTranslucent>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <OfflineBanner />
                <IntroductionAnimationScreen onComplete={() => setFirstLaunch(false)} />
              </GestureHandlerRootView>
            </KeyboardProvider>
          </SubscriptionProvider>
        </SafeAreaProvider>
      </GlobalErrorBoundary>
    );
  }

  if (!bootReady) return null;

  return (
    <GlobalErrorBoundary>
      <SafeAreaProvider>
        <SubscriptionProvider>
          <KeyboardProvider statusBarTranslucent>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <OfflineBanner /> 
              <DrawerNavigator />
            </GestureHandlerRootView>
          </KeyboardProvider>
        </SubscriptionProvider>
      </SafeAreaProvider>
    </GlobalErrorBoundary>
  );
}

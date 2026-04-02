// App.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  View,
  ActivityIndicator,
  StyleSheet,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import NetInfo from '@react-native-community/netinfo';
import notifee, { EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import DrawerNavigator from './src/navigation/DrawerNavigator';
import { useSettingsStore } from './src/state/useSettingsStore';
import { useThreadsStore } from './src/state/useThreadsStore';
import { useImagesStore } from './src/state/useImagesStore';
import { ensureDeviceId } from './src/lib/deviceId';
import IntroductionAnimationScreen from './src/screens/IntroductionAnimationScreen';
import { MODELS_URL, SUPABASE_ANON_KEY } from './src/config/endpoints';
import GlobalErrorBoundary from './src/components/GlobalErrorBoundary';
import OfflineBanner from './src/components/OfflineBanner';
import { logException } from './src/error/logger';
import './src/i18n';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import UsageTrackingService from './src/services/UsageTrackingService';
import { navigate } from './src/navigation/rootNavigation';
import { ONBOARDING_KEY, ONE_TIME_OFFER_KEY } from './src/constants/storageKeys';
import { colors } from './src/styles/colors';
import {
  consumePendingNotificationNav,
  setPendingNotificationNav,
} from './src/notifications/notificationNavQueue';

const FETCH_TIMEOUT_MS = 10000; // 10 seconds
const REMOVED_REWARDS_ROUTE_NAMES = new Set(['Rewards', 'RewardsHome', 'RewardsList']);
const REMOVED_DAILY_REWARD_CACHE_KEY = 'notifee_daily_reward_schedule_v2';
const REMOVED_DAILY_REWARD_NOTIFICATION_PREFIX = 'daily_reward_';

function isRemovedRewardsRoute(route) {
  return typeof route === 'string' && REMOVED_REWARDS_ROUTE_NAMES.has(route);
}

export default function App() {
  const { t } = useTranslation();

  const hydrateSettings = useSettingsStore(s => s.hydrate);
  const settingsHydrated = useSettingsStore(s => s.hydrated);
  const setModels = useSettingsStore(s => s.setModels);

  const hydrateThreads = useThreadsStore(s => s.hydrate);
  const threadsHydrated = useThreadsStore(s => s.hydrated);

  const hydrateImages = useImagesStore(s => s.hydrate);
  const imagesHydrated = useImagesStore(s => s.hydrated);

  const [deviceIdReady, setDeviceIdReady] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [, setModelsError] = useState(null);
  const [firstLaunch, setFirstLaunch] = useState(null);
  const [navigationReady, setNavigationReady] = useState(false);
  const [pendingPostOnboardingPaywall, setPendingPostOnboardingPaywall] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => {});
    }
  }, []);

  const loadModels = useCallback(async () => {
    try {
      setModelsError(null);

      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected && netInfo.isInternetReachable !== true) {
        throw new Error('NETWORK_ERROR');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const r = await fetch(MODELS_URL, {
          headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!r.ok) {
          throw new Error(`Failed to load models: ${r.status} ${r.statusText}`);
        }

        const json = await r.json();
        const modelsData = json?.models || json;

        if (modelsData && typeof modelsData === 'object') {
          setModels(modelsData);
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('TIMEOUT_ERROR');
        }
        throw fetchError;
      }
    } catch (error) {
      const errorMessage = error?.message || String(error);
      logException(error, { context: 'loadModels' });

      setModelsError(error);

      if (modelsLoaded) {
        const isTimeout = errorMessage === 'TIMEOUT_ERROR';
        const isNetwork = errorMessage === 'NETWORK_ERROR';

        let message = t('app.errors.modelsLoadMessage', {
          defaultValue:
            'Unable to load AI models. The app will use default models. Please check your internet connection.',
        });

        if (isTimeout) {
          message = t('app.errors.modelsLoadTimeout', {
            defaultValue:
              'Loading models took too long. The app will use default models. Please try again.',
          });
        } else if (isNetwork) {
          message = t('app.errors.modelsLoadNetwork', {
            defaultValue:
              'No internet connection. The app will use default models. Please check your connection.',
          });
        }

        Alert.alert(
          t('app.errors.modelsLoadTitle', { defaultValue: 'Failed to Load Models' }),
          message,
          [
            { text: t('common.ok', { defaultValue: 'OK' }), style: 'cancel' },
            { text: t('common.retry', { defaultValue: 'Retry' }), onPress: loadModels },
          ]
        );
      }
    } finally {
      setModelsLoaded(true);
    }
  }, [setModels, modelsLoaded, t]);

  useEffect(() => {
    (async () => {
      try {
        await ensureDeviceId();
        setDeviceIdReady(true);
      } catch (error) {
        logException(error, { context: 'ensureDeviceId' });
        setDeviceIdReady(true);
      }
    })();

    try {
      hydrateSettings();
      hydrateThreads();
      hydrateImages();
    } catch (error) {
      logException(error, { context: 'hydrateStores' });
    }

    try {
      UsageTrackingService.initializeFirstLaunch();
    } catch {
      // non-critical
    }

    (async () => {
      try {
        const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (completed === 'true') {
          setFirstLaunch(false);
          return;
        }
        const legacy = await AsyncStorage.getItem('hasLaunched');
        if (legacy === 'true') {
          try {
            await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
          } catch {}
          setFirstLaunch(false);
          return;
        }
        setFirstLaunch(true);
      } catch (error) {
        logException(error, { context: 'checkFirstLaunch' });
        setFirstLaunch(true);
      }
    })();

    loadModels();
  }, [loadModels, hydrateSettings, hydrateThreads, hydrateImages]);

  useEffect(() => {
    (async () => {
      try {
        const scheduled = await notifee.getTriggerNotifications();
        const staleIds = scheduled
          .map(item => item?.notification?.id)
          .filter(
            id =>
              typeof id === 'string' &&
              id.startsWith(REMOVED_DAILY_REWARD_NOTIFICATION_PREFIX)
          );

        if (staleIds.length > 0) {
          await Promise.all(staleIds.map(id => notifee.cancelNotification(id)));
        }
      } catch {}

      try {
        await AsyncStorage.removeItem(REMOVED_DAILY_REWARD_CACHE_KEY);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const unsub = notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type !== EventType.PRESS) return;

      const data = detail?.notification?.data;
      const route = data?.route;
      if (!route || isRemovedRewardsRoute(route)) return;

      if (navigationReady) {
        navigate(route);
      } else {
        await setPendingNotificationNav({ route, ts: Date.now() });
      }
    });

    return () => unsub();
  }, [navigationReady]);

  useEffect(() => {
    (async () => {
      try {
        const initial = await notifee.getInitialNotification();
        const data = initial?.notification?.data;
        const route = data?.route;

        if (route && !isRemovedRewardsRoute(route)) {
          await setPendingNotificationNav({ route, ts: Date.now() });
        }
      } catch {
        // ignore initial notification errors
      }
    })();
  }, []);

  useEffect(() => {
    if (!navigationReady) return;

    (async () => {
      const pending = await consumePendingNotificationNav();
      if (pending?.route && !isRemovedRewardsRoute(pending.route)) {
        navigate(pending.route);
      }
    })();
  }, [navigationReady]);

  const bootReady =
    settingsHydrated &&
    threadsHydrated &&
    imagesHydrated &&
    deviceIdReady &&
    modelsLoaded;

  const handleOnboardingComplete = useCallback(async () => {
    try {
      const now = String(Date.now());
      await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
      await AsyncStorage.setItem(ONE_TIME_OFFER_KEY, now);
    } catch {}
    setFirstLaunch(false);
    setPendingPostOnboardingPaywall(true);
  }, []);

  useEffect(() => {
    if (!pendingPostOnboardingPaywall || !navigationReady || firstLaunch) return;

    navigate('PaywallScreen', {
      returnTo: 'Chat',
      showOneTimeOfferAfterClose: true,
      firstLaunchPaywall: true,
    });

    setPendingPostOnboardingPaywall(false);
  }, [pendingPostOnboardingPaywall, navigationReady, firstLaunch]);

  if (firstLaunch === null) return null;

  if (firstLaunch && deviceIdReady) {
    return (
      <GlobalErrorBoundary>
        <SafeAreaProvider>
          <SubscriptionProvider>
            <KeyboardProvider statusBarTranslucent>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <OfflineBanner />
                <IntroductionAnimationScreen onComplete={handleOnboardingComplete} />
              </GestureHandlerRootView>
            </KeyboardProvider>
          </SubscriptionProvider>
        </SafeAreaProvider>
      </GlobalErrorBoundary>
    );
  }

  if (!bootReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <GlobalErrorBoundary>
      <SafeAreaProvider>
        <SubscriptionProvider>
          <KeyboardProvider statusBarTranslucent>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <OfflineBanner />
              <DrawerNavigator onNavigationReady={setNavigationReady} />
            </GestureHandlerRootView>
          </KeyboardProvider>
        </SubscriptionProvider>
      </SafeAreaProvider>
    </GlobalErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// App.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
import {
  STARTUP_TASK_TIMEOUT_MS,
  runStartupTask,
} from './src/lib/startupTimeout';
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

const REMOVED_REWARDS_ROUTE_NAMES = new Set(['Rewards', 'RewardsHome', 'RewardsList']);
const REMOVED_DAILY_REWARD_CACHE_KEY = 'notifee_daily_reward_schedule_v2';
const REMOVED_DAILY_REWARD_NOTIFICATION_PREFIX = 'daily_reward_';

function isRemovedRewardsRoute(route) {
  return typeof route === 'string' && REMOVED_REWARDS_ROUTE_NAMES.has(route);
}

function logStartupFailure(error, details) {
  const status = details?.timedOut ? 'timed out' : 'failed';
  console.warn(
    `[startup] ${details?.context || 'initialization'} ${status}:`,
    error?.message || String(error),
  );
  logException(error, { ...details, startup: true });
}

function StartupLoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FFFFFF" />
    </View>
  );
}

export default function App() {
  const hydrateSettings = useSettingsStore(s => s.hydrate);
  const setModels = useSettingsStore(s => s.setModels);

  const hydrateThreads = useThreadsStore(s => s.hydrate);

  const hydrateImages = useImagesStore(s => s.hydrate);

  const [firstLaunch, setFirstLaunch] = useState(null);
  const [navigationReady, setNavigationReady] = useState(false);
  const [initialLaunchScreen, setInitialLaunchScreen] = useState(null);
  const [initialLaunchParams, setInitialLaunchParams] = useState(null);

  useEffect(() => {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      ).catch(() => {});
    }
  }, []);

  const loadModels = useCallback(async () => {
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected && netInfo.isInternetReachable !== true) {
      throw new Error('NETWORK_ERROR');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      STARTUP_TASK_TIMEOUT_MS,
    );
    try {
      const response = await fetch(MODELS_URL, {
        headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(
          `Failed to load models: ${response.status} ${response.statusText}`,
        );
      }

      const json = await response.json();
      const modelsData = json?.models || json;
      if (modelsData && typeof modelsData === 'object') {
        setModels(modelsData);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }, [setModels]);

  useEffect(() => {
    let mounted = true;
    runStartupTask(
      async () => {
        const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
        if (completed === 'true') return false;

        const legacy = await AsyncStorage.getItem('hasLaunched');
        if (legacy === 'true') {
          await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
          return false;
        }
        return true;
      },
      { label: 'checkFirstLaunch', onError: logStartupFailure },
    ).then(isFirstLaunch => {
      if (mounted) {
        setFirstLaunch(
          typeof isFirstLaunch === 'boolean' ? isFirstLaunch : true,
        );
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    runStartupTask(() => ensureDeviceId(), {
      label: 'ensureDeviceId',
      onError: logStartupFailure,
    });
    runStartupTask(() => hydrateSettings(), {
      label: 'hydrateSettings',
      onError: logStartupFailure,
    });
    runStartupTask(() => hydrateThreads(), {
      label: 'hydrateThreads',
      onError: logStartupFailure,
    });
    runStartupTask(() => hydrateImages(), {
      label: 'hydrateImages',
      onError: logStartupFailure,
    });
    runStartupTask(() => UsageTrackingService.initializeFirstLaunch(), {
      label: 'initializeFirstLaunchTracking',
      onError: logStartupFailure,
    });
    runStartupTask(() => loadModels(), {
      label: 'loadModels',
      onError: logStartupFailure,
    });
  }, [hydrateSettings, hydrateThreads, hydrateImages, loadModels]);

  useEffect(() => {
    runStartupTask(
      async () => {
        const scheduled = await notifee.getTriggerNotifications();
        const staleIds = scheduled
          .map(item => item?.notification?.id)
          .filter(
            id =>
              typeof id === 'string' &&
              id.startsWith(REMOVED_DAILY_REWARD_NOTIFICATION_PREFIX),
          );

        if (staleIds.length > 0) {
          await Promise.all(staleIds.map(id => notifee.cancelNotification(id)));
        }

        await AsyncStorage.removeItem(REMOVED_DAILY_REWARD_CACHE_KEY);
      },
      { label: 'cleanupRemovedNotifications', onError: logStartupFailure },
    );
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
    runStartupTask(
      async () => {
        const initial = await notifee.getInitialNotification();
        const data = initial?.notification?.data;
        const route = data?.route;

        if (route && !isRemovedRewardsRoute(route)) {
          await setPendingNotificationNav({ route, ts: Date.now() });
        }
      },
      { label: 'getInitialNotification', onError: logStartupFailure },
    );
  }, []);

  useEffect(() => {
    if (!navigationReady) return;

    runStartupTask(
      async () => {
        const pending = await consumePendingNotificationNav();
        if (pending?.route && !isRemovedRewardsRoute(pending.route)) {
          navigate(pending.route);
        }
      },
      { label: 'consumePendingNotificationNav', onError: logStartupFailure },
    );
  }, [navigationReady]);

  const handleOnboardingComplete = useCallback(() => {
    setInitialLaunchScreen('PaywallScreen');
    setInitialLaunchParams({
      returnTo: 'Chat',
      showOneTimeOfferAfterClose: true,
      firstLaunchPaywall: true,
    });
    setFirstLaunch(false);

    runStartupTask(
      async () => {
        await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
        await AsyncStorage.setItem(ONE_TIME_OFFER_KEY, String(Date.now()));
      },
      { label: 'persistOnboardingComplete', onError: logStartupFailure },
    );
  }, []);

  if (firstLaunch === null) return <StartupLoadingScreen />;

  if (firstLaunch) {
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

  return (
    <GlobalErrorBoundary>
      <SafeAreaProvider>
        <SubscriptionProvider>
          <KeyboardProvider statusBarTranslucent>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <OfflineBanner />
              <DrawerNavigator
                onNavigationReady={setNavigationReady}
                initialLaunchScreen={initialLaunchScreen}
                initialLaunchParams={initialLaunchParams}
              />
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

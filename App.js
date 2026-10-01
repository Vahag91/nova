// App.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  Animated,
  AppState,
  View,
  Platform,
  InteractionManager,
  NativeModules,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import notifee, { EventType, AuthorizationStatus } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useSettingsStore } from './src/state/useSettingsStore';
import { useImagesStore } from './src/state/useImagesStore';
import { useThreadsStore } from './src/state/useThreadsStore';
import StartupLoadingScreen from './src/screens/StartupLoadingScreen';
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
import {
  ONBOARDING_KEY,
  ONE_TIME_OFFER_KEY,
  NOTIFICATION_PRIMING_KEY,
} from './src/constants/storageKeys';
import { PIXEL_PAYWALL_ENABLED, REWARDS_ENABLED } from './src/constants/featureFlags';
import {
  consumePendingNotificationNav,
  setPendingNotificationNav,
} from './src/notifications/notificationNavQueue';
import { useTranslation } from 'react-i18next';
import * as RNLocalize from 'react-native-localize';
import { useRewardsStore } from './src/state/useRewardsStore';
import {
  scheduleDailyRewardReminders,
  cancelTodayDailyRewardReminder,
} from './src/notifications/dailyRewardNotifications';
import { isDailyLoginCompletedToday } from './src/notifications/rewardReminderHelpers';
import NotificationPrimingModal from './src/components/NotificationPrimingModal';
import DailyCheckInModal from './src/components/rewards/DailyCheckInModal';

const CHECK_IN_SHOWN_KEY = '@dailyCheckInShownOn';
const STARTUP_FADE_MS = 180;

function releaseNativeStartupSplash() {
  if (Platform.OS !== 'android') return;
  try {
    NativeModules.StartupSplash?.markReady?.();
  } catch {
    // The native gate has its own bounded fail-safe; startup must never throw.
  }
}

let StableDrawerNavigatorComponent;
let IntroductionAnimationScreenComponent;
let StandalonePremiumPaywallScreenComponent;

function getStableDrawerNavigator() {
  if (!StableDrawerNavigatorComponent) {
    const DrawerNavigator = require('./src/navigation/DrawerNavigator').default;
    StableDrawerNavigatorComponent = React.memo(DrawerNavigator);
  }
  return StableDrawerNavigatorComponent;
}

function DeferredDrawerNavigator(props) {
  const Component = getStableDrawerNavigator();
  return <Component {...props} />;
}

function DeferredIntroductionAnimationScreen(props) {
  if (!IntroductionAnimationScreenComponent) {
    IntroductionAnimationScreenComponent =
      require('./src/screens/IntroductionAnimationScreen').default;
  }
  const Component = IntroductionAnimationScreenComponent;
  return <Component {...props} />;
}

function DeferredStandalonePremiumPaywallScreen(props) {
  if (!StandalonePremiumPaywallScreenComponent) {
    StandalonePremiumPaywallScreenComponent =
      require('./src/components/PremiumPaywallScreen')
        .StandalonePremiumPaywallScreen;
  }
  const Component = StandalonePremiumPaywallScreenComponent;
  return <Component {...props} />;
}

function logStartupFailure(error, details) {
  const status = details?.timedOut ? 'timed out' : 'failed';
  console.warn(
    `[startup] ${details?.context || 'initialization'} ${status}:`,
    error?.message || String(error),
  );
  logException(error, { ...details, startup: true });
}

export default function App() {
  const hydrateSettings = useSettingsStore(s => s.hydrate);
  const setModels = useSettingsStore(s => s.setModels);

  const hydrateImages = useImagesStore(s => s.hydrate);
  const hydrateThreadBodies = useThreadsStore(s => s.hydrateThreadBodies);

  const { t, i18n } = useTranslation();
  const rewardsHydrated = useRewardsStore(s => s.hydrated);
  const recordRewardActivity = useRewardsStore(s => s.recordActivity);
  const rewardsCurrentStreak = useRewardsStore(s => s.currentStreak);

  const [primingVisible, setPrimingVisible] = useState(false);
  const [checkInVisible, setCheckInVisible] = useState(false);
  const [checkInClaimed, setCheckInClaimed] = useState(false);
  const [checkInAmount, setCheckInAmount] = useState(0);
  const [notificationChoiceMade, setNotificationChoiceMade] = useState(false);
  const [firstLaunch, setFirstLaunch] = useState(null);
  const [startupPresentationComplete, setStartupPresentationComplete] =
    useState(false);
  const [startupContentReady, setStartupContentReady] = useState(false);
  const [launchSurfaceReady, setLaunchSurfaceReady] = useState(false);
  const [mainAppReady, setMainAppReady] = useState(false);
  const [startupOverlayVisible, setStartupOverlayVisible] = useState(true);
  const [initialPaywallRequested, setInitialPaywallRequested] = useState(false);
  const [initialPaywallVisible, setInitialPaywallVisible] = useState(false);
  const [initialPaywallPresented, setInitialPaywallPresented] = useState(false);
  const [paywallSurfacePresented, setPaywallSurfacePresented] = useState(false);
  const [navigationReady, setNavigationReady] = useState(false);
  const [initialLaunchScreen, setInitialLaunchScreen] = useState(null);
  const [initialLaunchParams, setInitialLaunchParams] = useState(null);
  const startupContentFrameRef = React.useRef(null);
  const startupOverlayOpacity = React.useRef(new Animated.Value(1)).current;
  const initialNotificationCheckedRef = React.useRef(false);
  const onboardingCompletedThisSessionRef = React.useRef(false);
  const shouldMountMainApp =
    firstLaunch === false || initialPaywallPresented;
  const shouldStartBackgroundTasks =
    mainAppReady && (firstLaunch === false || initialPaywallPresented);
  // Start RevenueCat while first-launch onboarding is visible so offerings are
  // normally cached before the paywall opens. This remains non-blocking: the
  // onboarding UI never waits for Billing or network work.
  const subscriptionNetworkReady =
    firstLaunch === true ||
    initialPaywallRequested ||
    initialLaunchScreen === 'PaywallScreen' ||
    (firstLaunch === false && mainAppReady);
  const initialSurfaceReady = firstLaunch === true
    ? launchSurfaceReady
    : mainAppReady;
  const startupRevealReady =
    firstLaunch !== null &&
    startupPresentationComplete &&
    startupContentReady &&
    initialSurfaceReady;

  useEffect(() => {
    return () => {
      if (startupContentFrameRef.current !== null) {
        cancelAnimationFrame(startupContentFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!startupOverlayVisible || !startupRevealReady) return undefined;

    const animation = Animated.timing(startupOverlayOpacity, {
      toValue: 0,
      duration: STARTUP_FADE_MS,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) setStartupOverlayVisible(false);
    });

    return () => animation.stop();
  }, [startupOverlayOpacity, startupOverlayVisible, startupRevealReady]);

  useEffect(() => {
    if (!initialPaywallRequested || initialPaywallVisible) return undefined;
    setInitialPaywallVisible(true);
    return undefined;
  }, [initialPaywallRequested, initialPaywallVisible]);

  useEffect(() => {
    if (
      initialPaywallVisible &&
      paywallSurfacePresented
    ) {
      setInitialPaywallPresented(true);
    }
  }, [initialPaywallVisible, paywallSurfacePresented]);

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
    runStartupTask(() => hydrateSettings(), {
      label: 'hydrateSettings',
      onError: logStartupFailure,
    });
  }, [hydrateSettings]);

  useEffect(() => {
    let mounted = true;
    runStartupTask(
      async () => {
        const entries = await AsyncStorage.multiGet([
          ONBOARDING_KEY,
          'hasLaunched',
        ]);
        const values = Object.fromEntries(entries);
        if (__DEV__) return true; // TEMP: preview onboarding
        const completed = values[ONBOARDING_KEY];
        if (completed === 'true') return false;

        const legacy = values.hasLaunched;
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
    if (!shouldStartBackgroundTasks) return undefined;

    // Let the first useful screen paint before starting cache hydration and
    // network work that is not required to decide the initial route.
    const timeoutIds = [];
    const task = InteractionManager.runAfterInteractions(() => {
      const schedule = (delayMs, label, work) => {
        timeoutIds.push(setTimeout(() => {
          runStartupTask(() => work(), { label, onError: logStartupFailure });
        }, delayMs));
      };

      schedule(
        0,
        'initializeFirstLaunchTracking',
        UsageTrackingService.initializeFirstLaunch,
      );
      schedule(450, 'loadModels', loadModels);
      schedule(850, 'hydrateThreadBodies', hydrateThreadBodies);
      schedule(1400, 'hydrateImages', hydrateImages);
    });

    return () => {
      task.cancel();
      timeoutIds.forEach(clearTimeout);
    };
  }, [
    shouldStartBackgroundTasks,
    hydrateImages,
    hydrateThreadBodies,
    loadModels,
  ]);

  // Android grants exactly one system prompt, and a denial is permanent. Ask in
  // our own modal first so the system prompt is only spent on a willing user.
  useEffect(() => {
    if (firstLaunch !== false || !mainAppReady || notificationChoiceMade) {
      return undefined;
    }
    if (!REWARDS_ENABLED) {
      setNotificationChoiceMade(true);
      return undefined;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      runStartupTask(
        async () => {
          const settings = await notifee.getNotificationSettings();
          if (settings?.authorizationStatus === AuthorizationStatus.AUTHORIZED) {
            setNotificationChoiceMade(true);
            return;
          }

          const alreadyAsked = await AsyncStorage.getItem(
            NOTIFICATION_PRIMING_KEY,
          );
          if (alreadyAsked === 'true') {
            setNotificationChoiceMade(true);
            return;
          }

          setPrimingVisible(true);
        },
        { label: 'notificationPriming', onError: logStartupFailure },
      );
    });

    return () => task.cancel();
  }, [firstLaunch, mainAppReady, notificationChoiceMade]);

  const rememberNotificationChoice = useCallback(async () => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_PRIMING_KEY, 'true');
    } catch {
      // A failed write only means we may prime again next launch.
    }
  }, []);

  const handleEnableNotifications = useCallback(async () => {
    setPrimingVisible(false);
    try {
      await notifee.requestPermission();
    } catch (error) {
      logStartupFailure(error, { context: 'requestNotificationPermission' });
    }
    await rememberNotificationChoice();
    setNotificationChoiceMade(true);
  }, [rememberNotificationChoice]);

  const handleSkipNotifications = useCallback(async () => {
    setPrimingVisible(false);
    await rememberNotificationChoice();
    setNotificationChoiceMade(true);
  }, [rememberNotificationChoice]);

  // Surface the daily reward on the main screen. Buried in the drawer almost
  // nobody found it, and the claim used to happen silently on launch.
  useEffect(() => {
    if (
      !REWARDS_ENABLED ||
      firstLaunch !== false ||
      !mainAppReady ||
      !navigationReady ||
      !rewardsHydrated ||
      !notificationChoiceMade ||
      checkInVisible
    ) {
      return undefined;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      runStartupTask(
        async () => {
          const quests = useRewardsStore.getState().quests;
          if (isDailyLoginCompletedToday(quests)) return;

          // One prompt per day: dismissing must not re-open it on every
          // foreground, but tomorrow it should come back.
          const todayKey = new Date().toDateString();
          const lastShown = await AsyncStorage.getItem(CHECK_IN_SHOWN_KEY);
          if (lastShown === todayKey) return;

          await AsyncStorage.setItem(CHECK_IN_SHOWN_KEY, todayKey);
          setCheckInClaimed(false);
          setCheckInAmount(0);
          setCheckInVisible(true);
        },
        { label: 'dailyCheckInPrompt', onError: logStartupFailure },
      );
    });

    return () => task.cancel();
  }, [
    firstLaunch,
    mainAppReady,
    navigationReady,
    rewardsHydrated,
    notificationChoiceMade,
    checkInVisible,
  ]);

  const handleCheckIn = useCallback(() => {
    const before = useRewardsStore.getState().points;
    try {
      recordRewardActivity();
      cancelTodayDailyRewardReminder();
    } catch (error) {
      logStartupFailure(error, { context: 'dailyCheckIn' });
    }
    const after = useRewardsStore.getState().points;
    setCheckInAmount(Math.max(0, after - before));
    setCheckInClaimed(true);
  }, [recordRewardActivity]);

  const handleCheckInClose = useCallback(() => {
    setCheckInVisible(false);
  }, []);

  // Daily reward reminders (22:00 local), locale/timezone aware.
  // Deferred behind the startup gates so it never competes with first paint.
  useEffect(() => {
    if (
      !REWARDS_ENABLED ||
      firstLaunch !== false ||
      !mainAppReady ||
      !rewardsHydrated ||
      !notificationChoiceMade
    ) {
      return undefined;
    }

    let cancelled = false;

    const sync = async ({ force = false } = {}) => {
      if (cancelled) return;

      const latestQuests = useRewardsStore.getState().quests;

      const lang =
        i18n?.language || RNLocalize.getLocales?.()?.[0]?.languageTag || 'unknown';
      const timeZone = RNLocalize.getTimeZone?.() || 'unknown';

      await scheduleDailyRewardReminders({
        daysAhead: 30,
        hour: 22,
        minute: 0,
        title: t('push.dailyReward.title', { defaultValue: 'Daily reward' }),
        body: t('push.dailyReward.body', {
          defaultValue: 'Don’t miss your daily coins — claim before midnight.',
        }),
        lang,
        timeZone,
        force,
        route: 'Rewards',
      });

      if (isDailyLoginCompletedToday(latestQuests)) {
        await cancelTodayDailyRewardReminder();
      }
    };

    const task = InteractionManager.runAfterInteractions(() => {
      runStartupTask(sync, {
        label: 'scheduleDailyRewardReminders',
        onError: logStartupFailure,
      });
    });

    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        sync().catch(e => logStartupFailure(e, { context: 'dailyRewardSyncActive' }));
      }
    });

    const onLocalizeChange = () => {
      sync({ force: true }).catch(e =>
        logStartupFailure(e, { context: 'dailyRewardSyncLocale' }),
      );
    };
    RNLocalize.addEventListener?.('change', onLocalizeChange);

    return () => {
      cancelled = true;
      task.cancel();
      appStateSub.remove();
      RNLocalize.removeEventListener?.('change', onLocalizeChange);
    };
  }, [
    firstLaunch,
    mainAppReady,
    rewardsHydrated,
    notificationChoiceMade,
    recordRewardActivity,
    t,
    i18n?.language,
  ]);

  useEffect(() => {
    const unsub = notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type !== EventType.PRESS) return;

      const data = detail?.notification?.data;
      const route = data?.route;
      if (!route) return;

      if (navigationReady) {
        navigate(route);
      } else {
        await setPendingNotificationNav({ route, ts: Date.now() });
      }
    });

    return () => unsub();
  }, [navigationReady]);

  useEffect(() => {
    if (
      firstLaunch !== false ||
      !mainAppReady ||
      !navigationReady ||
      initialNotificationCheckedRef.current
    ) return undefined;
    initialNotificationCheckedRef.current = true;
    const task = InteractionManager.runAfterInteractions(() => {
      runStartupTask(
        async () => {
          const initial = await notifee.getInitialNotification();
          const data = initial?.notification?.data;
          const route = data?.route;

          if (route) {
            navigate(route);
          }
        },
        { label: 'getInitialNotification', onError: logStartupFailure },
      );
    });

    return () => task.cancel();
  }, [firstLaunch, mainAppReady, navigationReady]);

  useEffect(() => {
    if (!navigationReady || !mainAppReady) return;

    runStartupTask(
      async () => {
        const pending = await consumePendingNotificationNav();
        if (pending?.route) {
          navigate(pending.route);
        }
      },
      { label: 'consumePendingNotificationNav', onError: logStartupFailure },
    );
  }, [mainAppReady, navigationReady]);

  useEffect(() => {
    if (
      firstLaunch !== false ||
      !mainAppReady ||
      !navigationReady ||
      !onboardingCompletedThisSessionRef.current
    ) {
      return undefined;
    }

    // Preserve the onboarding review opportunity, but move native review UI
    // off the transition/paywall path so it cannot stall those animations.
    onboardingCompletedThisSessionRef.current = false;
    let interactionTask;
    const timeoutId = setTimeout(() => {
      interactionTask = InteractionManager.runAfterInteractions(() => {
        const RateUsService = require('./src/services/RateUsService').default;
        RateUsService.canShowRatePrompt()
          .then(result => {
            if (result?.canShow) return RateUsService.showRatePrompt();
            return undefined;
          })
          .catch(() => {});
      });
    }, 1500);

    return () => {
      clearTimeout(timeoutId);
      interactionTask?.cancel?.();
    };
  }, [firstLaunch, mainAppReady, navigationReady]);

  const handleOnboardingComplete = useCallback(() => {
    onboardingCompletedThisSessionRef.current = true;
    setInitialPaywallPresented(false);
    setPaywallSurfacePresented(false);

    if (PIXEL_PAYWALL_ENABLED) {
      setInitialPaywallRequested(true);
      setInitialPaywallVisible(true);
    } else {
      // Keep the original navigator-hosted paywall as a complete one-switch
      // fallback, including the first-launch path.
      setInitialLaunchScreen('PaywallScreen');
      setInitialLaunchParams({
        returnTo: 'Chat',
        showOneTimeOfferAfterClose: true,
        firstLaunchPaywall: true,
      });
      setFirstLaunch(false);
    }

    runStartupTask(
      async () => {
        await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
        await AsyncStorage.setItem(ONE_TIME_OFFER_KEY, String(Date.now()));
      },
      { label: 'persistOnboardingComplete', onError: logStartupFailure },
    );
  }, []);

  const handleStartupPresentationReady = useCallback(() => {
    setStartupPresentationComplete(true);
  }, []);

  const handleFatalRenderError = useCallback(() => {
    releaseNativeStartupSplash();
    startupOverlayOpacity.stopAnimation();
    startupOverlayOpacity.setValue(0);
    setStartupOverlayVisible(false);
  }, [startupOverlayOpacity]);

  const handleLaunchSurfaceReady = useCallback(() => {
    releaseNativeStartupSplash();
    setLaunchSurfaceReady(true);
  }, []);

  const handleMainAppReady = useCallback(() => {
    releaseNativeStartupSplash();
    setMainAppReady(true);
  }, []);

  const handleNavigationReady = useCallback(ready => {
    setNavigationReady(ready);
  }, []);

  const handleStartupContentLayout = useCallback(() => {
    if (startupContentReady || startupContentFrameRef.current !== null) return;

    // Keep the loader above the app until the destination wrapper has survived
    // two display frames. Destination-specific readiness is gated separately.
    startupContentFrameRef.current = requestAnimationFrame(() => {
      startupContentFrameRef.current = requestAnimationFrame(() => {
        startupContentFrameRef.current = null;
        setStartupContentReady(true);
      });
    });
  }, [startupContentReady]);

  const handlePaywallSurfacePresented = useCallback(() => {
    setPaywallSurfacePresented(true);
  }, []);

  const handleInitialPaywallExit = useCallback(result => {
    setInitialPaywallRequested(false);
    setInitialPaywallVisible(false);
    setInitialPaywallPresented(false);
    setPaywallSurfacePresented(false);
    setInitialLaunchScreen(
      result?.showOneTimeOffer ? 'OneTimeOfferScreen' : null,
    );
    setInitialLaunchParams(null);
    setFirstLaunch(false);
    return true;
  }, []);

  return (
    <View style={styles.appRoot}>
      {/* Keep the final inset mode active from React's very first frame. */}
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      {firstLaunch !== null ? (
        <View style={styles.appRoot} onLayout={handleStartupContentLayout}>
          <GlobalErrorBoundary onCatch={handleFatalRenderError}>
            <SafeAreaProvider>
              <SubscriptionProvider
                deferNetworkWork={!subscriptionNetworkReady}
                prefetchDuringOnboarding={firstLaunch === true}>
                <KeyboardProvider statusBarTranslucent>
                  <GestureHandlerRootView style={styles.appRoot}>
                    <OfflineBanner />
                    {REWARDS_ENABLED ? (
                      <>
                        <NotificationPrimingModal
                          visible={primingVisible}
                          onEnable={handleEnableNotifications}
                          onSkip={handleSkipNotifications}
                        />
                        <DailyCheckInModal
                          visible={checkInVisible}
                          currentStreak={rewardsCurrentStreak}
                          claimed={checkInClaimed}
                          claimedAmount={checkInAmount}
                          onCheckIn={handleCheckIn}
                          onClose={handleCheckInClose}
                        />
                      </>
                    ) : null}
                    {shouldMountMainApp ? (
                      <DeferredDrawerNavigator
                        onInitialScreenReady={handleMainAppReady}
                        onNavigationReady={handleNavigationReady}
                        initialLaunchScreen={initialLaunchScreen}
                        initialLaunchParams={initialLaunchParams}
                      />
                    ) : null}
                    {firstLaunch &&
                    (!initialPaywallVisible || !initialPaywallPresented) ? (
                      <View style={styles.fullscreenOverlay}>
                        <DeferredIntroductionAnimationScreen
                          onComplete={handleOnboardingComplete}
                          onReady={handleLaunchSurfaceReady}
                        />
                      </View>
                    ) : null}
                    {initialPaywallVisible ? (
                      <View style={styles.paywallOverlay}>
                          <DeferredStandalonePremiumPaywallScreen
                            onExit={handleInitialPaywallExit}
                            onPresented={handlePaywallSurfacePresented}
                          routeParams={{
                            returnTo: 'Chat',
                            showOneTimeOfferAfterClose: true,
                            firstLaunchPaywall: true,
                          }}
                        />
                      </View>
                    ) : null}
                  </GestureHandlerRootView>
                </KeyboardProvider>
              </SubscriptionProvider>
            </SafeAreaProvider>
          </GlobalErrorBoundary>
        </View>
      ) : null}

      {startupOverlayVisible ? (
        <Animated.View
          pointerEvents="auto"
          style={[styles.startupOverlay, { opacity: startupOverlayOpacity }]}>
          <StartupLoadingScreen onReady={handleStartupPresentationReady} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  startupOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  fullscreenOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: '#0A0A0A',
  },
  paywallOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: 'transparent',
  },
});

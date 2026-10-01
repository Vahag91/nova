import { IMAGE_STUDIO_ENABLED, REWARDS_ENABLED } from '../constants/featureFlags';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  TouchableOpacity,
  Text,
  View,
  Image,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
  Dimensions,
  FlatList,
} from 'react-native';
import Haptic from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  Easing,
} from 'react-native-reanimated';

import ModelSelector from '../components/ModelSelector';
import SvgIcon from '../components/SvgIcon';
import AndroidNavigationMenu from './AndroidNavigationMenu';
import { AndroidNavigationMenuProvider, useAndroidNavigationMenu } from './AndroidNavigationMenuContext';
import { useThreadsStore } from '../state/useThreadsStore';
import { useSettingsStore } from '../state/useSettingsStore';
import { colors } from '../styles/colors';
import { useTranslation } from 'react-i18next';
import { PRESETS, PRESET_AVATARS } from '../data/presets';
import { DEFAULT_CHAT_MODEL } from '../config/models';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionAccessContext } from '../context/SubscriptionContext';
import {
  navigationRef,
  isNavigationReadyRef,
  ROOT_DRAWER_ROUTE,
  ROOT_DRAWER_SCREEN_NAMES,
} from './rootNavigation';
import { ONE_TIME_OFFER_KEY } from '../constants/storageKeys';
import {
  ONE_TIME_OFFER_PAYWALL_ENABLED,
  PIXEL_PAYWALL_ENABLED,
} from '../constants/featureFlags';

const Drawer = createDrawerNavigator();
const RootStack = createNativeStackNavigator();

const getChatScreen = () => require('../screens/Chat').default;
const getHistoryScreen = () => require('../screens/HistorySimple').default;
const getAssistantsScreen = () => require('../screens/Assistants').default;
const getSettingsScreen = () => require('../screens/Settings.jsx').default;
const getStudioHomeScreen = () => require('../screens/StudioHome.jsx').default;
const getCreateImageScreen = () => require('../screens/CreateImage.jsx').default;
const getEditImageScreen = () => require('../screens/EditImage.jsx').default;
const getOneTimeOfferScreen = () =>
  require('../screens/OneTimeOfferScreen').default;
const getLaunchScreenPreview = () =>
  require('../screens/LaunchScreenPreview').default;
const getRewardsStack = () => require('./RewardsStack').default;

function getActivePaywallScreen() {
  return PIXEL_PAYWALL_ENABLED
    ? require('../components/PremiumPaywallScreen').default
    : require('../components/PaywallScreen').default;
}

function normalizeAndroidMenuRoute(routeName) {
  if (!routeName) return 'Chat';

  if (['Studio', 'CreateImage', 'EditImage'].includes(routeName)) {
    return 'Studio';
  }

  // Rewards is a nested stack, so getCurrentRoute() reports the inner screen.
  if (['RewardsHome', 'RewardsList'].includes(routeName)) {
    return 'Rewards';
  }

  return routeName;
}

function isSameDay(timestampA, timestampB) {
  if (!timestampA || !timestampB) return false;
  const a = new Date(timestampA);
  const b = new Date(timestampB);
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function AndroidMenuButton() {
  const { openMenu } = useAndroidNavigationMenu();

  return (
    <TouchableOpacity
      style={[styles.headerButton, styles.headerButtonNeutral]}
      activeOpacity={0.85}
      onPress={openMenu}
    >
      <SvgIcon name="menu" size={24} color={colors.text} />
    </TouchableOpacity>
  );
}

// Header center component for model dropdown or assistant switcher
function ChatHeaderCenter() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const activeThread = useThreadsStore(
    useCallback(
      s => (s.activeThreadId ? s.threadsById?.[s.activeThreadId] || null : null),
      []
    )
  );
  const isPrivate = useThreadsStore(s => s.privateActive);
  const createThread = useThreadsStore(s => s.createThread);
  const updateThread = useThreadsStore(s => s.updateThread);
  const setActiveThread = useThreadsStore(s => s.setActiveThread);
  // no longer inject system message into messages; use thread.system

  const [sheetOpen, setSheetOpen] = useState(false);

  const systemText = activeThread?.system || activeThread?.messages?.find(m => m.role === 'system')?.content;

  const preset = useMemo(() => {
    if (!systemText) return null;
    return PRESETS.find(p => p.system === systemText) || null;
  }, [systemText]);

  const isAssistantChat = !!(systemText && !isPrivate && preset);

  const assistants = useMemo(
    () => isAssistantChat
      ? PRESETS.map(p => ({
          id: p.id,
          name: t(`assistants.presets.${p.id}.name`, { defaultValue: p.name }),
          desc: t(`assistants.presets.${p.id}.description`, { defaultValue: p.description }),
          avatar: p.avatar,
          system: p.system,
          suggestedModel: p.suggestedModel,
        }))
      : [],
    [isAssistantChat, t]
  );
  const currentPresetId = preset?.id || null;

  const triggerScale = useSharedValue(1);
  const rotateArrow = useSharedValue(0);

  const triggerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: triggerScale.value }],
  }));
  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateArrow.value * 180}deg` }],
  }));
  const openSheet = useCallback(() => {
    try { Haptic.trigger('selection'); } catch {}
    triggerScale.value = withSequence(
      withTiming(0.96, { duration: 90, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 12, stiffness: 280 })
    );
    setSheetOpen(true);
    rotateArrow.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [rotateArrow, triggerScale]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    rotateArrow.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) });
  }, [rotateArrow]);

  const handleSelectAssistant = useCallback((choice) => {
    closeSheet();
    if (!choice || choice.system === systemText) return;
    try { Haptic.trigger('impactLight'); } catch {}

    try {
      const modelKey = choice?.suggestedModel || DEFAULT_CHAT_MODEL;
      const title = t(`assistants.presets.${choice.id}.name`, { defaultValue: choice.name });
      const sys = typeof choice.system === 'string' ? choice.system : '';
      const nextThread = createThread({ title, model: modelKey, system: sys });
      try {
        updateThread(nextThread.id, {
          meta: {
            ...(nextThread.meta || {}),
            pinnedModel: true,
            presetId: choice?.id || null,
            assistantName: title,
          }
        });
      } catch {}
      setActiveThread(nextThread.id);
      navigation.navigate('Chat');
    } catch (error) {
      Alert.alert(
        t('assistants.errorTitle'),
        t('assistants.errorMessage'),
      );
    }
  }, [closeSheet, systemText, createThread, updateThread, setActiveThread, navigation, t]);

  const listRef = useRef(null);

  useEffect(() => {
    if (!sheetOpen || !isAssistantChat) return;
    if (!currentPresetId) return;
    const idx = assistants.findIndex(item => item.id === currentPresetId);
    if (idx >= 0) {
      const timer = setTimeout(() => {
        listRef.current?.scrollToIndex({
          index: idx,
          animated: false,
          viewPosition: 0.5,
        });
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [sheetOpen, assistants, currentPresetId, isAssistantChat]);

  useEffect(() => {
    if (!isAssistantChat && sheetOpen) {
      setSheetOpen(false);
      rotateArrow.value = 0;
    }
  }, [isAssistantChat, sheetOpen, rotateArrow]);

  const renderItem = useCallback(({ item }) => {
    const selected = item.id === currentPresetId;
    return (
      <View>
        <Pressable
          onPress={() => handleSelectAssistant(item)}
          android_ripple={{ color: '#1A1A1D' }}
          style={({ pressed }) => [
            styles.sheetRow,
            selected && styles.sheetRowSelected,
            pressed && styles.sheetRowPressed,
          ]}
        >
          <Image source={item.avatar} style={styles.sheetRowAvatar} />
          <View style={styles.sheetRowText}>
            <Text numberOfLines={1} style={[styles.sheetRowTitle, selected && styles.sheetRowTitleSelected]}>
              {item.name}
            </Text>
            <Text numberOfLines={2} style={[styles.sheetRowDesc, selected && styles.sheetRowDescSelected]}>
              {item.desc}
            </Text>
          </View>
          {selected ? <SvgIcon name="check" size={18} color={colors.primary} /> : null}
        </Pressable>
      </View>
    );
  }, [currentPresetId, handleSelectAssistant]);

  const keyExtractor = useCallback(item => item.id, []);

  // Offline indicator state is declared unconditionally so hooks order stays stable
  const [isOffline, setIsOffline] = useState(false);
  const offlineOpacity = useSharedValue(0);
  const offlineScale = useSharedValue(0.8);

  useEffect(() => {
    if (!isAssistantChat) {
      setIsOffline(false);
      offlineOpacity.value = 0;
      offlineScale.value = 0.8;
      return undefined;
    }

    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !(state.isConnected && state.isInternetReachable);
      setIsOffline(offline);
      
      if (offline) {
        offlineOpacity.value = withTiming(1, { duration: 300 });
        offlineScale.value = withSequence(
          withTiming(1.2, { duration: 200 }),
          withTiming(1, { duration: 200 })
        );
      } else {
        offlineOpacity.value = withTiming(0, { duration: 300 });
      }
    });

    return () => unsubscribe();
  }, [isAssistantChat, offlineOpacity, offlineScale]);

  const offlineStyle = useAnimatedStyle(() => ({
    opacity: offlineOpacity.value,
    transform: [{ scale: offlineScale.value }],
  }));

  if (!isAssistantChat) {
    return <ModelSelector />;
  }

  const assistantPhoto = preset?.avatar || PRESET_AVATARS[0];
  const translatedName = currentPresetId
    ? t(`assistants.presets.${currentPresetId}.name`, { defaultValue: preset?.name })
    : null;
  const displayName = translatedName || activeThread?.title || t('assistants.defaultTitle');

  return (
    <>
      <Animated.View style={triggerStyle}>
        <Pressable
          style={styles.headerPill}
          onPress={openSheet}
          accessibilityRole="button"
          accessibilityLabel={displayName}
          accessibilityHint={t('assistants.selectAssistantHint')}
        >
          <Image source={assistantPhoto} style={styles.headerPillAvatar} resizeMode="cover" />
          <Text style={styles.headerPillText} numberOfLines={1} ellipsizeMode="tail">
            {displayName || (activeThread?.title || t('assistants.defaultTitle'))}
          </Text>
          {isOffline && (
            <Animated.View style={[styles.offlineIndicator, offlineStyle]}>
              <View style={styles.offlineDot} />
            </Animated.View>
          )}
          <Animated.View style={[styles.headerPillChevronWrap, arrowStyle]}>
            <SvgIcon name="chevron-down" size={18} color={colors.textSecondary} />
          </Animated.View>
        </Pressable>
      </Animated.View>

      <Modal
        transparent
        visible={sheetOpen}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeSheet}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
        </View>

        <View
          style={[
            styles.sheetPanel,
            {
              marginTop: insets.top + 56,
              maxHeight: Math.min(Dimensions.get('window').height * 0.7, 468),
            },
          ]}
          accessibilityViewIsModal
          importantForAccessibility="yes"
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t('assistants.selectAssistant', { defaultValue: 'Choose assistant' })}</Text>
            <Pressable hitSlop={10} onPress={closeSheet} accessibilityLabel={t('modelSelector.closeLabel')}>
              <Text style={styles.sheetClose}>✕</Text>
            </Pressable>
          </View>
          <FlatList
            ref={listRef}
            data={assistants}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sheetListContent}
            keyboardShouldPersistTaps="handled"
            getItemLayout={(_, index) => ({
              length: 74,
              offset: 74 * index,
              index,
            })}
            onScrollToIndexFailed={({ index }) => {
              requestAnimationFrame(() => {
                listRef.current?.scrollToOffset({
                  offset: Math.max(0, 74 * index),
                  animated: true,
                });
              });
            }}
            removeClippedSubviews={false}
          />
        </View>
      </Modal>
    </>
  );
}

// Header right component for private chat button
function ChatHeaderRight() {
  const { t } = useTranslation();
  const isPrivate = useThreadsStore(s => s.privateActive);
  const startPrivate = useThreadsStore(s => s.startPrivate);
  const endPrivate = useThreadsStore.getState().endPrivate;
  const model = useSettingsStore(s => s.model);

  const handlePrivateChat = () => {
    if (isPrivate) {
      endPrivate();
    } else {
      startPrivate(model, t('chat.privateTitle'));
    }
  };

  return (
    <TouchableOpacity
      style={[styles.headerButton, isPrivate ? styles.headerButtonActive : styles.headerButtonNeutral]}
      onPress={handlePrivateChat}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={
        isPrivate ? t('chat.endPrivateChat') : t('chat.startPrivateChat')
      }
    >
      <SvgIcon
        name="lock"
        size={24}
        color={isPrivate ? '#FFFFFF' : colors.text}
      />
    </TouchableOpacity>
  );
}

// Header right component for new chat button
function HistoryHeaderRight({ navigation }) {
  const { t } = useTranslation();
  const createThread = useThreadsStore(s => s.createThread);
  const setActiveThread = useThreadsStore(s => s.setActiveThread);

  const handleNewChat = () => {
    Haptic.trigger('impactLight');
    const th = createThread({ title: t('history.newChat') });
    setActiveThread(th.id);
    navigation?.navigate?.('Chat');
  };

  return (
    <TouchableOpacity
      style={styles.historyNewChatButton}
      onPress={handleNewChat}
      activeOpacity={0.85}
    >
      <SvgIcon name="newchat" size={24} color={colors.text} />
    </TouchableOpacity>
  );
}

function PaywallRouteScreen({ navigation, route }) {
  const ActivePaywallScreen = getActivePaywallScreen();
  const returnTo = route?.params?.returnTo;

  const goBackSafe = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    if (returnTo) {
      if (ROOT_DRAWER_SCREEN_NAMES.has(returnTo)) {
        navigation.replace(ROOT_DRAWER_ROUTE, { screen: returnTo });
      } else {
        navigation.replace(returnTo);
      }
      return;
    }

    navigation.replace(ROOT_DRAWER_ROUTE, { screen: 'Chat' });
  }, [navigation, returnTo]);

  return (
    <ActivePaywallScreen
      onClose={goBackSafe}
      onRestore={() => {}}
    />
  );
}

function MainDrawerNavigator() {
  const { t } = useTranslation();
  
  return (
    <Drawer.Navigator
      initialRouteName="Chat"
      drawerContent={() => null}
      screenOptions={{
        lazy: true,
        headerLeft: () => <AndroidMenuButton />,
        headerStyle: {
          backgroundColor: '#000000',
          borderBottomWidth: 0,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          color: colors.text,
          fontFamily: 'Lato-Bold',
        },
        drawerStyle: {
          backgroundColor: colors.background,
          width: 280,
        },
        drawerActiveTintColor: colors.accent,
        drawerInactiveTintColor: colors.textSecondary,
        drawerType: 'back',
        swipeEnabled: false,
        swipeEdgeWidth: 50,
      }}
    >
      <Drawer.Screen
        name="Chat"
        getComponent={getChatScreen}
        options={{
          headerTitle: () => <ChatHeaderCenter />,
          headerRight: () => <ChatHeaderRight />,
          headerLeft: () => <AndroidMenuButton />,
        }}
      />
      <Drawer.Screen
        name="History"
        getComponent={getHistoryScreen}
        options={({ navigation }) => ({
          headerTitle: t('navigation.history'),
          headerRight: () => <HistoryHeaderRight navigation={navigation} />,
        })}
      />
      <Drawer.Screen name="Assistants" getComponent={getAssistantsScreen} options={{ title: t('navigation.assistants') }} />
      {REWARDS_ENABLED ? (
        <Drawer.Screen
          name="Rewards"
          getComponent={getRewardsStack}
          options={{
            headerShown: false,
            title: t('navigation.rewards'),
          }}
        />
      ) : null}
      <Drawer.Screen
        name="Settings"
        getComponent={getSettingsScreen}
        options={{
          title: t('navigation.settings'),
          headerTitleStyle: {
            color: colors.text,
            fontFamily: 'Lato-Black',
            fontSize: 24,
          },
        }}
      />
      {IMAGE_STUDIO_ENABLED ? (
        <Drawer.Screen
          name="Studio"
          getComponent={getStudioHomeScreen}
          options={{
            headerShown: false,
            title: t('navigation.imagesStudio') || 'Image Studio',
          }}
        />
      ) : null}
    </Drawer.Navigator>
  );
}

export default function DrawerNavigator({
  onInitialScreenReady,
  onNavigationReady,
  initialLaunchScreen = null,
  initialLaunchParams = undefined,
}) {
  const subscription = useContext(SubscriptionAccessContext);
  const isPremium = !!subscription?.isPremium;
  const subscriptionReady = !!subscription?.subscriptionReady;
  const threadsHydrated = useThreadsStore(s => s.hydrated);
  const hydrateThreads = useThreadsStore(s => s.hydrate);
  const [navReady, setNavReady] = useState(false);
  const [oneTimeOfferChecked, setOneTimeOfferChecked] = useState(!ONE_TIME_OFFER_PAYWALL_ENABLED);
  const [currentRouteName, setCurrentRouteName] = useState(null);
  const [androidMenuVisible, setAndroidMenuVisible] = useState(false);
  const initialScreenReadyReportedRef = useRef(false);
  const currentMenuRoute = useMemo(
    () => normalizeAndroidMenuRoute(currentRouteName),
    [currentRouteName]
  );

  useEffect(() => {
    const paywallIsCoveringStartup =
      initialLaunchScreen === 'PaywallScreen' &&
      (!navReady || currentRouteName === 'PaywallScreen');
    if (paywallIsCoveringStartup) {
      return;
    }
    if (!threadsHydrated) {
      hydrateThreads();
    }
  }, [
    currentRouteName,
    hydrateThreads,
    initialLaunchScreen,
    navReady,
    threadsHydrated,
  ]);

  useEffect(() => {
    if (!ONE_TIME_OFFER_PAYWALL_ENABLED) return;
    if (!navReady || !subscriptionReady || isPremium || oneTimeOfferChecked) return;
    const blockedRoutes = new Set(['PaywallScreen', 'OneTimeOfferScreen']);
    if (blockedRoutes.has(currentRouteName)) return;
    let cancelled = false;
    (async () => {
      try {
        const last = await AsyncStorage.getItem(ONE_TIME_OFFER_KEY);
        const now = Date.now();
        const lastTs = last ? Number(last) : 0;
        const shouldShow = !lastTs || !isSameDay(lastTs, now);

        if (shouldShow && navigationRef?.isReady()) {
          navigationRef.navigate('OneTimeOfferScreen');
          await AsyncStorage.setItem(ONE_TIME_OFFER_KEY, String(now));
        }
      } catch (error) {
        // Silent fail
      } finally {
        if (!cancelled) {
          setOneTimeOfferChecked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navReady, isPremium, subscriptionReady, oneTimeOfferChecked, currentRouteName]);

  const openAndroidMenu = useCallback(() => {
    if (androidMenuVisible) {
      return;
    }
    setAndroidMenuVisible(true);
  }, [androidMenuVisible]);

  const closeAndroidMenu = useCallback((reason = 'dismiss') => {
    if (!androidMenuVisible) {
      return;
    }
    setAndroidMenuVisible(false);
  }, [androidMenuVisible]);

  const reportInitialScreenReady = useCallback(() => {
    if (initialScreenReadyReportedRef.current) return;
    initialScreenReadyReportedRef.current = true;
    onInitialScreenReady?.();
  }, [onInitialScreenReady]);

  const dispatchAndroidMenuNavigation = useCallback((routeName, params) => {
    if (!navigationRef?.isReady?.()) {
      return;
    }

    if (
      routeName === 'PaywallScreen' ||
      routeName === 'OneTimeOfferScreen' ||
      routeName === 'LaunchScreenPreview'
    ) {
      navigationRef.navigate(routeName, params);
      return;
    }

    const nestedParams = params
      ? { screen: routeName, params }
      : { screen: routeName };
    navigationRef.navigate(ROOT_DRAWER_ROUTE, nestedParams);
  }, []);

  const handleAndroidMenuNavigate = useCallback((routeName, params) => {
    const currentLeafRoute = navigationRef.getCurrentRoute()?.name || currentRouteName;
    const activeRoute = normalizeAndroidMenuRoute(currentLeafRoute);
    const isStudioDetailRoute =
      currentLeafRoute === 'CreateImage' || currentLeafRoute === 'EditImage';

    if (!navigationRef?.isReady?.()) {
      closeAndroidMenu('navigate');
      return;
    }

    if (routeName === activeRoute && !(routeName === 'Studio' && isStudioDetailRoute)) {
      closeAndroidMenu('navigate_skipped');
      return;
    }

    closeAndroidMenu('navigate');
    requestAnimationFrame(() => {
      dispatchAndroidMenuNavigation(routeName, params);
    });
  }, [closeAndroidMenu, currentRouteName, dispatchAndroidMenuNavigation]);

  const handleAndroidMenuNavigateThread = useCallback((threadId) => {
    if (!navigationRef?.isReady?.()) {
      closeAndroidMenu('navigate_thread');
      return;
    }

    const { setActiveThread } = useThreadsStore.getState();
    setActiveThread(threadId);
    closeAndroidMenu('navigate_thread');
    requestAnimationFrame(() => {
      if (navigationRef?.isReady?.()) {
        navigationRef.navigate(ROOT_DRAWER_ROUTE, { screen: 'Chat' });
      }
    });
  }, [closeAndroidMenu]);

  const androidMenuContextValue = useMemo(() => ({
    openMenu: openAndroidMenu,
    closeMenu: closeAndroidMenu,
    reportScreenReady: reportInitialScreenReady,
    isAvailable: true,
  }), [closeAndroidMenu, openAndroidMenu, reportInitialScreenReady]);

  return (
    <AndroidNavigationMenuProvider value={androidMenuContextValue}>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          isNavigationReadyRef.current = true;
          setNavReady(true);
          const routeName = navigationRef.getCurrentRoute()?.name || null;
          setCurrentRouteName(routeName);
          onNavigationReady?.(true);
        }}
        onStateChange={() => {
          const routeName = navigationRef.getCurrentRoute()?.name || null;
          setCurrentRouteName(routeName);
        }}
      >
        <RootStack.Navigator
          initialRouteName={initialLaunchScreen || ROOT_DRAWER_ROUTE}
          screenOptions={{
            headerShown: false,
            animation: 'default',
            contentStyle: {
              backgroundColor: '#0A0A0A',
            },
          }}
        >
          <RootStack.Screen name={ROOT_DRAWER_ROUTE} component={MainDrawerNavigator} />
          {IMAGE_STUDIO_ENABLED ? (
            <>
              <RootStack.Screen
                name="CreateImage"
                getComponent={getCreateImageScreen}
                options={{
                  animation: 'slide_from_right',
                  presentation: 'card',
                }}
              />
              <RootStack.Screen
                name="EditImage"
                getComponent={getEditImageScreen}
                options={{
                  animation: 'slide_from_right',
                  presentation: 'card',
                }}
              />
            </>
          ) : null}
          <RootStack.Screen
            name="PaywallScreen"
            component={PaywallRouteScreen}
            options={{
              // PremiumPaywallScreen owns its native-driver transition. A
              // second stack fade doubles full-screen compositing and makes
              // dismissals look like a flip on slower devices.
              animation: 'none',
              presentation: 'transparentModal',
              contentStyle: {
                backgroundColor: 'transparent',
              },
            }}
            initialParams={
              initialLaunchScreen === 'PaywallScreen' ? initialLaunchParams : undefined
            }
          />
          <RootStack.Screen
            name="OneTimeOfferScreen"
            getComponent={getOneTimeOfferScreen}
            options={{
              animation: 'fade_from_bottom',
              presentation: 'transparentModal',
            }}
          />
          <RootStack.Screen
            name="LaunchScreenPreview"
            getComponent={getLaunchScreenPreview}
            options={{
              animation: 'slide_from_right',
              presentation: 'card',
            }}
          />
        </RootStack.Navigator>
      </NavigationContainer>
      <AndroidNavigationMenu
        visible={androidMenuVisible}
        activeRouteName={currentMenuRoute}
        onClose={closeAndroidMenu}
        onNavigate={handleAndroidMenuNavigate}
        onNavigateThread={handleAndroidMenuNavigateThread}
      />
    </AndroidNavigationMenuProvider>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    height: 40,
    minWidth: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    flexDirection: 'row',
    elevation: 3,
  },
  headerButtonNeutral: {
    backgroundColor: colors.surface,
  },
  headerButtonActive: {
    backgroundColor: colors.primary,
  },
  headerPill: {
    height: 40,
    maxWidth: 220,
    flexShrink: 1,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
  },
  headerPillAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    borderWidth: 2,
    borderColor: colors.primary + '20',
  },
  headerPillText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    fontFamily: 'Lato-SemiBold',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  headerPillChevronWrap: {
    marginLeft: 6,
  },
  offlineIndicator: {
    marginLeft: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetPanel: {
    alignSelf: 'center',
    width: '90%',
    maxWidth: 308,
    backgroundColor: '#0D0D0F',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 29,
    shadowOpacity: 0.32,
    elevation: 22,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 11,
    backgroundColor: '#0D0D0F',
  },
  sheetTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.2,
    fontFamily: 'Lato-Bold',
  },
  sheetClose: {
    fontSize: 16,
    color: colors.text,
  },
  sheetListContent: {
    paddingBottom: 14,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 11,
    paddingVertical: 11,
    backgroundColor: 'transparent',
    marginHorizontal: 5,
    marginVertical: 3,
    borderRadius: 11,
  },
  sheetRowPressed: {
    backgroundColor: '#1A1A1D',
    transform: [{ scale: 0.98 }],
  },
  sheetRowSelected: {
    backgroundColor: '#1A1A1D',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 7,
    shadowOpacity: 0.1,
    elevation: 4,
  },
  sheetRowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  sheetRowText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  sheetRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    fontFamily: 'Lato-SemiBold',
  },
  sheetRowTitleSelected: {
    color: colors.primary,
  },
  sheetRowDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: 'Lato-Regular',
  },
  sheetRowDescSelected: {
    color: colors.text,
  },
  historyNewChatButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
});

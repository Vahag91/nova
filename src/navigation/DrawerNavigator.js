import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import {
  TouchableOpacity,
  Text,
  View,
  Image,
  StyleSheet,
  Platform,
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
  runOnJS,
  FadeInDown,
} from 'react-native-reanimated';

import Chat from '../screens/Chat';
import History from '../screens/HistorySimple';
import Assistants from '../screens/Assistants';
import Settings from '../screens/Settings.jsx';
import RewardsStack from './RewardsStack';
import RewardsHeader from '../components/rewards/Header';
import StudioStack from './StudioStack';
import PaywallScreen from '../components/PaywallScreen';
import OneTimeOfferScreen from '../screens/OneTimeOfferScreen';
import ModelSelector from '../components/ModelSelector';
import SvgIcon from '../components/SvgIcon';
import CustomDrawerContent from './CustomDrawerContent';
import { useThreadsStore } from '../state/useThreadsStore';
import { useSettingsStore } from '../state/useSettingsStore';
import { colors } from '../styles/colors';
import { useTranslation } from 'react-i18next';
import { PRESETS, PRESET_AVATARS } from '../data/presets';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionContext } from '../context/SubscriptionContext';
import { navigationRef, isNavigationReadyRef } from './rootNavigation';
import { ONE_TIME_OFFER_KEY } from '../constants/storageKeys';
import { ONE_TIME_OFFER_PAYWALL_ENABLED } from '../constants/featureFlags';

const Drawer = createDrawerNavigator();

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

// Header center component for model dropdown or assistant switcher
function ChatHeaderCenter() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const threads = useThreadsStore(s => s.threads);
  const activeThreadId = useThreadsStore(s => s.activeThreadId);
  const isPrivate = useThreadsStore(s => s.privateActive);
  const createThread = useThreadsStore(s => s.createThread);
  const updateThread = useThreadsStore(s => s.updateThread);
  const setActiveThread = useThreadsStore(s => s.setActiveThread);
  // no longer inject system message into messages; use thread.system
  const currentModel = useSettingsStore(s => s.model);

  const [sheetOpen, setSheetOpen] = useState(false);

  const activeThread = useMemo(
    () => threads.find(t => t.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  const systemText = activeThread?.system || activeThread?.messages?.find(m => m.role === 'system')?.content;

  const preset = useMemo(() => {
    if (!systemText) return null;
    return PRESETS.find(p => p.system === systemText) || null;
  }, [systemText]);

  const isAssistantChat = !!(systemText && !isPrivate && preset);

  const assistants = useMemo(
    () => PRESETS.map(p => ({
      id: p.id,
      name: t(`assistants.presets.${p.id}.name`, { defaultValue: p.name }),
      desc: t(`assistants.presets.${p.id}.description`, { defaultValue: p.description }),
      avatar: p.avatar,
      system: p.system,
      suggestedModel: p.suggestedModel,
    })),
    [t]
  );

  const triggerScale = useSharedValue(1);
  const rotateArrow = useSharedValue(0);
  const overlayProgress = useSharedValue(0);
  const dropY = useSharedValue(-36);
  const sheetScale = useSharedValue(0.985);
  const sheetOpacity = useSharedValue(0);

  const triggerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: triggerScale.value }],
  }));
  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateArrow.value * 180}deg` }],
  }));
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayProgress.value,
  }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dropY.value }, { scale: sheetScale.value }],
    opacity: sheetOpacity.value,
  }));

  const openSheet = useCallback(() => {
    try { Haptic.trigger('selection'); } catch {}
    triggerScale.value = withSequence(
      withTiming(0.96, { duration: 90, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 12, stiffness: 280 })
    );
    setSheetOpen(true);
    overlayProgress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    dropY.value = withSpring(0, { damping: 14, stiffness: 160, mass: 0.9 });
    sheetScale.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    sheetOpacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
    rotateArrow.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [dropY, overlayProgress, rotateArrow, sheetOpacity, sheetScale, triggerScale]);

  const closeSheet = useCallback(() => {
    overlayProgress.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(setSheetOpen)(false);
    });
    dropY.value = withTiming(-36, { duration: 200, easing: Easing.in(Easing.cubic) });
    sheetScale.value = withTiming(0.985, { duration: 200, easing: Easing.in(Easing.cubic) });
    sheetOpacity.value = withTiming(0, { duration: 160, easing: Easing.in(Easing.cubic) });
    rotateArrow.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) });
  }, [dropY, overlayProgress, rotateArrow, sheetOpacity, sheetScale]);

  const handleSelectAssistant = useCallback((choice) => {
    closeSheet();
    if (!choice || choice.system === systemText) return;
    try { Haptic.trigger('impactLight'); } catch {}

    try {
      // App policy: assistants always use GPT-5 nano and are pinned to it
      const modelKey = 'gpt-5-nano';
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
        t('assistants.errorTitle') || 'Something went wrong',
        t('assistants.errorMessage') || 'Could not start this assistant.'
      );
    }
  }, [closeSheet, systemText, currentModel, createThread, setActiveThread, navigation, t]);

  const listRef = useRef(null);

  useEffect(() => {
    if (!sheetOpen || !isAssistantChat) return;
    if (!currentPresetId) return;
    const idx = assistants.findIndex(item => item.id === currentPresetId);
    if (idx >= 0) {
      const timer = setTimeout(() => {
        listRef.current?.scrollToIndex({
          index: idx,
          animated: true,
          viewPosition: 0.5,
        });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [sheetOpen, assistants, currentPresetId, isAssistantChat]);

  useEffect(() => {
    if (!isAssistantChat && sheetOpen) {
      setSheetOpen(false);
      overlayProgress.value = 0;
      sheetOpacity.value = 0;
      rotateArrow.value = 0;
    }
  }, [isAssistantChat, sheetOpen, overlayProgress, rotateArrow, sheetOpacity]);

  const currentPresetId = preset?.id || null;

  const renderItem = useCallback(({ item, index }) => {
    const selected = item.id === currentPresetId;
    return (
      <Animated.View entering={FadeInDown.delay(index * 30).duration(200)}>
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
      </Animated.View>
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
  const displayName = translatedName || activeThread?.title || t('assistants.defaultTitle', 'Assistant');

  return (
    <>
      <Animated.View style={triggerStyle}>
        <Pressable
          style={styles.headerPill}
          onPress={openSheet}
          accessibilityRole="button"
          accessibilityLabel={displayName}
          accessibilityHint={t('assistants.selectAssistantHint', 'Open assistant picker')}
        >
          <Image source={assistantPhoto} style={styles.headerPillAvatar} resizeMode="cover" />
          <Text style={styles.headerPillText} numberOfLines={1} ellipsizeMode="tail">
            {displayName || (activeThread?.title || t('assistants.defaultTitle', 'Assistant'))}
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
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeSheet}
      >
        <Animated.View style={[styles.sheetOverlay, overlayStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetPanel,
            {
              marginTop: insets.top + 56,
              maxHeight: Math.min(Dimensions.get('window').height * 0.7, 468),
            },
            panelStyle,
          ]}
          accessibilityRole="dialog"
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
          />
        </Animated.View>
      </Modal>
    </>
  );
}

// Header right component for private chat button
function ChatHeaderRight() {
  const isPrivate = useThreadsStore(s => s.privateActive);
  const startPrivate = useThreadsStore(s => s.startPrivate);
  const endPrivate = useThreadsStore.getState().endPrivate;
  const model = useSettingsStore(s => s.model);

  const handlePrivateChat = () => {
    if (isPrivate) {
      endPrivate();
    } else {
      startPrivate(model);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.headerButton, isPrivate ? styles.headerButtonActive : styles.headerButtonNeutral]}
      onPress={handlePrivateChat}
      activeOpacity={0.85}
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

export default function DrawerNavigator({ onNavigationReady }) {
  const { t } = useTranslation();
  const subscription = useContext(SubscriptionContext);
  const isPremium = !!subscription?.isPremium;
  const subscriptionReady = !!subscription?.subscriptionReady;
  const [navReady, setNavReady] = useState(false);
  const [oneTimeOfferChecked, setOneTimeOfferChecked] = useState(!ONE_TIME_OFFER_PAYWALL_ENABLED);
  const [currentRouteName, setCurrentRouteName] = useState(null);

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

  return (
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
      <Drawer.Navigator
        initialRouteName="Chat"
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
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
          drawerType: 'slide',
          swipeEnabled: true,
          swipeEdgeWidth: 50,
        }}
      >
        <Drawer.Screen
          name="Chat"
          component={Chat}
          options={({ navigation }) => ({
            headerTitle: () => <ChatHeaderCenter />,
            headerRight: () => <ChatHeaderRight />,
            headerLeft: () => (
              <TouchableOpacity
                style={[styles.headerButton, styles.headerButtonNeutral]}
                activeOpacity={0.85}
                onPress={() => navigation.toggleDrawer()}
              >
                <SvgIcon name="menu" size={24} color={colors.text} />
              </TouchableOpacity>
            ),
          })}
        />
        <Drawer.Screen
          name="History"
          component={History}
          options={({ navigation }) => ({
            headerTitle: t('navigation.history'),
            headerRight: () => <HistoryHeaderRight navigation={navigation} />,
          })}
        />
        <Drawer.Screen
          name="Rewards"
          component={RewardsStack}
          options={{
            headerShown: false,
            title: 'Rewards',
            drawerItemStyle: { display: 'flex' },
          }}
        />
        <Drawer.Screen name="Assistants" component={Assistants} options={{ title: t('navigation.assistants') }} />
        <Drawer.Screen
          name="Settings"
          component={Settings}
          options={{
            title: t('navigation.settings'),
            headerTitleStyle: {
              color: colors.text,
              fontFamily: 'Lato-Black',
              fontSize: 24,
            },
          }}
        />
        <Drawer.Screen
          name="Studio"
          component={StudioStack}
          options={{
            headerShown: false,
            title: t('navigation.imagesStudio') || 'Image Studio',
          }}
        />
        {/** Create/Edit are children of Studio stack; no drawer entries */}
        <Drawer.Screen
          name="PaywallScreen"
          component={({ navigation, route }) => {
            const returnTo = route?.params?.returnTo;
            const goBackSafe = () => {
              if (returnTo) {
                navigation.navigate(returnTo);
              } else if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('Chat');
              }
            };
            return (
              <PaywallScreen
                onClose={goBackSafe}
                onRestore={() => {}}
                onContinue={goBackSafe}
              />
            );
          }}
          options={{
            headerShown: false,
            title: 'Paywall',
            drawerItemStyle: { display: 'none' },
            swipeEnabled: false,
          }}
        />
        <Drawer.Screen
          name="OneTimeOfferScreen"
          component={OneTimeOfferScreen}
          options={{
            headerShown: false,
            title: 'One-Time Offer',
            drawerItemStyle: { display: 'none' },
            swipeEnabled: false,
          }}
        />
      </Drawer.Navigator>
    </NavigationContainer>
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
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
    shadowOpacity: Platform.OS === 'ios' ? 0.28 : 0.32,
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

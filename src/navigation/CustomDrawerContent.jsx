import React, { useCallback, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { DrawerContentScrollView, useDrawerStatus } from '@react-navigation/drawer';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import Haptic from 'react-native-haptic-feedback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SvgIcon from '../components/SvgIcon';
import { colors } from '../styles/colors';
import { useThreadsStore } from '../state/useThreadsStore';
import { useSettingsStore } from '../state/useSettingsStore';
import { useTranslation } from 'react-i18next';
import { betterPreview, firstUserPreview, summaryPreview } from '../lib/format';
import SidebarCreativeStudioBanner from '../components/navigation/SidebarCreativeStudioBanner';
import SidebarProFeaturesButton from '../components/navigation/SidebarProFeaturesButton';
import { SubscriptionContext } from '../context/SubscriptionContext';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function CustomDrawerContent(props) {
  const { state, navigation } = props;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const isCompactHeight = screenHeight <= 700;
  const isVeryCompactHeight = screenHeight <= 620;
  const activeRoute = state.routeNames[state.index];
  const drawerOpen = useDrawerStatus() === 'open';
  const [drawerOpenTick, setDrawerOpenTick] = React.useState(0);
  const prevDrawerState = React.useRef(drawerOpen);
  
  // Thread store
  const threads = useThreadsStore(s => s.threads);
  const activeThreadId = useThreadsStore(s => s.activeThreadId);
  const createThread = useThreadsStore(s => s.createThread);
  const setActiveThread = useThreadsStore(s => s.setActiveThread);
  const model = useSettingsStore(s => s.model);

  // Animation values
  const isOpen = useSharedValue(0);
  const logoPulse = useSharedValue(0);
  const initialRecentChatsExpanded = !isVeryCompactHeight;
  const [recentChatsExpanded, setRecentChatsExpanded] = React.useState(initialRecentChatsExpanded);
  const recentChatsHeight = useSharedValue(initialRecentChatsExpanded ? 1 : 0);
  const chevronRotation = useSharedValue(initialRecentChatsExpanded ? 0 : 180);
  const subscription = useContext(SubscriptionContext);
  const isPremium = !!subscription?.isPremium;
  const reviewerPremiumEnabled = !!subscription?.reviewerPremiumEnabled;
  const activateReviewerPremium = subscription?.activateReviewerPremium;
  const deactivateReviewerPremium = subscription?.deactivateReviewerPremium;
  const baseMenuItemCount = 5;
  const menuIconSize = isCompactHeight ? 18 : 20;
  const drawerPaddingHorizontal = isCompactHeight ? 16 : 24;
  const drawerPaddingTop = isCompactHeight ? 8 : 12;
  const drawerPaddingBottom = isCompactHeight ? 14 : 20;
  const [reviewerPremiumModalVisible, setReviewerPremiumModalVisible] = React.useState(false);
  const [activatingReviewerPremium, setActivatingReviewerPremium] = React.useState(false);
  const reviewerTapCountRef = React.useRef(0);
  const lastVersionTapAtRef = React.useRef(0);

  const SPRING_CONFIG = {
    damping: 16,
    stiffness: 140,
    overshootClamping: true,
  };

  useEffect(() => {
    // Toggle animations whenever the drawer opens/closes
    isOpen.value = drawerOpen ? 1 : 0;
    if (drawerOpen && !prevDrawerState.current) {
      setDrawerOpenTick(tick => tick + 1);
    }
    prevDrawerState.current = drawerOpen;
  }, [drawerOpen]);

  useEffect(() => {
    // Logo pulse animation
    logoPulse.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, []);

  // Recent chats collapse animation
  React.useEffect(() => {
    recentChatsHeight.value = withTiming(recentChatsExpanded ? 1 : 0, {
      duration: 300,
      easing: Easing.inOut(Easing.ease),
    });
    chevronRotation.value = withTiming(recentChatsExpanded ? 0 : 180, {
      duration: 300,
      easing: Easing.inOut(Easing.ease),
    });
  }, [recentChatsExpanded]);

  const navigateTo = (routeName, params) => {
    if (routeName === 'PaywallScreen' && isPremium) {
      return;
    }
    Haptic.trigger('impactLight');
    
    // If navigating to Chat, create a new thread
    if (routeName === 'Chat') {
      const t = createThread({ title: 'New chat', model });
      setActiveThread(t.id);
    }
    
    if (routeName === 'Studio') {
      navigation.navigate('Studio', { screen: 'StudioHome' });
      return;
    }
    navigation.navigate(routeName, params);
  };

  const handleVersionPress = useCallback(() => {
    if (reviewerPremiumModalVisible) {
      return;
    }

    const now = Date.now();
    const withinSequence = now - lastVersionTapAtRef.current <= 1500;
    const nextTapCount = withinSequence ? reviewerTapCountRef.current + 1 : 1;

    reviewerTapCountRef.current = Math.min(nextTapCount, 5);
    lastVersionTapAtRef.current = now;

    if (reviewerTapCountRef.current < 5) {
      return;
    }

    reviewerTapCountRef.current = 0;
    lastVersionTapAtRef.current = 0;
    setReviewerPremiumModalVisible(true);
  }, [reviewerPremiumModalVisible]);

  const handleToggleReviewerPremium = useCallback(async () => {
    const action = reviewerPremiumEnabled
      ? deactivateReviewerPremium
      : activateReviewerPremium;

    if (!action || activatingReviewerPremium) {
      return;
    }

    try {
      setActivatingReviewerPremium(true);
      await action();
      setReviewerPremiumModalVisible(false);
    } finally {
      setActivatingReviewerPremium(false);
    }
  }, [
    activateReviewerPremium,
    deactivateReviewerPremium,
    reviewerPremiumEnabled,
    activatingReviewerPremium,
  ]);

  const navigateToThread = (threadId) => {
    Haptic.trigger('impactLight');
    setActiveThread(threadId);
    navigation.navigate('Chat');
  };

  // Get recent threads (last 3, sorted by updatedAt)
  const recentThreads = React.useMemo(() => {
    const nonEmptyThreads = threads.filter(t => 
      Array.isArray(t?.messages) && t.messages.some(m => m.role === 'user' || m.role === 'assistant')
    );
    return [...nonEmptyThreads]
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 3);
  }, [threads]);

  // Logo animation - fade and slide when opening
  const logoAnimatedStyle = useAnimatedStyle(() => {
    const translateValue = isOpen.value === 1 ? 0 : -20;
    const opacityValue = isOpen.value === 1 ? 1 : 0.3;
    
    return {
      opacity: withTiming(opacityValue, { duration: 300 }),
      transform: [
        { translateX: withSpring(translateValue, SPRING_CONFIG) },
      ],
    };
  });

  const logoGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.5 + logoPulse.value * 0.3,
    shadowRadius: 15 + logoPulse.value * 10,
  }));

  // Menu item animations - fade and slide with stagger
  const getMenuItemStyle = (index) => {
    return useAnimatedStyle(() => {
      const delay = index * 60;
      const translateValue = isOpen.value === 1 ? 0 : -30;
      const opacityValue = isOpen.value === 1 ? 1 : 0.3;
      
      return {
        opacity: withDelay(delay, withTiming(opacityValue, { duration: 250 })),
        transform: [
          { translateX: withDelay(delay, withSpring(translateValue, SPRING_CONFIG)) },
        ],
      };
    });
  };

  const MenuItem = ({ icon, label, routeName, isActive, index }) => {
    const menuItemAnimStyle = getMenuItemStyle(index);
    const activeScale = useSharedValue(isActive ? 1 : 0);

    useEffect(() => {
      activeScale.value = withSpring(isActive ? 1 : 0, {
        damping: 15,
        stiffness: 150,
      });
    }, [isActive]);

    const activeIndicatorStyle = useAnimatedStyle(() => ({
      opacity: activeScale.value,
      transform: [{ scaleX: activeScale.value }],
    }));

    return (
      <AnimatedTouchable
        style={[
          styles.menuItem,
          isCompactHeight && styles.menuItemCompact,
          menuItemAnimStyle,
          isActive && styles.menuItemActive,
        ]}
        onPress={() => navigateTo(routeName)}
        activeOpacity={0.7}
      >
        {isActive && (
          <Animated.View style={[styles.activeIndicator, activeIndicatorStyle]} />
        )}
        <View style={[styles.iconContainer, isCompactHeight && styles.iconContainerCompact]}>
          <SvgIcon 
            name={icon} 
            size={menuIconSize} 
            color={isActive ? colors.text : colors.textSecondary} 
          />
        </View>
        <Text style={[
          styles.menuLabel,
          isCompactHeight && styles.menuLabelCompact,
          isActive && styles.menuLabelActive,
        ]}>
          {label}
        </Text>
      </AnimatedTouchable>
    );
  };

  const RecentChatItem = ({ thread, index }) => {
    const isActive = thread.id === activeThreadId;
    const chatItemAnimStyle = getMenuItemStyle(index + baseMenuItemCount); // Offset for main menu items

    // Get preview text from summary or recent messages
    const preview = React.useMemo(() => {
      const summaryText = thread.summary?.trim();
      const summaryBased = summaryText ? summaryPreview(summaryText) : '';
      const resolved = firstUserPreview(thread.messages) || summaryBased || betterPreview(thread.messages) || t('history.newChat');
      const text = resolved;
      return text.length > 40 ? `${text.slice(0, 39)}…` : text;
    }, [thread.summary, thread.messages, t]);

    return (
      <AnimatedTouchable
        style={[
          styles.recentChatItem,
          isCompactHeight && styles.recentChatItemCompact,
          chatItemAnimStyle,
          isActive && styles.recentChatItemActive,
        ]}
        onPress={() => navigateToThread(thread.id)}
        activeOpacity={0.7}
      >
        <Text 
          style={[
            styles.recentChatText,
            isCompactHeight && styles.recentChatTextCompact,
            isActive && styles.recentChatTextActive,
          ]} 
          numberOfLines={1}
        >
          {preview}
        </Text>
      </AnimatedTouchable>
    );
  };

  const recentThreadCount = recentThreads.length;
  const recentChatItemHeight = isCompactHeight ? 40 : 46;

  const recentChatsContainerStyle = useAnimatedStyle(() => {
    const progress = recentChatsHeight.value;
    const maxHeight = recentThreadCount * recentChatItemHeight;
    return {
      opacity: progress,
      maxHeight: progress * maxHeight,
      transform: [{ translateY: (1 - progress) * -10 }],
    };
  }, [recentThreadCount, recentChatItemHeight]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  const contentContainerStyle = React.useMemo(
    () => ({
      paddingTop: insets.top + drawerPaddingTop,
      paddingBottom: insets.bottom + drawerPaddingBottom,
      paddingHorizontal: drawerPaddingHorizontal,
    }),
    [
      insets.top,
      insets.bottom,
      drawerPaddingTop,
      drawerPaddingBottom,
      drawerPaddingHorizontal,
    ]
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#0a0a0f', '#000000']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View>
            {/* Logo Section */}
            <Animated.View
              style={[
                styles.logoSection,
                isCompactHeight && styles.logoSectionCompact,
                logoAnimatedStyle,
              ]}
            >
              <Animated.View
                style={[
                  styles.logoCircle,
                  isCompactHeight && styles.logoCircleCompact,
                  logoGlowStyle,
                ]}
              >
                <Image
              source={require('../../assets/icons/appiconsvg.png')}
              style={[styles.appIcon, isCompactHeight && styles.appIconCompact]}
              resizeMode="contain"
            />
              </Animated.View>
              <Text style={[styles.logoText, isCompactHeight && styles.logoTextCompact]}>
                ChatCloud
              </Text>
            </Animated.View>

            {recentThreads.length > 0 && (
              <View
                style={[
                  styles.recentChatsSection,
                  isCompactHeight && styles.recentChatsSectionCompact,
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.recentChatsHeader,
                    isCompactHeight && styles.recentChatsHeaderCompact,
                  ]}
                  onPress={() => setRecentChatsExpanded(!recentChatsExpanded)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.recentChatsTitle,
                      isCompactHeight && styles.recentChatsTitleCompact,
                    ]}
                  >
                    {t('navigation.recentChats')}
                  </Text>
                  <Animated.View style={chevronStyle}>
                    <Text style={styles.recentChatsChevron}>▼</Text>
                  </Animated.View>
                </TouchableOpacity>

                <Animated.View style={[styles.recentChatsList, recentChatsContainerStyle]}>
                  {recentThreads.map((thread, idx) => (
                    <RecentChatItem key={thread.id} thread={thread} index={idx} />
                  ))}
                </Animated.View>
              </View>
            )}

            <SidebarCreativeStudioBanner
              compact={isCompactHeight}
              onPress={() => navigateTo('Studio', { screen: 'StudioHome' })}
              style={[styles.sidebarBanner, isCompactHeight && styles.sidebarBannerCompact]}
              restartKey={drawerOpenTick}
            />

            <View style={[styles.mainNav, isCompactHeight && styles.mainNavCompact]}>
              <MenuItem
                icon="newchat"
                label={t('navigation.chat')}
                routeName="Chat"
                isActive={activeRoute === 'Chat'}
                index={0}
              />
              <MenuItem
                icon="layout"
                label={t('navigation.history')}
                routeName="History"
                isActive={activeRoute === 'History'}
                index={1}
              />
              <MenuItem
                icon="quill"
                label={t('navigation.assistants')}
                routeName="Assistants"
                isActive={activeRoute === 'Assistants'}
                index={2}
              />
              <MenuItem
                icon="studio"
                label={t('navigation.imagesStudio')}
                routeName="Studio"
                isActive={activeRoute === 'Studio'}
                index={3}
              />
              <MenuItem
                icon="settings"
                label={t('navigation.settings')}
                routeName="Settings"
                isActive={activeRoute === 'Settings'}
                index={4}
              />
              <TouchableOpacity
                style={styles.versionButton}
                onPress={handleVersionPress}
                activeOpacity={0.85}
              >
                <Text style={styles.versionLabel}>Version 1</Text>
              </TouchableOpacity>
            </View>
          </View>

          {!isPremium && (
            <View style={[styles.footerSection, isCompactHeight && styles.footerSectionCompact]}>
              <SidebarProFeaturesButton
                compact={isCompactHeight}
                onPress={() => navigateTo('PaywallScreen', { returnTo: activeRoute })}
              />
            </View>
          )}
        </View>
      </DrawerContentScrollView>

      <Modal
        transparent
        visible={reviewerPremiumModalVisible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setReviewerPremiumModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>
              {t('navigation.reviewerPremiumLabel', {
                defaultValue: 'Reviewer premium',
              })}
            </Text>
            <Text style={styles.modalTitle}>
              {reviewerPremiumEnabled
                ? t('navigation.reviewerPremiumDeactivateTitle', {
                    defaultValue: 'Deactivate reviewer premium',
                  })
                : t('navigation.reviewerPremiumTitle', {
                    defaultValue: 'Activate reviewer premium',
                  })}
            </Text>
            <Text style={styles.modalBody}>
              {reviewerPremiumEnabled
                ? t('navigation.reviewerPremiumActiveMessage', {
                    defaultValue: 'Deactivate premium preview',
                  })
                : t('navigation.reviewerPremiumMessage', {
                    defaultValue: 'Activate premium preview',
                  })}
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setReviewerPremiumModalVisible(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalButtonSecondaryText}>
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                ]}
                onPress={handleToggleReviewerPremium}
                disabled={activatingReviewerPremium}
                activeOpacity={0.9}
              >
                {activatingReviewerPremium ? (
                  <ActivityIndicator size="small" color="#08111F" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>
                    {reviewerPremiumEnabled
                      ? t('navigation.reviewerPremiumDeactivateCta', {
                          defaultValue: 'Deactivate',
                        })
                      : t('navigation.reviewerPremiumCta', {
                          defaultValue: 'Activate',
                        })}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
  },
  logoSectionCompact: {
    paddingTop: 2,
  },
  logoCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircleCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  appIcon: {
    width: 48,
    height: 48,
  },
  appIconCompact: {
    width: 42,
    height: 42,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginLeft: 6,
    letterSpacing: 2,
    fontFamily: 'Lato-Bold',
  },
  logoTextCompact: {
    fontSize: 20,
    letterSpacing: 1.4,
  },
  mainNav: {
    marginTop: 10,
  },
  mainNavCompact: {
    marginTop: 8,
  },
  versionButton: {
    alignSelf: 'flex-start',
    marginTop: 30,
    marginLeft: 18,
    paddingTop: 1,
    paddingBottom: 8,
    paddingRight: 10,
  },
  versionLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: 'rgba(203, 213, 225, 0.78)',
    fontFamily: 'Lato-Regular',
  },
  sidebarBanner: {
    marginTop: 8,
  },
  sidebarBannerCompact: {
    marginTop: 6,
  },
  footerSection: {
    paddingTop: 10,
  },
  footerSectionCompact: {
    paddingTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  menuItemCompact: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  menuItemActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.accent,
    borderRadius: 2,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconContainerCompact: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
    fontFamily: 'Lato-Regular',
  },
  menuLabelCompact: {
    fontSize: 14,
  },
  menuLabelActive: {
    color: colors.text,
    fontFamily: 'Lato-Bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 22,
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.16)',
  },
  modalEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#7DD3FC',
    fontFamily: 'Lato-Bold',
  },
  modalTitle: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: '800',
    color: '#F8FAFC',
    fontFamily: 'Lato-Bold',
  },
  modalBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(226, 232, 240, 0.82)',
    fontFamily: 'Lato-Regular',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  modalButtonPrimary: {
    backgroundColor: '#7DD3FC',
  },
  modalButtonSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalButtonPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#08111F',
    fontFamily: 'Lato-Bold',
  },
  modalButtonSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E2E8F0',
    fontFamily: 'Lato-Bold',
  },
  // Recent Chats Section
  recentChatsSection: {
    marginTop: 14,
  },
  recentChatsSectionCompact: {
    marginTop: 16,
  },
  recentChatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 0,
  },
  recentChatsHeaderCompact: {
    paddingVertical: 6,
    marginBottom: 6,
  },
  recentChatsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Lato-Bold',
  },
  recentChatsTitleCompact: {
    fontSize: 11,
  },
  recentChatsChevron: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  recentChatsList: {
    overflow: 'hidden',
    marginBottom: 8,
  },
  recentChatItem: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  recentChatItemCompact: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  recentChatItemActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  recentChatIndicator: {
    position: 'absolute',
    left: 8,
    top: '50%',
    marginTop: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  recentChatText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: 'Lato-Regular',
  },
  recentChatTextCompact: {
    fontSize: 12,
  },
  recentChatTextActive: {
    color: colors.text,
    fontFamily: 'Lato-Bold',
  },
});

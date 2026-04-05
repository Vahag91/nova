import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { DrawerContentScrollView, useDrawerStatus } from '@react-navigation/drawer';
import Haptic from 'react-native-haptic-feedback';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import SvgIcon from '../components/SvgIcon';
import SidebarCreativeStudioBanner from '../components/navigation/SidebarCreativeStudioBanner';
import SidebarProFeaturesButton from '../components/navigation/SidebarProFeaturesButton';
import { SubscriptionContext } from '../context/SubscriptionContext';
import { perfEnd, perfLog, perfStart } from '../lib/perfTrace';
import { useSettingsStore } from '../state/useSettingsStore';
import { useThreadsStore } from '../state/useThreadsStore';
import { colors } from '../styles/colors';

function AndroidDrawerMenuItem({ active, icon, label, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, active && styles.menuItemActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.iconContainer}>
        <SvgIcon
          name={icon}
          size={18}
          color={active ? colors.text : colors.textSecondary}
        />
      </View>
      <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function CustomDrawerContentAndroid(props) {
  const { state, navigation } = props;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const isCompactHeight = screenHeight <= 700;
  const isVeryCompactHeight = screenHeight <= 620;
  const activeRoute = state.routeNames[state.index];
  const drawerOpen = useDrawerStatus() === 'open';
  const [recentChatsExpanded, setRecentChatsExpanded] = useState(!isVeryCompactHeight);
  const [reviewerPremiumModalVisible, setReviewerPremiumModalVisible] = useState(false);
  const [activatingReviewerPremium, setActivatingReviewerPremium] = useState(false);
  const subscription = useContext(SubscriptionContext);
  const isPremium = !!subscription?.isPremium;
  const reviewerPremiumEnabled = !!subscription?.reviewerPremiumEnabled;
  const activateReviewerPremium = subscription?.activateReviewerPremium;
  const deactivateReviewerPremium = subscription?.deactivateReviewerPremium;
  const threadIndex = useThreadsStore(s => s.threadIndex);
  const activeThreadId = useThreadsStore(s => s.activeThreadId);
  const createThread = useThreadsStore(s => s.createThread);
  const setActiveThread = useThreadsStore(s => s.setActiveThread);
  const model = useSettingsStore(s => s.model);
  const reviewerTapCountRef = React.useRef(0);
  const lastVersionTapAtRef = React.useRef(0);
  const navigationLockedRef = React.useRef(false);
  const navigationUnlockTimeoutRef = React.useRef(null);
  const scheduledNavigationTimeoutRef = React.useRef(null);

  const releaseNavigationLock = useCallback(() => {
    if (navigationUnlockTimeoutRef.current) {
      clearTimeout(navigationUnlockTimeoutRef.current);
      navigationUnlockTimeoutRef.current = null;
    }
    navigationLockedRef.current = false;
  }, []);

  const clearScheduledNavigation = useCallback(() => {
    if (scheduledNavigationTimeoutRef.current) {
      clearTimeout(scheduledNavigationTimeoutRef.current);
      scheduledNavigationTimeoutRef.current = null;
    }
  }, []);

  const scheduleNavigationAfterClose = useCallback((action) => {
    clearScheduledNavigation();
    navigation.closeDrawer?.();
    scheduledNavigationTimeoutRef.current = setTimeout(() => {
      scheduledNavigationTimeoutRef.current = null;
      action();
    }, 300);
  }, [clearScheduledNavigation, navigation]);

  useEffect(() => {
    perfStart('drawer.transition', {
      open: drawerOpen,
    });
    const timeoutId = setTimeout(() => {
      perfEnd('drawer.transition', {
        open: drawerOpen,
      });
    }, 320);
    return () => clearTimeout(timeoutId);
  }, [drawerOpen]);

  useEffect(() => {
    if (drawerOpen) {
      releaseNavigationLock();
    }
  }, [drawerOpen, releaseNavigationLock]);

  useEffect(() => () => {
    clearScheduledNavigation();
    releaseNavigationLock();
  }, [clearScheduledNavigation, releaseNavigationLock]);

  const navigateTo = useCallback((routeName, params) => {
    perfLog('drawer.navigate', {
      routeName,
      params,
      activeRoute,
    });

    if (routeName === 'PaywallScreen' && isPremium) {
      return;
    }

    const isAlreadyActive =
      routeName !== 'Chat' &&
      ((routeName === 'Studio' && activeRoute === 'Studio') || routeName === activeRoute);

    if (isAlreadyActive) {
      perfLog('drawer.navigate_skipped', {
        routeName,
        reason: 'already_active',
      });
      navigation.closeDrawer?.();
      return;
    }

    if (navigationLockedRef.current) {
      perfLog('drawer.navigate_skipped', {
        routeName,
        reason: 'locked',
      });
      return;
    }

    navigationLockedRef.current = true;
    navigationUnlockTimeoutRef.current = setTimeout(() => {
      releaseNavigationLock();
    }, 700);

    try {
      Haptic.trigger('impactLight');
    } catch {}

    scheduleNavigationAfterClose(() => {
      if (routeName === 'Chat') {
        const thread = createThread({ title: 'New chat', model });
        setActiveThread(thread.id);
      }

      if (routeName === 'Studio') {
        navigation.navigate('Studio');
        return;
      }

      navigation.navigate(routeName, params);
    });
  }, [activeRoute, createThread, isPremium, model, navigation, releaseNavigationLock, scheduleNavigationAfterClose, setActiveThread]);

  const navigateToThread = useCallback((threadId) => {
    if (navigationLockedRef.current) {
      perfLog('drawer.navigate_skipped', {
        routeName: 'Chat',
        reason: 'locked_thread_switch',
        threadId,
      });
      return;
    }

    navigationLockedRef.current = true;
    navigationUnlockTimeoutRef.current = setTimeout(() => {
      releaseNavigationLock();
    }, 700);

    perfLog('drawer.navigate_thread', {
      threadId,
    });

    try {
      Haptic.trigger('impactLight');
    } catch {}

    scheduleNavigationAfterClose(() => {
      setActiveThread(threadId);
      navigation.navigate('Chat');
    });
  }, [navigation, releaseNavigationLock, scheduleNavigationAfterClose, setActiveThread]);

  const recentThreads = useMemo(() => {
    return threadIndex
      .filter(thread => thread?.hasMessages)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 3);
  }, [threadIndex]);

  const contentContainerStyle = useMemo(() => ({
    paddingTop: insets.top + (isCompactHeight ? 8 : 12),
    paddingBottom: insets.bottom + (isCompactHeight ? 14 : 20),
    paddingHorizontal: isCompactHeight ? 16 : 24,
  }), [insets.bottom, insets.top, isCompactHeight]);

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
    activatingReviewerPremium,
    deactivateReviewerPremium,
    reviewerPremiumEnabled,
  ]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#0A0A0F', '#000000']}
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
            <View style={[styles.logoSection, isCompactHeight && styles.logoSectionCompact]}>
              <View style={[styles.logoCircle, isCompactHeight && styles.logoCircleCompact]}>
                <Image
                  source={require('../../assets/icons/appiconsvg.png')}
                  style={[styles.appIcon, isCompactHeight && styles.appIconCompact]}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.logoText, isCompactHeight && styles.logoTextCompact]}>
                ChatCloud
              </Text>
            </View>

            {recentThreads.length > 0 ? (
              <View style={[styles.recentChatsSection, isCompactHeight && styles.recentChatsSectionCompact]}>
                <TouchableOpacity
                  style={styles.recentChatsHeader}
                  onPress={() => {
                    const nextExpanded = !recentChatsExpanded;
                    perfLog('drawer.recent_chats.toggle', {
                      expanded: nextExpanded,
                    });
                    setRecentChatsExpanded(nextExpanded);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.recentChatsTitle}>
                    {t('navigation.recentChats')}
                  </Text>
                  <Text style={styles.recentChatsChevron}>
                    {recentChatsExpanded ? '▲' : '▼'}
                  </Text>
                </TouchableOpacity>

                {recentChatsExpanded ? recentThreads.map(thread => {
                  const resolved = thread.preview || t('history.newChat');
                  const preview = resolved.length > 40 ? `${resolved.slice(0, 39)}...` : resolved;

                  return (
                    <TouchableOpacity
                      key={thread.id}
                      style={[
                        styles.recentChatItem,
                        thread.id === activeThreadId && styles.recentChatItemActive,
                      ]}
                      onPress={() => navigateToThread(thread.id)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.recentChatText,
                          thread.id === activeThreadId && styles.recentChatTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {preview}
                      </Text>
                    </TouchableOpacity>
                  );
                }) : null}
              </View>
            ) : null}

            <SidebarCreativeStudioBanner
              compact={isCompactHeight}
              onPress={() => navigateTo('Studio', { screen: 'StudioHome' })}
              style={[styles.sidebarBanner, isCompactHeight && styles.sidebarBannerCompact]}
              playVideo={drawerOpen}
            />

            <View style={[styles.mainNav, isCompactHeight && styles.mainNavCompact]}>
              <AndroidDrawerMenuItem
                active={activeRoute === 'Chat'}
                icon="newchat"
                label={t('navigation.chat')}
                onPress={() => navigateTo('Chat')}
              />
              <AndroidDrawerMenuItem
                active={activeRoute === 'History'}
                icon="layout"
                label={t('navigation.history')}
                onPress={() => navigateTo('History')}
              />
              <AndroidDrawerMenuItem
                active={activeRoute === 'Assistants'}
                icon="quill"
                label={t('navigation.assistants')}
                onPress={() => navigateTo('Assistants')}
              />
              <AndroidDrawerMenuItem
                active={activeRoute === 'Studio'}
                icon="studio"
                label={t('navigation.imagesStudio')}
                onPress={() => navigateTo('Studio')}
              />
              <AndroidDrawerMenuItem
                active={activeRoute === 'Settings'}
                icon="settings"
                label={t('navigation.settings')}
                onPress={() => navigateTo('Settings')}
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

          {!isPremium ? (
            <View style={[styles.footerSection, isCompactHeight && styles.footerSectionCompact]}>
              <SidebarProFeaturesButton
                compact={isCompactHeight}
                onPress={() => navigateTo('PaywallScreen', { returnTo: activeRoute })}
              />
            </View>
          ) : null}
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
                style={[styles.modalButton, styles.modalButtonPrimary]}
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
  recentChatsSection: {
    marginTop: 14,
  },
  recentChatsSectionCompact: {
    marginTop: 12,
  },
  recentChatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recentChatsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Lato-Bold',
  },
  recentChatsChevron: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  recentChatItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  recentChatItemActive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  recentChatText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: 'Lato-Regular',
  },
  recentChatTextActive: {
    color: colors.text,
    fontFamily: 'Lato-Bold',
  },
  sidebarBanner: {
    marginTop: 8,
  },
  sidebarBannerCompact: {
    marginTop: 6,
  },
  mainNav: {
    marginTop: 10,
  },
  mainNavCompact: {
    marginTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  menuItemActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
    fontFamily: 'Lato-Regular',
  },
  menuLabelActive: {
    color: colors.text,
    fontFamily: 'Lato-Bold',
  },
  versionButton: {
    alignSelf: 'flex-start',
    marginTop: 24,
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
  footerSection: {
    paddingTop: 10,
  },
  footerSectionCompact: {
    paddingTop: 8,
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
});

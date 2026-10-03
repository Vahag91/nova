import { IMAGE_STUDIO_ENABLED, REWARDS_ENABLED } from '../constants/featureFlags';
import { useSourceWorkspaceAvailability } from '../state/useSourceWorkspaceAvailability';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useWorkspaceTranslation } from '../i18n/useWorkspaceTranslation';

import SvgIcon from '../components/SvgIcon';
import SidebarAssistantsBanner from '../components/navigation/SidebarAssistantsBanner';
import SidebarProFeaturesButton from '../components/navigation/SidebarProFeaturesButton';
import { SubscriptionContext } from '../context/SubscriptionContext';
import { useThreadsStore } from '../state/useThreadsStore';
import { colors } from '../styles/colors';
import { APP_VERSION } from '../config/appInfo';
// Matches the coin accent used on the rewards screen.
const REWARDS_ACCENT = '#FBBF24';

function MenuItem({ active, icon, label, onPress, highlight }) {
  return (
    <TouchableOpacity
      style={[
        styles.menuItem,
        highlight && styles.menuItemHighlight,
        active &&
          (highlight ? styles.menuItemHighlightActive : styles.menuItemActive),
      ]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View style={styles.iconContainer}>
        <SvgIcon
          name={icon}
          size={18}
          color={
            highlight
              ? REWARDS_ACCENT
              : active
                ? colors.text
                : colors.textSecondary
          }
        />
      </View>
      <Text
        style={[
          styles.menuLabel,
          active && styles.menuLabelActive,
          highlight && styles.menuLabelHighlight,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function AndroidNavigationMenu({
  visible,
  activeRouteName,
  onClose,
  onNavigate,
  onNavigateThread,
}) {
  const { t } = useTranslation();
  const { c } = useWorkspaceTranslation();
  const documentsEnabled = useSourceWorkspaceAvailability('document');
  const videosEnabled = useSourceWorkspaceAvailability('video');
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const topInset = insets.top;
  // This drawer lives in a Modal, which statusBarTranslucent pushes edge-to-edge.
  // Below API 35 the main window still fits the navigation bar, so the provider
  // reports bottom: 0 and the footer would sit under the system buttons. Fall
  // back to the screen/window delta, which is the system bar height.
  const bottomInset = React.useMemo(() => {
    if (insets.bottom > 0) return insets.bottom;
    const fullHeight = Dimensions.get('screen').height;
    const delta = Math.round(fullHeight - screenHeight);
    return delta > 0 && delta < 200 ? delta : 0;
  }, [insets.bottom, screenHeight]);
  const isCompactHeight = screenHeight <= 700;
  const subscription = useContext(SubscriptionContext);
  const isPremium = !!subscription?.isPremium;
  const reviewerPremiumEnabled = !!subscription?.reviewerPremiumEnabled;
  const activateReviewerPremium = subscription?.activateReviewerPremium;
  const deactivateReviewerPremium = subscription?.deactivateReviewerPremium;
  const threadIndex = useThreadsStore(s => s.threadIndex);
  const threadBodiesHydrated = useThreadsStore(s => s.threadBodiesHydrated);
  const activeThreadId = useThreadsStore(s => s.activeThreadId);
  const createThread = useThreadsStore(s => s.createThread);
  const [mounted, setMounted] = useState(visible);
  const [animationRouteName, setAnimationRouteName] = useState(activeRouteName);
  const wasVisibleRef = useRef(visible);
  const versionTapCountRef = useRef(0);
  const versionTapTsRef = useRef(0);
  const overlayOpacity = useSharedValue(0);
  const panelTranslateX = useSharedValue(-PANEL_WIDTH);

  const recentThreads = useMemo(() => {
    if (!threadBodiesHydrated) return [];
    return threadIndex
      .filter(thread => thread?.hasMessages)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 3);
  }, [threadBodiesHydrated, threadIndex]);

  const handleMenuItemPress = React.useCallback((routeName, source = 'menu_item', params) => {
    onNavigate(routeName, params);
  }, [onNavigate]);

  const handleThreadPress = React.useCallback((threadId) => {
    onNavigateThread(threadId);
  }, [onNavigateThread]);

  const handleNewChatPress = React.useCallback(() => {
    createThread({ title: t('history.newChat') });
    handleMenuItemPress('Chat', 'new_chat');
  }, [createThread, handleMenuItemPress, t]);

  const handleVersionTap = React.useCallback(async () => {
    const now = Date.now();
    if (now - versionTapTsRef.current > 2500) {
      versionTapCountRef.current = 0;
    }
    versionTapTsRef.current = now;
    versionTapCountRef.current += 1;

    if (versionTapCountRef.current < 5) {
      return;
    }

    versionTapCountRef.current = 0;

    try {
      if (reviewerPremiumEnabled) {
        Alert.alert(
          t('reviewerPremium.deactivateTitle'),
          t('reviewerPremium.deactivateMessage'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('reviewerPremium.deactivateAction'),
              style: 'destructive',
              onPress: async () => {
                try {
                  await deactivateReviewerPremium?.();
                } catch {}
              },
            },
          ],
        );
      } else {
        Alert.alert(
          t('reviewerPremium.activateTitle'),
          t('reviewerPremium.activateMessage'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('reviewerPremium.activateAction'),
              onPress: async () => {
                try {
                  await activateReviewerPremium?.();
                } catch {}
              },
            },
          ],
        );
      }
    } catch {}
  }, [
    activateReviewerPremium,
    deactivateReviewerPremium,
    reviewerPremiumEnabled,
    t,
  ]);

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      setMounted(true);
      setAnimationRouteName(activeRouteName);
    }
    wasVisibleRef.current = visible;
  }, [activeRouteName, visible]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    if (visible) {
      overlayOpacity.value = withTiming(1, {
        duration: 160,
        easing: Easing.out(Easing.cubic),
      });
      panelTranslateX.value = withTiming(0, {
        duration: 190,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    overlayOpacity.value = withTiming(0, {
      duration: 120,
      easing: Easing.in(Easing.cubic),
    });
    panelTranslateX.value = withTiming(-PANEL_WIDTH, {
      duration: 170,
      easing: Easing.in(Easing.cubic),
    }, finished => {
      if (finished) {
        runOnJS(setMounted)(false);
      }
    });
  }, [animationRouteName, mounted, overlayOpacity, panelTranslateX, visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const panelAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: panelTranslateX.value }],
  }));

  if (!mounted) {
    return null;
  }

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={() => onClose('system')}
    >
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, overlayStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => onClose('backdrop')} />
        </Animated.View>
        <Animated.View
          style={[
            styles.panel,
            panelAnimatedStyle,
            {
              paddingTop: topInset + 34,
              paddingBottom: bottomInset + 18,
            },
          ]}
        >
          <ScrollView
            style={styles.scrollArea}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.logoSection}>
              <View style={styles.logoCircle}>
                <Image
                  source={require('../../assets/icons/appiconsvg.png')}
                  style={styles.appIcon}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.logoText}>Cloud AI</Text>
            </View>

            {recentThreads.length > 0 ? (
              <View style={styles.recentChatsSection}>
                <Text style={styles.recentChatsTitle}>
                  {t('navigation.recentChats')}
                </Text>
                {recentThreads.map(thread => {
                  const resolved = thread.preview || t('history.newChat');
                  const preview = resolved.length > 40 ? `${resolved.slice(0, 39)}...` : resolved;

                  return (
                    <TouchableOpacity
                      key={thread.id}
                      style={[
                        styles.recentChatItem,
                        thread.id === activeThreadId && styles.recentChatItemActive,
                      ]}
                      onPress={() => handleThreadPress(thread.id)}
                      activeOpacity={0.82}
                    >
                      <Text
                        numberOfLines={1}
                      style={[
                          styles.recentChatText,
                          thread.id === activeThreadId && styles.recentChatTextActive,
                        ]}
                      >
                        {preview}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            <SidebarAssistantsBanner
              compact={isCompactHeight}
              onPress={() => handleMenuItemPress('Assistants', 'assistants_banner')}
              style={styles.sidebarBanner}
              playVideo={visible}
            />

            <View style={styles.mainNav}>
              {documentsEnabled && <MenuItem
                active={activeRouteName === 'Documents'}
                icon="workspace-document"
                label={c('documents', 'Documents')}
                onPress={() => handleMenuItemPress('Documents')}
              />}
              {videosEnabled && <MenuItem
                active={activeRouteName === 'VideoSummaries'}
                icon="workspace-video"
                label={c('videos', 'Video summaries')}
                onPress={() => handleMenuItemPress('VideoSummaries')}
              />}
              <MenuItem
                active={activeRouteName === 'Chat'}
                icon="newchat"
                label={t('navigation.chat')}
                onPress={handleNewChatPress}
              />
              <MenuItem
                active={activeRouteName === 'History'}
                icon="layout"
                label={t('navigation.history')}
                onPress={() => handleMenuItemPress('History')}
              />
              <MenuItem
                active={activeRouteName === 'Assistants'}
                icon="quill"
                label={t('navigation.assistants')}
                onPress={() => handleMenuItemPress('Assistants')}
              />
              {IMAGE_STUDIO_ENABLED ? (
                <MenuItem
                  active={activeRouteName === 'Studio'}
                  icon="studio"
                  label={t('navigation.imagesStudio')}
                  onPress={() => handleMenuItemPress('Studio')}
                />
              ) : null}
              {REWARDS_ENABLED ? (
                <MenuItem
                  highlight
                  active={activeRouteName === 'Rewards'}
                  icon="coin"
                  label={t('navigation.rewards')}
                  onPress={() => handleMenuItemPress('Rewards')}
                />
              ) : null}
              <MenuItem
                active={activeRouteName === 'Settings'}
                icon="settings"
                label={t('navigation.settings')}
                onPress={() => handleMenuItemPress('Settings')}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={handleVersionTap} hitSlop={12} style={styles.versionWrap}>
              <Text style={styles.versionText}>
                {t('app.version', {
                  version: String(APP_VERSION || '1').split('.')[0],
                })}
              </Text>
            </Pressable>

            {!isPremium ? (
              <SidebarProFeaturesButton
                compact={isCompactHeight}
                onPress={() => handleMenuItemPress('PaywallScreen', 'footer_upgrade', { returnTo: activeRouteName })}
              />
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const PANEL_WIDTH = 304;

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.46)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: PANEL_WIDTH,
    backgroundColor: '#050507',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    elevation: 16,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 6, height: 0 },
  },
  scrollArea: {
    flex: 1,
  },
  footer: {
    flexShrink: 0,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 0,
    minHeight: 48,
  },
  logoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIcon: {
    width: 44,
    height: 44,
  },
  logoText: {
    fontSize: 24,
    fontFamily: 'Lato-Bold',
    color: colors.text,
    marginLeft: 6,
    letterSpacing: 1.4,
  },
  recentChatsSection: {
    marginTop: 36,
  },
  recentChatsTitle: {
    fontSize: 12,
    fontFamily: 'Lato-Bold',
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  recentChatItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
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
    marginTop: 10,
  },
  mainNav: {
    marginTop: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  menuItemActive: {
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  menuItemHighlight: {
    backgroundColor: 'rgba(251,191,36,0.12)',
  },
  menuItemHighlightActive: {
    backgroundColor: 'rgba(251,191,36,0.22)',
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
    color: colors.textSecondary,
    fontFamily: 'Lato-Regular',
  },
  menuLabelActive: {
    color: colors.text,
    fontFamily: 'Lato-Bold',
  },
  menuLabelHighlight: {
    color: REWARDS_ACCENT,
    fontFamily: 'Lato-Bold',
  },
  versionWrap: {
    marginTop: 16,
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingLeft: 4,
  },
  versionText: {
    color: 'rgba(148,163,184,0.7)',
    fontSize: 13,
    fontFamily: 'Lato-Regular',
    textAlign: 'left',
  },
});

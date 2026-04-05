import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
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

import SvgIcon from '../components/SvgIcon';
import SidebarCreativeStudioBanner from '../components/navigation/SidebarCreativeStudioBanner';
import SidebarProFeaturesButton from '../components/navigation/SidebarProFeaturesButton';
import { SubscriptionContext } from '../context/SubscriptionContext';
import { useThreadsStore } from '../state/useThreadsStore';
import { colors } from '../styles/colors';
function MenuItem({ active, icon, label, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, active && styles.menuItemActive]}
      onPress={onPress}
      activeOpacity={0.82}
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

export default function AndroidNavigationMenu({
  visible,
  activeRouteName,
  onClose,
  onNavigate,
  onNavigateThread,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const topInset = Math.max(insets.top, StatusBar.currentHeight || 0);
  const isCompactHeight = screenHeight <= 700;
  const isPremium = !!useContext(SubscriptionContext)?.isPremium;
  const threadIndex = useThreadsStore(s => s.threadIndex);
  const activeThreadId = useThreadsStore(s => s.activeThreadId);
  const [mounted, setMounted] = useState(visible);
  const [animationRouteName, setAnimationRouteName] = useState(activeRouteName);
  const wasVisibleRef = useRef(visible);
  const overlayOpacity = useSharedValue(0);
  const panelTranslateX = useSharedValue(-PANEL_WIDTH);

  const recentThreads = useMemo(() => {
    return threadIndex
      .filter(thread => thread?.hasMessages)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 3);
  }, [threadIndex]);

  const handleMenuItemPress = React.useCallback((routeName, source = 'menu_item', params) => {
    onNavigate(routeName, params);
  }, [onNavigate]);

  const handleThreadPress = React.useCallback((threadId) => {
    onNavigateThread(threadId);
  }, [onNavigateThread]);

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
              paddingTop: topInset + 18,
              paddingBottom: insets.bottom + 18,
            },
          ]}
        >
          <ScrollView
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
              <Text style={styles.logoText}>ChatCloud</Text>
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

            <SidebarCreativeStudioBanner
              compact={isCompactHeight}
              onPress={() => handleMenuItemPress('Studio', 'studio_banner')}
              style={styles.sidebarBanner}
              playVideo={visible}
            />

            <View style={styles.mainNav}>
              <MenuItem
                active={activeRouteName === 'Chat'}
                icon="newchat"
                label={t('navigation.chat')}
                onPress={() => handleMenuItemPress('Chat')}
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
              <MenuItem
                active={activeRouteName === 'Studio'}
                icon="studio"
                label={t('navigation.imagesStudio')}
                onPress={() => handleMenuItemPress('Studio')}
              />
              <MenuItem
                active={activeRouteName === 'Settings'}
                icon="settings"
                label={t('navigation.settings')}
                onPress={() => handleMenuItemPress('Settings')}
              />
            </View>
          </ScrollView>

          {!isPremium ? (
            <SidebarProFeaturesButton
              compact={isCompactHeight}
              onPress={() => handleMenuItemPress('PaywallScreen', 'footer_upgrade', { returnTo: activeRouteName })}
            />
          ) : null}
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
    width: 46,
    height: 46,
  },
  logoText: {
    fontSize: 24,
    fontFamily: 'Lato-Bold',
    color: colors.text,
    marginLeft: 6,
    letterSpacing: 1.4,
  },
  recentChatsSection: {
    marginTop: 16,
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
    marginTop: 8,
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
});

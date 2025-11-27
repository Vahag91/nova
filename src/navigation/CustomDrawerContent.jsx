import React, { useContext, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Image } from 'react-native';
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
import SvgIcon from '../components/SvgIcon';
import { colors } from '../styles/colors';
import { useThreadsStore } from '../state/useThreadsStore';
import { useSettingsStore } from '../state/useSettingsStore';
import { useTranslation } from 'react-i18next';
import { betterPreview, summaryPreview } from '../lib/format';
import SidebarCreativeStudioBanner from '../components/navigation/SidebarCreativeStudioBanner';
import { SubscriptionContext } from '../context/SubscriptionContext';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function CustomDrawerContent(props) {
  const { state, navigation } = props;
  const { t } = useTranslation();
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
  const logoScale = useSharedValue(1);
  const logoPulse = useSharedValue(0);
  const [recentChatsExpanded, setRecentChatsExpanded] = React.useState(true);
  const recentChatsHeight = useSharedValue(1);
  const chevronRotation = useSharedValue(0);
  const subscription = useContext(SubscriptionContext);
  const isPremium = !!subscription?.isPremium;
  const baseMenuItemCount = 4;

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

  const navigateToThread = (threadId) => {
    Haptic.trigger('impactLight');
    setActiveThread(threadId);
    navigation.navigate('Chat');
  };

  // Get recent threads (last 5, sorted by updatedAt)
  const recentThreads = React.useMemo(() => {
    const nonEmptyThreads = threads.filter(t => 
      Array.isArray(t?.messages) && t.messages.some(m => m.role === 'user' || m.role === 'assistant')
    );
    return [...nonEmptyThreads]
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 5);
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
          menuItemAnimStyle,
          isActive && styles.menuItemActive,
        ]}
        onPress={() => navigateTo(routeName)}
        activeOpacity={0.7}
      >
        {isActive && (
          <Animated.View style={[styles.activeIndicator, activeIndicatorStyle]} />
        )}
        <View style={styles.iconContainer}>
          <SvgIcon 
            name={icon} 
            size={20} 
            color={isActive ? colors.text : colors.textSecondary} 
          />
        </View>
        <Text style={[
          styles.menuLabel,
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
      const resolved = summaryBased || betterPreview(thread.messages) || t('history.newChat');
      const text = resolved;
      return text.length > 40 ? `${text.slice(0, 39)}…` : text;
    }, [thread.summary, thread.messages, t]);

    return (
      <AnimatedTouchable
        style={[
          styles.recentChatItem,
          chatItemAnimStyle,
          isActive && styles.recentChatItemActive,
        ]}
        onPress={() => navigateToThread(thread.id)}
        activeOpacity={0.7}
      >
        <Text 
          style={[
            styles.recentChatText,
            isActive && styles.recentChatTextActive,
          ]} 
          numberOfLines={1}
        >
          {preview}
        </Text>
      </AnimatedTouchable>
    );
  };

  const   recentChatsContainerStyle = useAnimatedStyle(() => {
    const progress = recentChatsHeight.value;
    const maxVisibleItems = 3;
    const itemHeight = 46; // paddingVertical: 10, marginBottom: 4, height ~42
    const maxHeight = maxVisibleItems * itemHeight;
    return {
      opacity: progress,
      maxHeight: progress * maxHeight,
      transform: [{ translateY: (1 - progress) * -10 }],
    };
  });

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#000000', '#0a0a0f', '#000000']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo Section */}
        <Animated.View style={[styles.logoSection, logoAnimatedStyle]}>
          <Animated.View style={[styles.logoCircle, logoGlowStyle]}>
            <Image 
              source={require('../../assets/icons/appiconsvg.png')}
              style={styles.appIcon}
              resizeMode="contain"
            />
          </Animated.View>
          <Text style={styles.logoText}>ChatCloud</Text>
        </Animated.View>
        <SidebarCreativeStudioBanner
            onPress={() => navigateTo('Studio', { screen: 'StudioHome' })}
            style={styles.sidebarBanner}
            restartKey={drawerOpenTick}
          />
        <View style={styles.mainNav}>

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

          {/* Recent Chats Section */}
          {recentThreads.length > 0 && (
            <View style={styles.recentChatsSection}>
              <TouchableOpacity 
                style={styles.recentChatsHeader}
                onPress={() => setRecentChatsExpanded(!recentChatsExpanded)}
                activeOpacity={0.7}
              >
                <Text style={styles.recentChatsTitle}>{t('navigation.recentChats')}</Text>
                <Animated.View style={chevronStyle}>
                  <Text style={styles.recentChatsChevron}>▼</Text>
                </Animated.View>
              </TouchableOpacity>

              <Animated.View style={[styles.recentChatsList, recentChatsContainerStyle]}>
                <ScrollView 
                  style={styles.recentChatsScrollView}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={false}
                >
                  {recentThreads.map((thread, idx) => (
                    <RecentChatItem key={thread.id} thread={thread} index={idx} />
                  ))}
                </ScrollView>
              </Animated.View>
            </View>
          )}
        </View>

        {/* Bottom Navigation */}
        <View style={styles.bottomNav}>
          <MenuItem
            icon="settings"
            label={t('navigation.settings')}
            routeName="Settings"
            isActive={activeRoute === 'Settings'}
            index={baseMenuItemCount}
          />
        </View>
      </DrawerContentScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingTop: 12,
  },
  logoCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIcon: {
    width: 48,
    height: 48,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginLeft: 6,
    letterSpacing: 2,
    fontFamily: 'Lato-Bold',
  },
  mainNav: {
    gap: 16,
    marginTop: 26,
  },
  sidebarBanner: {
    marginTop: 18,
  },
  bottomNav: {
    gap: 16,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 24,
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
  // Recent Chats Section
  recentChatsSection: {
    marginTop: 24,
  },
  recentChatsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
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
  recentChatsList: {
    overflow: 'hidden',
    marginBottom: 8,
  },
  recentChatsScrollView: {
    maxHeight: 130, // 3 items * 46px each
  },
  recentChatItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: 'transparent',
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
  recentChatTextActive: {
    color: colors.text,
    fontFamily: 'Lato-Bold',
  },
});

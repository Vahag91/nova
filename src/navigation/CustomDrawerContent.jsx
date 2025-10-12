import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
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

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function CustomDrawerContent(props) {
  const { state, navigation } = props;
  const { t } = useTranslation();
  const activeRoute = state.routeNames[state.index];
  const drawerOpen = useDrawerStatus() === 'open';
  
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

  const SPRING_CONFIG = {
    damping: 16,
    stiffness: 140,
    overshootClamping: true,
  };

  useEffect(() => {
    // Toggle animations whenever the drawer opens/closes
    isOpen.value = drawerOpen ? 1 : 0;
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

  const navigateTo = (routeName) => {
    Haptic.trigger('impactLight');
    
    // If navigating to Chat, create a new thread
    if (routeName === 'Chat') {
      const t = createThread({ title: 'New chat', model });
      setActiveThread(t.id);
    }
    
    navigation.navigate(routeName);
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
    const chatItemAnimStyle = getMenuItemStyle(index + 4); // Offset for main menu items

    // Get preview text from first user message
    const preview = React.useMemo(() => {
      const userMsg = thread.messages?.find(m => m.role === 'user');
      if (!userMsg) return 'New chat';
      const text = typeof userMsg.content === 'string' 
        ? userMsg.content 
        : userMsg.content?.[0]?.text || 'New chat';
      return text.length > 30 ? text.substring(0, 30) + '...' : text;
    }, [thread.messages]);

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

  const recentChatsContainerStyle = useAnimatedStyle(() => {
    const progress = recentChatsHeight.value;
    return {
      opacity: progress,
      maxHeight: progress * 300, // Smooth height transition
      transform: [{ translateY: (1 - progress) * -10 }], // Subtle slide up/down
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
            <SvgIcon name="stars" size={24} color={colors.accent} />
          </Animated.View>
          <Text style={styles.logoText}>AILY</Text>
        </Animated.View>

        {/* Main Navigation */}
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
            routeName="ImagesStudio"
            isActive={activeRoute === 'ImagesStudio'}
            index={3}
          />
          <MenuItem
            icon="stars"
            label="Onboarding"
            routeName="IntroductionAnimationScreen"
            isActive={activeRoute === 'IntroductionAnimationScreen'}
            index={4}
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
                {recentThreads.map((thread, idx) => (
                  <RecentChatItem key={thread.id} thread={thread} index={idx} />
                ))}
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
            index={5}
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
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 48,
    paddingTop: 12,
  },
  logoCircle: {
    width: 42,
    height: 42,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginLeft: 12,
    letterSpacing: 2,
    fontFamily: 'Lato-Bold',
  },
  mainNav: {
    flex: 1,
    gap: 16,
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


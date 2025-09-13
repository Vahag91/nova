import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { getColors } from '../styles/colors';
import { getFontFamily } from '../styles/fonts';

export const GlassBottomNav = ({ activeTab = 'chat', onTabPress }) => {
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const colors = getColors(isDarkMode);

  const overlayDark = 'rgba(13,18,33,0.92)';
  const overlayLight = 'rgba(255,255,255,0.95)';
  const borderTop = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';

  const Chrome = ({ children }) => (
    <View style={[styles.chrome, { borderTopColor: borderTop }]}>
      {Platform.OS === 'ios' ? (
        <BlurView blurType={isDarkMode ? 'dark' : 'light'} blurAmount={20} style={styles.blurFill}>
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: isDarkMode ? overlayDark : overlayLight }]}
          />
          {children}
        </BlurView>
      ) : (
        <View style={[styles.blurFill, { backgroundColor: isDarkMode ? overlayDark : overlayLight }]}>
          {children}
        </View>
      )}
    </View>
  );

  const Tab = ({ id, label, icon }) => {
    const active = activeTab === id;
    
    // Professional light theme colors
    const iconColor = active 
      ? colors.primary 
      : (isDarkMode ? '#94A3B8' : '#6B7280');
    const textColor = active 
      ? colors.primary 
      : (isDarkMode ? '#94A3B8' : '#6B7280');
    const fontWeight = active ? '700' : '500';
    const iconSize = active ? 24 : 22;

    return (
      <TouchableOpacity
        style={[
          styles.tab,
          active && isDarkMode && styles.activeTabDark,
          active && !isDarkMode && styles.activeTabLight,
        ]}
        onPress={() => onTabPress?.(id)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={[
          styles.iconContainer,
          active && !isDarkMode && styles.activeIconContainer
        ]}>
          <Icon name={icon} size={iconSize} color={iconColor} />
        </View>
        <Text 
          style={[
            styles.label, 
            { 
              color: textColor, 
              fontWeight,
              textShadowColor: isDarkMode ? 'transparent' : 'rgba(255, 255, 255, 0.8)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 1,
            }
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <Chrome>
        <View style={[styles.row, { paddingBottom: insets.bottom + 8 }]}>
          <Tab id="chat"   label="Home"    icon="home" />
          <Tab id="chats"  label="Chats"   icon="forum" />
          <Tab id="models" label="Models"  icon="apps" />
          <Tab id="settings" label="Settings" icon="settings" />
        </View>
      </Chrome>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    zIndex: 1000,
    elevation: 30,
  },
  chrome: {
    borderTopWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  blurFill: {
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    marginHorizontal: 2,
  },
  activeTabLight: {
    backgroundColor: 'rgba(121, 80, 242, 0.08)',
    shadowColor: '#7950F2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activeTabDark: {
    backgroundColor: 'rgba(121, 80, 242, 0.15)',
  },
  iconContainer: {
    padding: 4,
    borderRadius: 8,
  },
  activeIconContainer: {
    backgroundColor: 'rgba(121, 80, 242, 0.12)',
  },
  label: {
    fontSize: 12,
    fontFamily: getFontFamily('regular'),
    letterSpacing: 0.3,
    marginTop: 2,
  },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { getColors } from '../styles/colors';
import { getFontFamily } from '../styles/fonts';

export const GlassHeader = ({ title = 'Chat', rightButton }) => {
  const { isDarkMode } = useTheme();
  const colors = getColors(isDarkMode);
  const insets = useSafeAreaInsets();

  const Bar = ({ children }) =>
    Platform.OS === 'ios' ? (
      <BlurView blurType={isDarkMode ? 'dark' : 'light'} blurAmount={15} style={styles.blur}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: isDarkMode ? 'rgba(13,18,33,0.8)' : 'rgba(255,255,255,0.5)' }]} />
        {children}
      </BlurView>
    ) : (
      <View style={[styles.fallback, { backgroundColor: isDarkMode ? 'rgba(13,18,33,0.8)' : 'rgba(255,255,255,0.5)', borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
        {children}
      </View>
    );

  return (
    <View style={{ paddingTop: insets.top, zIndex: 50 }}>
      <Bar>
        <View style={styles.row}>
            <Text 
              style={[
                styles.title, 
                { 
                  color: colors.textPrimary,
                  textShadowColor: isDarkMode ? 'transparent' : 'rgba(255, 255, 255, 0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }
              ]} 
              numberOfLines={1}
            >
              {title}
            </Text>
          {rightButton ? (
            <TouchableOpacity
              onPress={rightButton.onPress}
              activeOpacity={0.9}
              style={[styles.fab, { backgroundColor: colors.primary }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name={rightButton.icon || 'add'} size={22} color="#fff" />
            </TouchableOpacity>
          ) : <View style={styles.fab} />}
        </View>
      </Bar>
    </View>
  );
};

const styles = StyleSheet.create({
  blur: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  fallback: { borderBottomWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    flex: 1,
    fontSize: 28,        // large like screenshot
    fontFamily: getFontFamily('bold'),
    letterSpacing: 0.2,
  },
  fab: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { getColors } from '../../styles/colors';
import { getFontFamily } from '../../styles/fonts';

export const ChatHeader = ({ title, subtitle, onMenuPress, onShieldPress }) => {
  const insets = useSafeAreaInsets();
  const { isDarkMode, toggleTheme } = useTheme();
  const colors = getColors(isDarkMode);

  const barBg = isDarkMode ? 'rgba(13,18,33,0.8)' : 'rgba(255,255,255,0.8)';
  const borderColor = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const Bar = ({ children }) =>
    Platform.OS === 'ios' ? (
      <BlurView blurType={isDarkMode ? 'dark' : 'light'} blurAmount={16} style={styles.blur}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: barBg }]} />
        {children}
      </BlurView>
    ) : (
      <View style={[styles.blur, { backgroundColor: barBg }]}>{children}</View>
    );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Bar>
        <View style={[styles.row, { borderBottomColor: borderColor }]}>
          {/* Left side - Back Button */}
          <View style={styles.leftSection}>
            <TouchableOpacity onPress={onMenuPress} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Center - Title and Subtitle */}
          <View style={styles.center}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>

          {/* Right side - Actions */}
          <View style={styles.actions}>
            <TouchableOpacity onPress={onShieldPress} style={styles.iconBtn}>
              <Icon name="shield" size={20} color="#FBBF24" />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleTheme} style={styles.iconBtn}>
              <Icon name="wb-sunny" size={20} color={isDarkMode ? '#FBBF24' : '#F59E0B'} />
            </TouchableOpacity>
          </View>
        </View>
      </Bar>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    zIndex: 50,
  },
  blur: { borderBottomWidth: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  leftSection: {
    width: 80,
    alignItems: 'flex-start',
  },
  backBtn: {
    height: 40,
    width: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    height: 40,
    width: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  title: { 
    fontSize: 18, 
    fontFamily: getFontFamily('bold'),
    textAlign: 'center',
  },
  subtitle: { 
    fontSize: 12, 
    fontFamily: getFontFamily('regular'), 
    marginTop: 2,
    textAlign: 'center',
  },
  actions: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    width: 80,
    justifyContent: 'flex-end',
  },
});

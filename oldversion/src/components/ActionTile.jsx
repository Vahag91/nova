import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import { getColors } from '../styles/colors';
import { getFontFamily } from '../styles/fonts';

const rgba = (hex, a) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
};

export const ActionTile = ({ title, icon, tint = 'primary', glow = false, onPress }) => {
  const { isDarkMode } = useTheme();
  const colors = getColors(isDarkMode);

  const tintColor = tint === 'accent' ? colors.accent : colors.primary;
  const bgGlass = isDarkMode ? 'rgba(13,18,33,0.8)' : 'rgba(255,255,255,0.75)';
  const border = isDarkMode ? 'rgba(26,31,46,0.5)' : 'rgba(0,0,0,0.06)';

  const scale = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!glow) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1000, useNativeDriver: false }),
      ])
    ).start();
  }, [glow, glowAnim]);

  const shadowRadius = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 16] });
  const shadowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.6] });

  const onPressIn = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={[
        styles.wrapper,
        glow && Platform.OS === 'ios' ? { shadowColor: tintColor, shadowRadius, shadowOpacity, shadowOffset: { width: 0, height: 0 } } : {},
      ]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        android_ripple={{ color: rgba(tintColor, 0.08) }}
        style={[styles.tile, { backgroundColor: bgGlass, borderColor: border }]}
      >
        <View style={[styles.iconBox, { borderColor: border, backgroundColor: rgba(tintColor, 0.10) }]}>
          <Icon name={icon} size={18} color={tintColor} />
        </View>
        <Text 
          style={[
            styles.text, 
            { 
              color: colors.textPrimary,
              textShadowColor: isDarkMode ? 'transparent' : 'rgba(255, 255, 255, 0.5)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 1,
            }
          ]}
        >
          {title}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  tile: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 14, borderWidth: 1,
  },
  iconBox: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  text: { fontSize: 14, fontFamily: getFontFamily('bold') },
});

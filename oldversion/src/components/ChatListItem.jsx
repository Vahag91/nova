import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
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

const tintMap = (colors) => ({
  secret: colors.accent || '#EC4899',
  indigo: colors.primary || '#6366F1',
  emerald: '#34D399',
  sky: '#38BDF8',
  amber: '#F59E0B',
});

export const ChatListItem = ({ item, onPress }) => {
  const { isDarkMode } = useTheme();
  const colors = getColors(isDarkMode);
  const tints = tintMap(colors);
  const tint = tints[item.icon?.tint] || colors.primary;

  const glass = isDarkMode ? 'rgba(30,41,59,0.5)' : 'rgba(255,255,255,0.8)';
  const border = isDarkMode ? 'rgba(51,65,85,0.5)' : 'rgba(0,0,0,0.06)';
  const avatarBg = item.icon?.tint === 'secret' ? rgba(tint, 0.18) : 'rgba(100,116,139,0.50)'; // slate-700/50

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: rgba(colors.primary, 0.08) }}
      style={[styles.card, { backgroundColor: glass, borderColor: border }]}
    >
      <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
        <Icon name={item.icon?.name || 'chat-bubble'} size={26} color={tint} />
      </View>

      <View style={{ flex: 1 }}>
        <Text 
          numberOfLines={1} 
          style={[
            styles.title, 
            { 
              color: colors.textPrimary,
              textShadowColor: isDarkMode ? 'transparent' : 'rgba(255, 255, 255, 0.5)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 1,
            }
          ]}
        >
          {item.title}
        </Text>
        {item.encrypted ? (
          <View style={styles.row}>
            <Icon name="lock" size={14} color={tints.secret} style={{ marginRight: 4 }} />
            <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textSecondary }]}>End-to-end encrypted</Text>
          </View>
        ) : (
          <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
        )}
      </View>

      <Text style={[styles.time, { color: colors.textSecondary }]}>{item.time}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 16, fontFamily: getFontFamily('bold') },
  subtitle: { fontSize: 13, fontFamily: getFontFamily('regular'), marginTop: 4 },
  time: { fontSize: 11, fontFamily: getFontFamily('regular'), alignSelf: 'flex-start', paddingTop: 2 },
});

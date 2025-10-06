import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../styles/colors';
import { useTranslation } from 'react-i18next';

export default function DaySeparator({ date, text, system = false }) {
  const { i18n } = useTranslation();
  const lang = (i18n?.language || 'en').split('-')[0];
  const locale = lang === 'ja' ? 'ja-JP' : 'en-US';

  const label = text || new Date(date).toLocaleDateString(locale, {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  });
  return (
    <View style={[styles.wrap, system && styles.systemWrap]}>
      <View style={[styles.line]} />
      <Text style={[styles.text, system && styles.systemText]}>{label}</Text>
      <View style={[styles.line]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 13 },
  systemWrap: { paddingVertical: 4 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  text: { fontSize: 12, color: colors.textMuted },
  systemText: { color: colors.textSecondary },
});

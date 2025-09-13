import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { getColors } from '../../styles/colors';
import { getFontFamily } from '../../styles/fonts';

export const DividerChip = ({ text }) => {
  const { isDarkMode } = useTheme();
  const colors = getColors(isDarkMode);

  return (
    <View style={styles.row}>
      <View style={[styles.line, { backgroundColor: colors.textSecondary + '25' }]} />
      <Text style={[styles.label, { color: colors.textSecondary, fontFamily: getFontFamily('regular') }]}>
        {text}
      </Text>
      <View style={[styles.line, { backgroundColor: colors.textSecondary + '25' }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 8,
  },
  line: { flex: 1, height: 1 },
  label: { fontSize: 12 },
});

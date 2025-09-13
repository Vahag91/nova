import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { getColors } from '../styles/colors';
import { getFontFamily } from '../styles/fonts';

export const SectionHeading = ({ title }) => {
  const { isDarkMode } = useTheme();
  const colors = getColors(isDarkMode);
  return (
    <View style={styles.wrap}>
      <Text 
        style={[
          styles.text, 
          { 
            color: colors.textSecondary,
            textShadowColor: isDarkMode ? 'transparent' : 'rgba(255, 255, 255, 0.5)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 1,
          }
        ]}
      >
        {title.toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 2, paddingTop: 18, paddingBottom: 8 },
  text: { fontSize: 12, fontFamily: getFontFamily('bold'), letterSpacing: 1.1 },
});

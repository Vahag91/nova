import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import { getColors } from '../styles/colors';

export const ThemeToggle = () => {
  const { isDarkMode, toggleTheme } = useTheme();
  const colors = getColors(isDarkMode);

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.tertiary }]}
      onPress={toggleTheme}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor: colors.secondary }]}>
        <Icon
          name={isDarkMode ? 'light_mode' : 'dark_mode'}
          size={20}
          color={colors.textPrimary}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

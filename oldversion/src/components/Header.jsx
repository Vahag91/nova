import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import { getColors } from '../styles/colors';
import { ThemeToggle } from './ThemeToggle.jsx';

export const Header = ({ title, onSettingsPress }) => {
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const colors = getColors(isDarkMode);

  return (
    <>
      <StatusBar 
        barStyle={isDarkMode ? "light-content" : "dark-content"} 
        backgroundColor="transparent" 
        translucent 
      />
      <View style={[styles.container, { 
        paddingTop: insets.top,
        backgroundColor: colors.overlay.secondary50,
        borderBottomColor: colors.border.bottom,
      }]}>
        <View style={styles.content}>
          <View style={styles.spacer} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          <View style={styles.rightContainer}>
            <ThemeToggle />
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={onSettingsPress}
              activeOpacity={0.7}
            >
              <Icon name="settings" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  spacer: {
    width: 48,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsButton: {
    width: 48,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
});

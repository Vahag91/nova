import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors } from '../../styles/colors';
import SvgIcon from '../SvgIcon';

export const Header = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  
  // Check if we're on the initial route (RewardsHome) - if so, show burger menu
  const state = navigation.getState();
  const currentRoute = state?.routes[state?.index];
  const isInitialRoute = currentRoute?.name === 'RewardsHome';
  
  const handleLeftPress = () => {
    if (isInitialRoute) {
      // Open drawer menu when on initial route
      navigation.toggleDrawer?.();
    } else {
      // Go back when on nested routes (like RewardsList)
      navigation.goBack();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.leftSection}>
        <Pressable
          onPress={handleLeftPress}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
          accessibilityLabel={isInitialRoute ? t('rewards.header.openMenu') : t('rewards.header.goBack')}
        >
          {isInitialRoute ? (
            <SvgIcon name="menu" size={24} color="#FFFFFF" />
          ) : (
            <SvgIcon name="chevron-left" size={36} color="#FFFFFF" />
          )}
        </Pressable>
      </View>

      <View style={styles.centerSection}>
        <Text style={styles.title}>{t('rewards.header.title')}</Text>
      </View>

      <View style={styles.rightSection} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
  },
  leftSection: {
    width: 40,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: -4,
  },
  centerSection: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightSection: {
    width: 40,
    height: 44,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
  iconPressed: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Lato-Bold',
    color: '#FFFFFF',
    textAlign: 'center',
    includeFontPadding: false,
  },
});

export default Header;

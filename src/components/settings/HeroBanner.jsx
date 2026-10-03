import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import Icon from '../ui/Icon';
import { colors } from '../../styles/colors';

export default function HeroBanner({ onPress }) {
  const { t } = useTranslation();

  return (
    <Pressable
      style={({ pressed }) => [styles.heroCard, pressed && styles.heroCardPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.heroCopy}>
        <Text style={styles.heroLabel}>{t('settings.hero.label')}</Text>
        <Text style={styles.heroTitle}>{t('settings.hero.title')}</Text>
        <View style={styles.heroButton}>
          <Text style={styles.heroButtonText}>{t('settings.hero.upgrade')}</Text>
        </View>
      </View>

      <View style={styles.heroIconTile}>
        <Icon name="crown" size={26} color={colors.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    backgroundColor: colors.surface,
  },
  heroCardPressed: {
    backgroundColor: colors.surfaceElevated,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '500',
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  heroButton: {
    marginTop: 10,
    minHeight: 40,
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 15,
    textAlign: 'center',
  },
  heroIconTile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.surfaceInset,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

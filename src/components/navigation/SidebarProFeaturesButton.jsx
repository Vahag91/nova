import React from 'react';
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import Icon from '../ui/Icon';
import { colors } from '../../styles/colors';

export default function SidebarProFeaturesButton({ onPress, style, compact = false }) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        style,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('navigation.proFeatures', { defaultValue: 'Pro features' })}
    >
      <View style={[styles.iconTile, compact && styles.iconTileCompact]}>
        <Icon name="crown" size={compact ? 18 : 20} color={colors.primary} />
      </View>

      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={1}>
          {t('navigation.proFeaturesCta.title', { defaultValue: 'Get Pro Features' })}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {t('navigation.proFeaturesCta.subtitle', {
            defaultValue: 'All AI Features',
          })}
        </Text>
      </View>

      <Icon
        name="chevron-right"
        size={18}
        color={colors.textMuted}
        strokeWidth={2}
        style={I18nManager.isRTL ? styles.flipped : null}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  cardCompact: {
    minHeight: 54,
    paddingVertical: 8,
  },
  pressed: {
    backgroundColor: colors.surfaceElevated,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceInset,
  },
  iconTileCompact: {
    width: 34,
    height: 34,
    borderRadius: 11,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 17,
  },
  flipped: {
    transform: [{ scaleX: -1 }],
  },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import { useTranslation } from 'react-i18next';

import SvgIcon from '../SvgIcon';
import { colors } from '../../styles/colors';

export default function SidebarProFeaturesButton({ onPress, style, compact = false }) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, style, pressed && styles.pressed]}
      android_ripple={{ color: 'rgba(59,130,246,0.18)' }}
      accessibilityRole="button"
      accessibilityLabel={t('navigation.proFeatures', { defaultValue: 'Pro features' })}
    >
      <View style={styles.card}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(59,130,246,0.16)', 'rgba(15,23,42,0.0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={[styles.row, compact && styles.rowCompact]}>
          <View style={[styles.iconWrap, compact && styles.iconWrapCompact]}>
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(59,130,246,0.18)', 'rgba(59,130,246,0.04)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <SvgIcon name="stars" size={compact ? 18 : 20} color={colors.primary} />
          </View>

          <View style={styles.textCol}>
            <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={1}>
              {t('navigation.proFeaturesCta.title', { defaultValue: 'Get Pro Features' })}
            </Text>
            <Text style={[styles.subtitle, compact && styles.subtitleCompact]} numberOfLines={1}>
              {t('navigation.proFeaturesCta.subtitle', {
                defaultValue: 'All AI Features',
              })}
            </Text>
          </View>

          <View style={[styles.arrowWrap, compact && styles.arrowWrapCompact]} accessibilityElementsHidden>
            <Svg width={20} height={20} viewBox="0 -960 960 960" fill="none">
              <Path
                d="m321-80-71-71 329-329-329-329 71-71 400 400L321-80Z"
                fill="#B7B7B7"
              />
            </Svg>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const RADIUS = 16;

const styles = StyleSheet.create({
  wrap: {
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  card: {
    borderRadius: RADIUS,
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  rowCompact: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#242424',
    overflow: 'hidden',
  },
  iconWrapCompact: {
    width: 34,
    height: 34,
    borderRadius: 11,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 2,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontFamily: 'Lato-Bold',
    letterSpacing: 0.6,
  },
  titleCompact: {
    fontSize: 12,
  },
  subtitle: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: 'Lato-Regular',
  },
  subtitleCompact: {
    marginTop: 3,
    fontSize: 10,
  },
  arrowWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowWrapCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});

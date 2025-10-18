import React from 'react';
import { Pressable, StyleSheet, View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import HeroVideo from './HeroVideo';

const SidebarCreativeStudioBanner = ({ onPress, style, restartKey }) => {
  const { t } = useTranslation();

  
  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        style,
        pressed && styles.pressed,
      ]}
      android_ripple={{ color: '#ffffff20' }}
      onPress={onPress}
    >
      <View style={styles.inner}>
        <HeroVideo style={styles.heroVideo} restartKey={restartKey} />
        <View style={styles.overlay} />
        <View style={styles.content}>
          <View style={styles.textColumn}>
            {/* <Text style={styles.label}>
              {t('drawerStudioBanner.label', { defaultValue: 'Studio' }).toUpperCase()}
            </Text> */}
            <Text style={styles.title}>
              {t('drawerStudioBanner.title', { defaultValue: 'IMAGE STUDIO' })}
            </Text>
            <Text style={styles.subtitle}>
              {t('drawerStudioBanner.subtitle', { defaultValue: 'Generate, refine, and publish visual assets in one place.' })}
            </Text>
          </View>
          <View style={styles.ctaRow}>
            <View style={styles.cta}>
              <Text style={styles.ctaLabel}>
                {t('drawerStudioBanner.cta', { defaultValue: 'Open' })}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 12,
    alignSelf: 'stretch',
  },
  pressed: {
    opacity: 0.94,
  },
  inner: {
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 120,
    justifyContent: 'center',
  },
  heroVideo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 11, 24, 0.52)',
  },
  content: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    width: '100%',
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  textColumn: {
    flex: 1,
    gap: 8,
    maxWidth: '68%',
    marginTop: 8,
  },
  label: {
    color: 'rgba(229,231,235,0.64)',
    fontSize: 12,
    fontFamily: 'Lato-Bold',
    letterSpacing: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Lato-Bold',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(209,213,219,0.92)',
    fontFamily: 'Lato-Regular',
    lineHeight: 16,
    maxWidth: '80%',
  },
  ctaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  cta: {
    marginTop: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,

  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Lato-Bold',
    letterSpacing: 0.5,
  },
});

export default SidebarCreativeStudioBanner;

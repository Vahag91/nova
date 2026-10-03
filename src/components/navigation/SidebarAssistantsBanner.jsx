import React from 'react';
import { Image, Pressable, StyleSheet, View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import HeroVideo from './HeroVideo';

const DRAWER_BANNER_IMAGE = require('../../../assets/images/createstudio/banana.png');

const SidebarAssistantsBanner = ({
  onPress,
  style,
  restartKey,
  compact = false,
  playVideo = false,
}) => {
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
      accessibilityRole="button"
      accessibilityLabel={t('assistants.selectAssistant')}
      testID="sidebar-assistants-banner"
    >
      <View style={[styles.inner, compact && styles.innerCompact]}>
        {playVideo ? (
          <HeroVideo style={styles.heroVideo} restartKey={restartKey} enforceAspectRatio={false} />
        ) : (
          <Image
            source={DRAWER_BANNER_IMAGE}
            style={styles.heroVideo}
            resizeMode="cover"
          />
        )}
        <View style={styles.overlay} />
        <View style={[styles.content, compact && styles.contentCompact]}>
          <View style={[styles.textColumn, compact && styles.textColumnCompact]}>
            <Text style={[styles.label, compact && styles.labelCompact]}>
              {t('assistants.title').toUpperCase()}
            </Text>
            <Text style={[styles.subtitle, compact && styles.subtitleCompact]} numberOfLines={compact ? 2 : 3}>
              {t('assistants.subtitle')}
            </Text>
          </View>
          <View style={styles.ctaRow}>
            <View style={[styles.cta, compact && styles.ctaCompact]}>
              <Text style={[styles.ctaLabel, compact && styles.ctaLabelCompact]}>
                {t('assistants.selectAssistant')}
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
  innerCompact: {
    minHeight: 96,
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
  contentCompact: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  textColumn: {
    flex: 1,
    gap: 8,
    maxWidth: '100%',
    marginTop: 8,
  },
  textColumnCompact: {
    gap: 6,
    maxWidth: '100%',
    marginTop: 6,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Lato-Bold',
    letterSpacing: 2,
  },
  labelCompact: {
    fontSize: 12,
    letterSpacing: 1.6,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Lato-Bold',
    letterSpacing: 0.3,
    opacity: 1,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(209,213,219,0.92)',
    fontFamily: 'Lato-Regular',
    lineHeight: 16,
    maxWidth: '100%',
  },
  subtitleCompact: {
    fontSize: 11,
    lineHeight: 14,
    maxWidth: '100%',
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
  ctaCompact: {
    marginTop: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ctaLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Lato-Bold',
    letterSpacing: 0.5,
  },
  ctaLabelCompact: {
    fontSize: 11,
  },
});

export default SidebarAssistantsBanner;

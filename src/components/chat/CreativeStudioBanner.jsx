import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import HeroVideo from '../navigation/HeroVideo';

const BACKGROUND_VIDEO = require('../../../assets/video/backgroundVideo.mp4');

const CreativeStudioBanner = ({ onPress, style }) => {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const [restartKey, setRestartKey] = useState(0);

  useEffect(() => {
    if (isFocused) {
      setRestartKey(prev => prev + 1);
    }
  }, [isFocused]);

  return (
    <View style={[styles.wrapper, style]}>
      <Pressable
        style={({ pressed }) => [
          styles.pressable,
          pressed && styles.pressablePressed,
        ]}
        android_ripple={{ color: '#ffffff20' }}
        onPress={onPress}
      >
        <View style={styles.inner}>
          <HeroVideo
            style={styles.video}
            source={BACKGROUND_VIDEO}
            restartKey={restartKey}
            enforceAspectRatio={false}
            placeholderColor="#0B1020"
          />
         <View style={styles.overlay} />
          <View style={styles.content}>
            <View style={styles.textBlock}>
              <Text style={styles.label}>
                {t('chat.studioBanner.label', { defaultValue: 'Image Studio' }).toUpperCase()}
              </Text>
              <Text style={styles.title}>
                {t('chat.studioBanner.title', { defaultValue: 'Design visuals at speed.' })}
              </Text>
            </View>
            <View style={styles.cta}>
              <Text style={styles.ctaText}>
                {t('chat.studioBanner.open', { defaultValue: 'Open' })}
              </Text>
              <View style={styles.ctaIcon}>
                <Text style={styles.ctaIconText}>›</Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { width: '100%', borderRadius: 22, overflow: 'hidden', marginBottom: 16 },
  pressable: { borderRadius: 22, overflow: 'hidden' },
  pressablePressed: { opacity: 0.94 },
  inner: { borderRadius: 22, overflow: 'hidden', minHeight: 190, justifyContent: 'center' },
  video: { ...StyleSheet.absoluteFillObject },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(9, 12, 28, 0.58)' },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 18,
  },
  textBlock: { gap: 10, maxWidth: '80%' },
  label: { color: 'rgba(229,231,235,0.7)', fontSize: 12, fontFamily: 'Lato-Bold', letterSpacing: 2 },
  title: { color: '#FFFFFF', fontSize: 24, fontFamily: 'Lato-Bold', letterSpacing: 0.2 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    gap: 10,
  },
  ctaText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Lato-Bold', letterSpacing: 0.5 },
  ctaIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  ctaIconText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Lato-Bold' },
});

export default CreativeStudioBanner;

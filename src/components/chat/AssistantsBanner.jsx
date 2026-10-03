import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState, memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import HeroVideo from '../navigation/HeroVideo';

const BACKGROUND_VIDEO = require('../../../assets/video/backgroundVideo.mp4');

const AssistantsBanner = forwardRef(({
  onPress,
  style,
  paused = false,
  playVideo = true,
}, forwardedRef) => {
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const [restartKey, setRestartKey] = useState(0);
  const videoRef = useRef(null);

  useImperativeHandle(forwardedRef, () => ({
    pause: () => videoRef.current?.pause?.(),
    resume: () => videoRef.current?.resume?.(),
  }), []);

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
        accessibilityRole="button"
        accessibilityLabel={t('assistants.selectAssistant')}
        testID="chat-assistants-banner"
      >
        <View style={styles.inner}>
          {playVideo ? (
            <HeroVideo
              ref={videoRef}
              style={styles.video}
              source={BACKGROUND_VIDEO}
              restartKey={restartKey}
              enforceAspectRatio={false}
              paused={paused}
              placeholderColor="#0B1020"
            />
          ) : null}
          <View style={styles.overlay} />
          <View style={styles.content}>
            <View style={styles.textBlock}>
              <Text style={styles.label}>
                CLOUD AI
              </Text>
              <Text style={styles.title}>
                {t('assistants.title')}
              </Text>
              <Text style={styles.subtitle}>
                {t('assistants.subtitle')}
              </Text>
            </View>
            <View style={styles.cta}>
              <Text style={styles.ctaText}>
                {t('assistants.selectAssistant')}
              </Text>
              <View style={styles.ctaIcon}>
                <Text style={styles.ctaIconText}>{'>'}</Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
  },
  pressable: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  pressablePressed: {
    opacity: 0.94,
  },
  inner: {
    borderRadius: 20,
    overflow: 'hidden',
    minHeight: 171,
    justifyContent: 'center',
    backgroundColor: '#0B1020',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 12, 28, 0.58)',
  },
  content: {
    paddingHorizontal: 22,
    paddingVertical: 22,
    gap: 16,
  },
  textBlock: {
    gap: 9,
    maxWidth: '80%',
  },
  label: {
    color: 'rgba(229,231,235,0.7)',
    fontSize: 14,
    fontFamily: 'Lato-Bold',
    letterSpacing: 0.2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'Lato-Bold',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: 'rgba(229,231,235,0.78)',
    fontSize: 13,
    fontFamily: 'Lato-Regular',
    lineHeight: 18,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 13,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    gap: 9,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Lato-Bold',
    letterSpacing: 0.5,
  },
  ctaIcon: {
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaIconText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Lato-Bold',
  },
});

export default memo(
  AssistantsBanner,
  (prevProps, nextProps) =>
    prevProps.paused === nextProps.paused &&
    prevProps.playVideo === nextProps.playVideo &&
    prevProps.style === nextProps.style &&
    prevProps.onPress === nextProps.onPress,
);

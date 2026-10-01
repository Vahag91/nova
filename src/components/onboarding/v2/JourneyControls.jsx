import React from 'react';
import {
  Animated,
  I18nManager,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

export function JourneyHeader({
  animationController,
  isAnimating,
  onBackClick,
}) {
  const { t } = useTranslation();
  const { top } = useSafeAreaInsets();
  const translateY = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.8],
    outputRange: [-(top + 60), 0, 0],
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.header, { paddingTop: top, transform: [{ translateY }] }]}
    >
      <TouchableOpacity
        accessibilityLabel={t('onboarding.v3.controls.back')}
        accessibilityRole="button"
        activeOpacity={0.72}
        disabled={isAnimating}
        onPress={onBackClick}
        style={styles.backButton}
      >
        <Svg width="22" height="22" viewBox="0 0 24 24">
          <Path
            d="M15.5 5 8.5 12l7 7"
            fill="none"
            stroke="#F7F4EE"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            transform={I18nManager.isRTL ? 'translate(24 0) scale(-1 1)' : undefined}
          />
        </Svg>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function JourneyFooter({
  animationController,
  isAnimating,
  onNextClick,
  step,
}) {
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const copy = (key, defaultValue) =>
    t(`onboarding.v3.${key}`, { defaultValue });
  const translateY = animationController.current.interpolate({
    inputRange: [0, 0.16, 0.2, 0.8],
    outputRange: [150, 150, 0, 0],
  });
  const label = copy('controls.continue', 'Continue');

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.footer, { transform: [{ translateY }] }]}
    >
      <LinearGradient
        colors={['rgba(5,7,10,0)', '#05070A', '#05070A']}
        locations={[0, 0.3, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.progress}>
        {[0, 1, 2].map(index => (
          <View
            key={index}
            style={[
              styles.progressDot,
              index === step && styles.progressDotCurrent,
              index < step && styles.progressDotComplete,
            ]}
          />
        ))}
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.9}
        disabled={isAnimating}
        onPress={onNextClick}
        style={[
          styles.cta,
          isAnimating && styles.disabled,
          { marginBottom: Math.max(bottom + 14, 22) },
        ]}
      >
        <Text style={styles.ctaText}>{label}</Text>
        <Text style={styles.arrow}>{I18nManager.isRTL ? '←' : '→'}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 8,
    height: 92,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(5,7,10,0.42)',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 8,
    minHeight: 122,
    justifyContent: 'flex-end',
    paddingHorizontal: 22,
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 13,
  },
  progressDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(245,242,236,0.25)',
  },
  progressDotCurrent: { width: 22, backgroundColor: '#F4F0E8' },
  progressDotComplete: { backgroundColor: 'rgba(245,242,236,0.62)' },
  cta: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 28,
    backgroundColor: '#F4F0E8',
  },
  ctaText: {
    color: '#090B0E',
    fontFamily: 'Lato-Bold',
    fontSize: 16,
  },
  arrow: { color: '#090B0E', fontSize: 20, lineHeight: 21 },
  disabled: { opacity: 0.5 },
});

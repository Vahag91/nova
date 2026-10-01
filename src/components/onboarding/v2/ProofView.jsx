import React from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTranslation } from 'react-i18next';

import ExperienceIcon from './ExperienceIcon';

const HERO = require('../../../../assets/images/onboarding/onboarding-editorial-hero-v3.png');

const CAPABILITIES = [
  {
    icon: 'ask',
    title: 'Ask anything',
    subtitle: 'Advanced models for clear, useful answers',
  },
  {
    icon: 'create',
    title: 'Create images',
    subtitle: 'Turn an idea into something you can see',
  },
  {
    icon: 'sparkle',
    title: 'Get expert help',
    subtitle: 'Assistants for work and everyday life',
  },
];

export default function ProofView({ animationController, isAnimating }) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const compact = height < 740 || width < 360;
  const copy = (key, defaultValue) =>
    t(`onboarding.v3.${key}`, { defaultValue });
  const slideX = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8],
    outputRange: [width, width, 0, -width, -width],
  });

  return (
    <Animated.View
      renderToHardwareTextureAndroid={isAnimating}
      style={[styles.root, { transform: [{ translateX: slideX }] }]}
    >
      <Image
        resizeMode="cover"
        source={HERO}
        style={[styles.hero, compact && styles.heroCompact]}
      />
      <LinearGradient
        colors={[
          'rgba(5,7,10,0.06)',
          'rgba(5,7,10,0.18)',
          'rgba(5,7,10,0.9)',
          '#05070A',
        ]}
        locations={[0, 0.34, 0.58, 0.72]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={[styles.content, compact && styles.contentCompact]}>
        <Text style={styles.overline}>
          {copy('proof.overline', 'ALL IN ONE PLACE')}
        </Text>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          numberOfLines={3}
          style={[styles.title, compact && styles.titleCompact]}
        >
          {copy('proof.title', 'One place. More possibilities.')}
        </Text>
        <Text style={styles.subtitle}>
          {copy(
            'proof.subtitle',
            'Move from question to creation without switching between apps.',
          )}
        </Text>

        <View style={styles.capabilities}>
          {CAPABILITIES.map((capability, index) => (
            <View key={capability.title}>
              <View style={styles.capability}>
                <View style={styles.icon}>
                  <ExperienceIcon
                    color="#F0ECE4"
                    name={capability.icon}
                    size={20}
                  />
                </View>
                <View style={styles.capabilityCopy}>
                  <Text style={styles.capabilityTitle}>
                    {copy(`proof.item${index + 1}.title`, capability.title)}
                  </Text>
                  <Text style={styles.capabilitySubtitle}>
                    {copy(
                      `proof.item${index + 1}.subtitle`,
                      capability.subtitle,
                    )}
                  </Text>
                </View>
              </View>
              {index < CAPABILITIES.length - 1 ? (
                <View style={styles.rule} />
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#05070A',
  },
  hero: {
    position: 'absolute',
    top: -95,
    left: -24,
    right: -24,
    width: '112%',
    height: '72%',
  },
  heroCompact: { top: -80, height: '68%' },
  content: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 124,
    alignItems: 'center',
  },
  contentCompact: { left: 20, right: 20, bottom: 112 },
  overline: {
    color: '#C7C9D2',
    fontFamily: 'Lato-Bold',
    fontSize: 10,
    letterSpacing: 2.4,
    textAlign: 'center',
  },
  title: {
    maxWidth: 390,
    marginTop: 9,
    color: '#FAF9F6',
    fontFamily: 'Lato-Bold',
    fontSize: 32,
    lineHeight: 37,
    letterSpacing: -1,
    textAlign: 'center',
  },
  titleCompact: { fontSize: 28, lineHeight: 33 },
  subtitle: {
    maxWidth: 370,
    marginTop: 9,
    color: '#A9AAB3',
    fontFamily: 'Lato-Regular',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  capabilities: {
    width: '100%',
    maxWidth: 420,
    marginTop: 18,
  },
  capability: {
    minHeight: 57,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  icon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  capabilityCopy: { flex: 1, marginLeft: 13 },
  capabilityTitle: {
    color: '#F5F2EC',
    fontFamily: 'Lato-Bold',
    fontSize: 15,
  },
  capabilitySubtitle: {
    marginTop: 3,
    color: '#90939D',
    fontFamily: 'Lato-Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 51,
    backgroundColor: 'rgba(255,255,255,0.11)',
  },
});

import React, { useEffect } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Reanimated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import Svg, { Path } from 'react-native-svg';

function Bell({ size = 96, color = '#F4F0E8' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2.5a1.4 1.4 0 0 1 1.4 1.4v.9a6 6 0 0 1 4.6 5.83v3.11l1.4 2.42a.9.9 0 0 1-.78 1.34H5.38a.9.9 0 0 1-.78-1.34L6 13.74v-3.1a6 6 0 0 1 4.6-5.84v-.9A1.4 1.4 0 0 1 12 2.5Z"
        fill={color}
      />
      <Path
        d="M9.7 19.4h4.6a2.3 2.3 0 0 1-4.6 0Z"
        fill={color}
      />
    </Svg>
  );
}

/**
 * Trial reminder promise. Removing the fear of a surprise charge is the single
 * biggest lever the high-converting funnels use before showing a price.
 */
export default function OutcomeView({ animationController, isAnimating }) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = height < 740;
  const copy = (key, defaultValue) =>
    t(`onboarding.v3.${key}`, { defaultValue });

  const slideX = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.4, 0.8],
    outputRange: [0, 0, -width, -width],
  });

  // The bell rocks gently, the way a notification would nudge you.
  const tilt = useSharedValue(0);
  useEffect(() => {
    tilt.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(-1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(tilt);
  }, [tilt]);

  const bellStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${tilt.value * 7}deg` }],
  }));

  return (
    <Animated.View
      renderToHardwareTextureAndroid={isAnimating}
      style={[styles.root, { transform: [{ translateX: slideX }] }]}
    >
      <View style={[styles.body, { paddingTop: insets.top + 64 }]}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          numberOfLines={3}
          style={[styles.title, compact && styles.titleCompact]}
        >
          {copy(
            'reminder.title',
            "We'll remind you before your free trial ends",
          )}
        </Text>

        <View style={styles.bellStage}>
          <View style={styles.bellDisc}>
            <Reanimated.View style={bellStyle}>
              <Bell size={104} />
            </Reanimated.View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>1</Text>
            </View>
          </View>
        </View>

        <Text style={styles.note}>
          {copy(
            'reminder.note',
            'A heads-up arrives well before anything is charged, so nothing catches you by surprise.',
          )}
        </Text>
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
  body: {
    flex: 1,
    paddingHorizontal: 26,
    alignItems: 'center',
  },
  title: {
    maxWidth: 400,
    color: '#FAF9F6',
    fontFamily: 'Lato-Bold',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.9,
    textAlign: 'center',
  },
  titleCompact: { fontSize: 26, lineHeight: 31 },
  bellStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -30,
  },
  bellDisc: {
    width: 176,
    height: 176,
    borderRadius: 88,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244,240,232,0.05)',
  },
  badge: {
    position: 'absolute',
    top: 22,
    right: 20,
    minWidth: 30,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5484D',
  },
  badgeText: {
    color: '#FFFFFF',
    fontFamily: 'Lato-Bold',
    fontSize: 15,
  },
  note: {
    maxWidth: 360,
    marginBottom: 150,
    color: '#8A8F99',
    fontFamily: 'Lato-Regular',
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
});

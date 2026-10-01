/** Shared building blocks for the workspace onboarding (v4). */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { HAPTIC, haptic } from './haptics';
import { FONT } from './theme';

export function Gradient({ colors, style, children, start, end }) {
  return (
    <LinearGradient
      colors={colors}
      start={start || { x: 0, y: 0 }}
      end={end || { x: 1, y: 1 }}
      style={style}
    >
      {children}
    </LinearGradient>
  );
}

// The active pill grows with scaleX rather than width so the whole progress
// row stays on the native driver, like every other transition in the flow.
const DOT_WIDTH = 7;
const DOT_ACTIVE_SCALE = 22 / DOT_WIDTH;

function ProgressDot({ active, theme }) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [active, progress]);

  return (
    <View style={styles.dotSlot}>
      <View style={[styles.dot, { backgroundColor: theme.progressInactive }]} />
      <Animated.View
        style={[
          styles.dot,
          styles.dotOverlay,
          {
            backgroundColor: theme.progressActive,
            opacity: progress,
            transform: [
              {
                scaleX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, DOT_ACTIVE_SCALE],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

export function PageDots({ count, active, theme }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: count }).map((_, i) => (
        <ProgressDot key={i} active={i === active} theme={theme} />
      ))}
    </View>
  );
}

export function PrimaryButton({
  title,
  titleKey,
  onPress,
  theme,
  disabled,
  style,
  hapticType = HAPTIC.advance,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const spring = to =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 26,
      bounciness: 5,
    }).start();

  const handlePress = () => {
    if (disabled) return;
    if (hapticType) haptic(hapticType);
    onPress?.();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={disabled ? undefined : handlePress}
        onPressIn={() => !disabled && spring(0.97)}
        onPressOut={() => spring(1)}
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
      >
        <Gradient
          colors={theme.buttonFill}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
        >
          <FadeSwapText
            duration={190}
            style={styles.primaryButtonText}
            swapKey={titleKey}
          >
            {title}
          </FadeSwapText>
        </Gradient>
      </Pressable>
    </Animated.View>
  );
}

export function CircleIconButton({ label, accessibilityLabel, onPress, theme }) {
  const handlePress = () => {
    haptic(HAPTIC.select);
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={10}
      style={[styles.circleBtn, { backgroundColor: theme.controlFill }]}
    >
      <Text style={[styles.circleBtnLabel, { color: theme.primaryText }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Swaps its text by fading out, exchanging the string, then fading back in, so
 * status copy that changes on a timer never snaps between words.
 */
export function FadeSwapText({ children, style, duration = 220, swapKey }) {
  // Without a key every text change fades. With one, only a change of key does,
  // so a label that merely recounts itself - "Continue (1)" to "Continue (2)" -
  // still answers the tap instantly.
  const key = swapKey === undefined ? children : swapKey;
  const [shown, setShown] = useState(children);
  const shownKeyRef = useRef(key);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (key === shownKeyRef.current) {
      setShown(children);
      return undefined;
    }

    const fadeOutMs = Math.round(duration * 0.45);
    const fadeOut = Animated.timing(opacity, {
      toValue: 0,
      duration: fadeOutMs,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    fadeOut.start();

    // The swap is driven by a timer rather than the animation's end callback:
    // an interrupted animation reports finished=false, which would leave the
    // text stranded at zero opacity showing the string it was replacing.
    const swapTimer = setTimeout(() => {
      shownKeyRef.current = key;
      setShown(children);
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, fadeOutMs);

    return () => {
      clearTimeout(swapTimer);
      fadeOut.stop();
    };
  }, [children, duration, key, opacity]);

  return <Animated.Text style={[style, { opacity }]}>{shown}</Animated.Text>;
}

/** Fades and slides content in on mount, mirroring the staggered iOS appear. */
export function AppearIn({ delay = 0, children, style, offset = 16 }) {
  const p = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(p, {
      toValue: 1,
      duration: 460,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, p]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: p,
          transform: [
            {
              translateY: p.interpolate({
                inputRange: [0, 1],
                outputRange: [offset, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dotsRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 14 },
  dotSlot: {
    width: 26,
    height: DOT_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: DOT_WIDTH, height: DOT_WIDTH, borderRadius: 4 },
  dotOverlay: { position: 'absolute' },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: { opacity: 0.58 },
  primaryButtonText: { color: '#fff', fontSize: 18, fontFamily: FONT.bold },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtnLabel: { fontSize: 18, lineHeight: 20 },
});

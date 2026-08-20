import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import MyPressable from './MyPressable';

const AnimatedLabel = ({ children }) => {
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [entrance]);

  return (
    <Animated.Text
      style={[
        styles.label,
        {
          opacity: entrance,
          transform: [
            {
              scale: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [0.9, 1],
              }),
            },
          ],
        },
      ]}>
      {children}
    </Animated.Text>
  );
};

const NextButtonArrow = ({ onBtnPress, phase, isAnimating = false }) => {
  const { t } = useTranslation();

  const continueLabel = t('onboarding.buttons.continue', { defaultValue: 'Continue' });
  const startLabel = t('onboarding.buttons.start', { defaultValue: "Let's start" });
  const label = phase === 2 ? startLabel : phase === 1 ? continueLabel : null;

  // Only render when we have a label
  if (!label) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <MyPressable
        onPress={isAnimating ? undefined : onBtnPress}
        android_ripple={{ color: 'darkgrey' }}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[
          styles.container,
          phase === 2 ? styles.startButton : styles.continueButton,
          isAnimating && styles.disabled,
        ]}
        disabled={isAnimating}
      >
        <View style={styles.centered}>
          <AnimatedLabel key={phase}>{label}</AnimatedLabel>
        </View>
      </MyPressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    height: 58,
    backgroundColor: 'rgb(21, 32, 54)',
    justifyContent: 'center',
    // subtle glow/shadow
    shadowColor: '#5252E0',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    borderRadius: 16,
  },
  continueButton: {
    width: 160,
  },
  startButton: {
    width: 220,
  },
  disabled: {
    opacity: 0.5,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'WorkSans-SemiBold',
  },
});

export default NextButtonArrow;

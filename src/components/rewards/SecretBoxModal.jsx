import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Dimensions, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import SvgIcon from '../SvgIcon';

const { width } = Dimensions.get('window');

// Note: PRIZE_TIERS will be created inside component to access translations

const AnimatedView = Animated.createAnimatedComponent(View);

// --- Particle Component ---
const Particle = ({ active, color, index, total }) => {
  const distance = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    if (!active) return;

    distance.value = 0;
    opacity.value = 1;
    scale.value = 0;

    const randomDist = 110 + Math.random() * 70;
    const randomDuration = 800 + Math.random() * 400;

    scale.value = withSpring(1);
    distance.value = withTiming(randomDist, {
      duration: randomDuration,
      easing: Easing.out(Easing.quad),
    });
    opacity.value = withDelay(
      380,
      withTiming(0, { duration: 550, easing: Easing.out(Easing.quad) })
    );
  }, [active]);

  const style = useAnimatedStyle(() => {
    const angle = (360 / total) * index;
    const rad = (angle * Math.PI) / 180;
    return {
      opacity: opacity.value,
      transform: [
        { translateX: distance.value * Math.cos(rad) },
        { translateY: distance.value * Math.sin(rad) },
        { scale: scale.value },
      ],
    };
  });

  return (
    <AnimatedView
      style={[
        styles.particle,
        { backgroundColor: color },
        style,
      ]}
    />
  );
};

export const SecretBoxModal = ({ visible, isSpinning, finalResult, onClose }) => {
  const { t } = useTranslation();
  
  // Prize tiers - always in English (not localized)
  const PRIZE_TIERS = [
    {
      id: 'common',
      label: 'LUCKY',
      credits: 1000,
      colors: ['#F59E0B', '#B45309'], // Amber
      accent: '#FBBF24',
      icon: 'coin',
    },
    {
      id: 'rare',
      label: 'PRO',
      credits: 2000,
      colors: ['#3B82F6', '#1E40AF'], // Blue
      accent: '#60A5FA',
      icon: 'stars',
    },
    {
      id: 'epic',
      label: 'ELITE',
      credits: 3000,
      colors: ['#EC4899', '#BE185D'], // Pink
      accent: '#F472B6',
      icon: 'trophy',
    },
    {
      id: 'mythic',
      label: 'MYTHIC',
      credits: 5000,
      colors: ['#10B981', '#047857'], // Emerald
      accent: '#34D399',
      icon: 'diamond',
    },
  ];
  
  const [currentPrize, setCurrentPrize] = useState(PRIZE_TIERS[0]);
  const [isFinished, setIsFinished] = useState(false);

  // Motion
  const modalOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.94);
  const glowRotation = useSharedValue(0);
  const reelScale = useSharedValue(1);
  const flashOpacity = useSharedValue(0);

  // Logic
  const intervalRef = useRef(null);
  const counterRef = useRef(0);

  // --- Open / Close ---
  useEffect(() => {
    if (visible) {
      setIsFinished(false);

      modalOpacity.value = withTiming(1, { duration: 220 });
      cardScale.value = withSpring(1, { damping: 16, stiffness: 220 });

      glowRotation.value = withRepeat(
        withTiming(360, { duration: 3200, easing: Easing.linear }),
        -1
      );

      if (isSpinning) {
        startSpinning();
      }
    } else {
      modalOpacity.value = withTiming(0, { duration: 200 });
      cardScale.value = withTiming(0.94, { duration: 200 });
      stopInterval();
    }

    return () => {
      stopInterval();
    };
  }, [visible, isSpinning]);

  // --- React to result from backend ---
  useEffect(() => {
    if (visible && !isSpinning && finalResult) {
      beginDeceleration(finalResult);
    }
  }, [visible, isSpinning, finalResult]);

  const stopInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // --- Spin Logic ---
  const startSpinning = () => {
    stopInterval();

    intervalRef.current = setInterval(() => {
      counterRef.current = (counterRef.current + 1) % PRIZE_TIERS.length;
      setCurrentPrize(PRIZE_TIERS[counterRef.current]);

      // Tiny mechanical pulse
      reelScale.value = 1.04;
      reelScale.value = withTiming(1, { duration: 90 });
    }, 90);
  };

  const beginDeceleration = (result) => {
    stopInterval();

    let ticksLeft = 7;
    const targetPrizeIndex = PRIZE_TIERS.findIndex(
      (p) => p.credits === result.credits
    );
    const safeIndex = targetPrizeIndex === -1 ? 0 : targetPrizeIndex;

    const tick = (delay) => {
      if (ticksLeft <= 0) {
        setCurrentPrize(PRIZE_TIERS[safeIndex]);
        triggerWinSequence();
        return;
      }

      if (ticksLeft === 1) {
        setCurrentPrize(PRIZE_TIERS[safeIndex]);
      } else {
        counterRef.current = (counterRef.current + 1) % PRIZE_TIERS.length;
        setCurrentPrize(PRIZE_TIERS[counterRef.current]);
        reelScale.value = 1.06;
        reelScale.value = withTiming(1, { duration: 110 });
      }

      ticksLeft--;
      setTimeout(() => tick(delay * 1.4), delay);
    };

    tick(100);
  };

  const triggerWinSequence = () => {
    setIsFinished(true);

    // Flash
    flashOpacity.value = withSequence(
      withTiming(0.8, { duration: 60 }),
      withTiming(0, { duration: 480 })
    );

    // Pop
    reelScale.value = withSequence(
      withSpring(1.16, { damping: 12, stiffness: 230 }),
      withSpring(1, { damping: 15, stiffness: 200 })
    );
  };

  const handleClose = () => {
    if (!isFinished) return;
    modalOpacity.value = withTiming(0, { duration: 180 });
    cardScale.value = withTiming(0.94, { duration: 180 }, () => {
      if (onClose) {
        runOnJS(onClose)();
      }
    });
  };

  // --- Animated styles ---
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
    transform: [{ scale: cardScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${glowRotation.value}deg` }],
  }));

  const reelStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reelScale.value }],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  if (!visible) return null;

  const prize = currentPrize;
  const formattedCredits =
    typeof prize.credits === 'number'
      ? `+${prize.credits.toLocaleString('fr-FR')}` // "5 000"
      : '+0';

  return (
    <Modal
      transparent
      visible={visible}
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <AnimatedView style={[styles.backdrop, backdropStyle]} />

        {/* Outer frame */}
        <LinearGradient
          colors={[
            'rgba(15,23,42,0.9)',
            'rgba(2,6,23,1)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.frame}
        >
          <AnimatedView style={[styles.card, cardStyle]}>
            {/* Background glow */}
            <View style={styles.cardBg}>
              <AnimatedView style={[styles.glowContainer, glowStyle]}>
                <LinearGradient
                  colors={[prize.colors[0], 'transparent']}
                  style={styles.glow}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              </AnimatedView>
              <View style={styles.bgVignette} />
            </View>

            {/* Particles on win */}
            {isFinished && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {Array.from({ length: 22 }).map((_, i) => (
                  <Particle
                    key={i}
                    active={isFinished}
                    index={i}
                    total={22}
                    color={prize.accent}
                  />
                ))}
              </View>
            )}

            {/* Content */}
            <View style={styles.contentContainer}>
              {/* Small pill label */}
              <View style={styles.pill}>
                <SvgIcon name="gift-finder" size={14} color="#E5E7EB" />
                <Text style={styles.pillText}>{t('rewards.modals.secretBox.pill')}</Text>
              </View>

              <Text style={styles.eyebrow}>
                {isFinished ? t('rewards.modals.secretBox.rewardUnlocked') : t('rewards.modals.secretBox.shufflingRewards')}
              </Text>

              {/* Reel */}
              <AnimatedView style={[styles.reelContainer, reelStyle]}>
                {/* Halo */}
                <View style={styles.haloContainer}>
                  <LinearGradient
                    colors={[prize.colors[0], 'rgba(0,0,0,0)']}
                    style={styles.haloGradient}
                  />
                </View>

                {/* Icon */}
                <LinearGradient
                  colors={['#020617', '#020617']}
                  style={styles.iconCircle}
                >
                  <View
                    style={[
                      styles.iconRing,
                      { borderColor: prize.accent },
                    ]}
                  >
                    <SvgIcon name={prize.icon} size={40} color="#FFFFFF" />
                  </View>
                </LinearGradient>

                {/* Text */}
                <View style={styles.textStack}>
                  <Text
                    style={[styles.prizeLabel, { color: prize.accent }]}
                    numberOfLines={1}
                  >
                    {prize.label}
                  </Text>
                  <Text style={styles.creditsValue}>{formattedCredits}</Text>
                  {isFinished && (
                    <Text style={styles.subLabel}>
                      {t('rewards.modals.secretBox.imageCreditsAdded')}
                    </Text>
                  )}
                </View>
              </AnimatedView>

              {/* White flash overlay */}
              <AnimatedView
                style={[styles.flashOverlay, flashStyle]}
                pointerEvents="none"
              />

              {/* Button */}
              <Pressable
                onPress={isFinished ? handleClose : undefined}
                disabled={!isFinished}
                style={[
                  styles.buttonWrapper,
                  { opacity: isFinished ? 1 : 0.3 },
                ]}
              >
                <LinearGradient
                  colors={['#4F46E5', '#4338CA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.button,
                    !isFinished && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.buttonText}>
                    {isFinished ? t('rewards.modals.secretBox.continue') : t('rewards.modals.secretBox.revealing')}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>

            {/* Thin inner border for clean edge */}
            <View pointerEvents="none" style={styles.glassBorder} />
          </AnimatedView>
        </LinearGradient>
      </View>
    </Modal>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },

  frame: {
    width: width * 0.8,
    maxWidth: 360,
    borderRadius: 32,
    padding: 1, // tighter border so no weird edge
  },
  card: {
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: '#020617',
  },

  cardBg: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowContainer: {
    width: 520,
    height: 520,
    position: 'absolute',
  },
  glow: {
    flex: 1,
    opacity: 0.38,
  },
  bgVignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },

  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.9)',
  },

  contentContainer: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 14,
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.6)',
    marginTop: 4,
  },
  pillText: {
    fontSize: 11,
    color: '#E5E7EB',
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  eyebrow: {
    fontSize: 12,
    color: '#9CA3AF',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 8,
  },

  reelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 10,
  },
  haloContainer: {
    position: 'absolute',
    width: 210,
    height: 210,
    top: -22,
  },
  haloGradient: {
    flex: 1,
    borderRadius: 105,
    opacity: 0.28,
  },
  iconCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 10,
    marginBottom: 18,
  },
  iconRing: {
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020617',
  },

  textStack: {
    alignItems: 'center',
    gap: 6,
  },
  prizeLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  creditsValue: {
    fontSize: 38,
    fontWeight: '900',
    color: '#F9FAFB',
    letterSpacing: 1, // makes "5 000" sit nicely
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  subLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },

  buttonWrapper: {
    width: '100%',
    height: 52,
    marginTop: 8,
  },
  button: {
    flex: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#F9FAFB',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },

  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
    particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    left: '50%',
    top: '42%', // a bit lower so it radiates from the icon
  },
});
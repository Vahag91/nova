import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  withDelay, 
  withSequence,
  runOnJS,
  withRepeat,
  Easing
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import SvgIcon from '../SvgIcon';

const { width } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// --- 1. Compact Particle System ---
const Particle = ({ delay, angle }) => {
  const distance = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0);

  useEffect(() => {
    const randomDuration = 700 + Math.random() * 300;
    const randomDistance = 80 + Math.random() * 40; 
    
    scale.value = withDelay(delay, withSpring(1));
    distance.value = withDelay(delay, withTiming(randomDistance, { 
      duration: randomDuration,
      easing: Easing.out(Easing.quad) 
    }));
    opacity.value = withDelay(delay + 300, withTiming(0, { duration: 500 }));
  }, []);

  const style = useAnimatedStyle(() => {
    const rad = (angle * Math.PI) / 180;
    const x = distance.value * Math.cos(rad);
    const y = distance.value * Math.sin(rad);

    return {
      opacity: opacity.value,
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: scale.value },
        { rotate: `${angle}deg` }
      ],
    };
  });

  return (
    <Animated.View style={[styles.particleContainer, style]}>
      <View style={[
        styles.particle, 
        { backgroundColor: ['#FBBF24', '#34D399', '#60A5FA', '#F472B6'][Math.floor(Math.random() * 4)] }
      ]} />
    </Animated.View>
  );
};

// --- 2. Main Modal ---
export const RewardSuccessModal = ({ visible, reward, credits, error, isSecretBox, prizeLabel, onClose }) => {
  const { t } = useTranslation();
  const [showParticles, setShowParticles] = useState(false);
  const isError = !!error;

  // Animations
  const backdropOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.85);
  const cardOpacity = useSharedValue(0);
  const iconScale = useSharedValue(0);
  const iconShake = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(10);
  const buttonScale = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      setShowParticles(!isError); // Only show particles for success
      
      // Reset
      backdropOpacity.value = 0;
      cardScale.value = 0.85;
      cardOpacity.value = 0;
      iconScale.value = 0;
      iconShake.value = 0;
      contentOpacity.value = 0;
      contentTranslateY.value = 10;
      
      // Sequence
      backdropOpacity.value = withTiming(1, { duration: 300 });
      
      cardOpacity.value = withDelay(50, withTiming(1, { duration: 250 }));
      cardScale.value = withDelay(50, withSpring(1, { damping: 14, stiffness: 150 }));

      if (isError) {
        // Shake animation for error
        iconScale.value = withDelay(200, withSequence(
          withSpring(1.1, { damping: 8, stiffness: 200 }),
          withSpring(1, { damping: 10, stiffness: 150 })
        ));
        iconShake.value = withDelay(200, withSequence(
          withTiming(-10, { duration: 50 }),
          withTiming(10, { duration: 50 }),
          withTiming(-5, { duration: 50 }),
          withTiming(5, { duration: 50 }),
          withTiming(0, { duration: 50 })
        ));
      } else {
        iconScale.value = withDelay(200, withSpring(1, { damping: 10 }));
        iconShake.value = 0;
      }

      contentOpacity.value = withDelay(400, withTiming(1));
      contentTranslateY.value = withDelay(400, withSpring(0));
      
      buttonScale.value = withDelay(
        600,
        withRepeat(
          withSequence(
            withTiming(1.02, { duration: 1000 }),
            withTiming(1, { duration: 1000 })
          ),
          -1,
          true
        )
      );

    } else {
      setShowParticles(false);
      backdropOpacity.value = withTiming(0);
      cardOpacity.value = withTiming(0);
      cardScale.value = withTiming(0.9);
      iconShake.value = 0;
    }
  }, [visible, isError]);

  const handleClose = () => {
    backdropOpacity.value = withTiming(0, { duration: 200 });
    cardScale.value = withTiming(0.95, { duration: 150 });
    cardOpacity.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished && onClose) runOnJS(onClose)();
    });
  };

  const animatedStyles = {
    backdrop: useAnimatedStyle(() => ({ opacity: backdropOpacity.value })),
    card: useAnimatedStyle(() => ({
      transform: [{ scale: cardScale.value }],
      opacity: cardOpacity.value,
    })),
    icon: useAnimatedStyle(() => ({
      transform: [
        { scale: iconScale.value },
        ...(isError ? [{ translateX: iconShake.value }] : [])
      ],
    })),
    content: useAnimatedStyle(() => ({
      opacity: contentOpacity.value,
      transform: [{ translateY: contentTranslateY.value }],
    })),
    button: useAnimatedStyle(() => ({ transform: [{ scale: buttonScale.value }] })),
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <AnimatedPressable
          style={[styles.backdrop, animatedStyles.backdrop]}
          onPress={handleClose}
        />

        <Animated.View style={[
          styles.card, 
          animatedStyles.card,
          isError && styles.cardError
        ]}>
          {/* Subtle Top Border Gradient */}
          <LinearGradient 
            colors={isError 
              ? ['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0)']
              : ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0)']
            } 
            style={styles.cardBorderTop} 
          />

          {/* --- Icon Section --- */}
          <View style={styles.iconContainer}>
            {/* Particles */}
            {showParticles && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {[...Array(12)].map((_, i) => (
                  <Particle key={i} delay={200} angle={(360 / 12) * i} />
                ))}
              </View>
            )}

            {/* Icon Circle */}
            <Animated.View style={[styles.iconWrapper, animatedStyles.icon]}>
              <View style={styles.iconCircle}>
                <LinearGradient
                  colors={isError ? ['#EF4444', '#DC2626'] : ['#10B981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconGradient}
                />
                <View style={styles.iconCenter}>
                  <SvgIcon
                    name={isError ? 'close' : 'check-bold'}
                    size={32}
                    color="#FFFFFF"
                    style={styles.iconSvg}
                  />
                </View>
              </View>
            </Animated.View>
          </View>

          {/* --- Content --- */}
          <Animated.View style={[styles.content, animatedStyles.content]}>
            <Text style={[styles.eyebrow, isError && styles.eyebrowError]}>
              {isError ? t('rewards.modals.rewardSuccess.error') : t('rewards.modals.rewardSuccess.success')}
            </Text>
            {isSecretBox && prizeLabel ? (
              <>
                <Text style={styles.prizeLabel}>{prizeLabel}</Text>
                <Text style={styles.secretBoxCredits}>
                  {credits?.toLocaleString()} {t('rewards.modals.rewardSuccess.credits')}
                </Text>
              </>
            ) : (
              <Text style={styles.title}>
                {isError 
                  ? t('rewards.modals.rewardSuccess.somethingWentWrong')
                  : (reward?.title || t('rewards.modals.rewardSuccess.rewardUnlocked'))
                }
              </Text>
            )}

            <AnimatedPressable
              onPress={handleClose}
              style={[styles.buttonShadow, animatedStyles.button]}
            >
              <LinearGradient
                colors={isError ? ['#6B7280', '#4B5563'] : ['#4F46E5', '#4338CA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.button}
              >
                <Text style={styles.buttonText}>
                  {isError ? t('rewards.modals.rewardSuccess.close') : t('rewards.modals.rewardSuccess.okay')}
                </Text>
              </LinearGradient>
            </AnimatedPressable>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  card: {
    width: width * 0.75,
    maxWidth: 320,
    backgroundColor: '#18181B',
    borderRadius: 24,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  cardError: {
    borderColor: 'rgba(239, 68, 68, 0.2)',
    shadowColor: '#EF4444',
  },
  cardBorderTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1.5,
  },

  // Icon
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    zIndex: 10,
  },
  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#18181B',
    overflow: 'hidden',
  },
  iconGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  iconCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconSvg: {
    // Tiny visual nudge in case SVG path is slightly off-center
    transform: [{ translateY: 0.5 }],
  },

  // Particles
  particleContainer: {
    position: 'absolute',
  },
  particle: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Content
  content: {
    width: '100%',
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  eyebrowError: {
    color: '#EF4444',
  },
  title: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  prizeLabel: {
    fontSize: 26,
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  secretBoxCredits: {
    fontSize: 18,
    color: '#A78BFA',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 14,
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },

  // Button
  buttonShadow: {
    width: '100%',
    marginTop: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  button: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
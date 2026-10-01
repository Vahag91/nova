import React, { useEffect, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import LinearGradient from 'react-native-linear-gradient';

import SvgIcon from '../SvgIcon';
import { getDailyLoginRewardForStreakDay } from '../../lib/rewardsSchedule';

// Same palette as the v3 onboarding, so the reward reads as the same product
// rather than a bolted-on game popup.
const CREAM = '#F4F0E8';
const ON_CREAM = '#090B0E';
const SHEET = '#0B0D11';
const MUTED = '#8A8F99';
const HAIRLINE = 'rgba(255,255,255,0.09)';

const COIN_LIGHT = '#FBF8F2';
const COIN_DEEP = '#B4AEA1';

const CYCLE_DAYS = 7;
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const COUNT_MS = 620;
const CLAIM_SPIN_MS = 1100;
const CLAIM_HOLD_MS = 320;
const CLAIM_AUTO_CLOSE_MS = CLAIM_SPIN_MS + CLAIM_HOLD_MS;

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * Counts the reward up on claim. Driven through animatedProps so the digits
 * update on the UI thread instead of re-rendering the card every frame.
 */
function Amount({ value, animate }) {
  const shown = useSharedValue(animate ? 0 : value);

  useEffect(() => {
    if (!animate) {
      shown.value = value;
      return undefined;
    }
    shown.value = 0;
    shown.value = withTiming(value, {
      duration: COUNT_MS,
      easing: Easing.out(Easing.cubic),
    });
    return () => cancelAnimation(shown);
  }, [animate, shown, value]);

  const animatedProps = useAnimatedProps(() => ({
    text: `+${Math.round(shown.value)}`,
    defaultValue: `+${Math.round(shown.value)}`,
  }));

  return (
    <AnimatedTextInput
      animatedProps={animatedProps}
      editable={false}
      pointerEvents="none"
      style={styles.amount}
      underlineColorAndroid="transparent"
      value={`+${value}`}
    />
  );
}

/** A single hairline rail that fills to the current day. No dots, no chrome. */
function ProgressRail({ position, reduce }) {
  const fill = useSharedValue(reduce ? position / CYCLE_DAYS : 0);

  useEffect(() => {
    if (reduce) {
      fill.value = position / CYCLE_DAYS;
      return undefined;
    }
    fill.value = withDelay(
      260,
      withTiming(position / CYCLE_DAYS, { duration: 720, easing: EASE_OUT }),
    );
    return () => cancelAnimation(fill);
  }, [fill, position, reduce]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleX: fill.value }],
  }));

  return (
    <View>
      <View style={styles.rail}>
        <Animated.View style={[styles.railFill, style]} />
      </View>
      <View style={styles.ticks} pointerEvents="none">
        {Array.from({ length: CYCLE_DAYS }, (_, index) => (
          <View
            key={index}
            style={[styles.tick, index < position && styles.tickDone]}
          />
        ))}
      </View>
    </View>
  );
}

function Coin({ reduce, spin }) {
  const angle = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      angle.value = 0;
      return undefined;
    }
    angle.value = withRepeat(
      withTiming(360, { duration: 5200, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(angle);
  }, [angle, reduce]);

  // On claim it kicks into a fast spin, then eases back to the idle turn.
  useEffect(() => {
    if (!spin || reduce) return undefined;
    angle.value = 0;
    angle.value = withSequence(
      withTiming(1080, {
        duration: CLAIM_SPIN_MS,
        easing: Easing.out(Easing.cubic),
      }),
      withRepeat(
        withTiming(1440, { duration: 5200, easing: Easing.linear }),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(angle);
  }, [angle, reduce, spin]);

  const style = useAnimatedStyle(() => ({
    transform: [{ perspective: 640 }, { rotateY: `${angle.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.coin, style]}>
      <LinearGradient
        colors={[COIN_LIGHT, COIN_DEEP]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.coinFace}
      >
        <View style={styles.coinRim}>
          <SvgIcon name="coin" size={24} color="#2B2A26" />
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

/** Fades and lifts a block into place on its own beat. */
function Stagger({ children, delay, reduce, style }) {
  const enter = useSharedValue(reduce ? 1 : 0);

  useEffect(() => {
    if (reduce) {
      enter.value = 1;
      return undefined;
    }
    enter.value = withDelay(
      delay,
      withTiming(1, { duration: 420, easing: EASE_OUT }),
    );
    return () => cancelAnimation(enter);
  }, [delay, enter, reduce]);

  const animated = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 12 }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * The daily reward, surfaced on the main screen instead of buried in the
 * drawer. It is also the claim action: the streak only advances when the user
 * checks in here.
 */
export default function DailyCheckInModal({
  visible,
  currentStreak,
  claimed,
  claimedAmount,
  onCheckIn,
  onClose,
  reduceMotion = false,
}) {
  const { t } = useTranslation();
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);
  const reduce = reduceMotion || systemReduceMotion;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then(enabled => {
        if (!cancelled) setSystemReduceMotion(!!enabled);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      enabled => setSystemReduceMotion(!!enabled),
    );
    return () => {
      cancelled = true;
      sub?.remove?.();
    };
  }, []);

  const backdrop = useSharedValue(0);
  const sheet = useSharedValue(0);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  // Start this clock from the same `claimed` state that starts the amount and
  // coin animations. The sheet stays up through the full spin, holds the final
  // reward briefly, then `visible=false` drives the existing exit animation.
  useEffect(() => {
    if (!visible || !claimed) return undefined;
    const timer = setTimeout(
      () => onClose?.(),
      reduce ? CLAIM_HOLD_MS : CLAIM_AUTO_CLOSE_MS,
    );
    return () => clearTimeout(timer);
  }, [claimed, onClose, reduce, visible]);

  useEffect(() => {
    if (!mounted) return undefined;

    if (visible) {
      if (reduce) {
        backdrop.value = 1;
        sheet.value = 1;
        return undefined;
      }
      backdrop.value = withTiming(1, { duration: 240, easing: EASE_OUT });
      sheet.value = withDelay(
        40,
        withSpring(1, { damping: 17, stiffness: 165, mass: 0.85 }),
      );
      return undefined;
    }

    sheet.value = withTiming(0, { duration: 200, easing: EASE_OUT });
    backdrop.value = withTiming(0, { duration: 200 }, finished => {
      if (finished) runOnJS(setMounted)(false);
    });
    return undefined;
  }, [backdrop, mounted, reduce, sheet, visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, sheet.value * 1.6),
    transform: [
      { translateY: (1 - sheet.value) * 18 },
      { scale: 0.9 + sheet.value * 0.1 },
    ],
  }));

  const streakDay = Math.max(0, Number(currentStreak) || 0);
  const position = claimed
    ? ((Math.max(1, streakDay) - 1) % CYCLE_DAYS) + 1
    : (streakDay % CYCLE_DAYS) + 1;

  const reward = useMemo(
    () => getDailyLoginRewardForStreakDay(position),
    [position],
  );
  const amount = claimed ? claimedAmount || reward : reward;

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle]}>
          <Stagger delay={80} reduce={reduce} style={styles.headRow}>
            <Text style={styles.overline}>
              {t('rewards.streakTracker.dayLabel', { number: position })}
              <Text style={styles.overlineDim}>{`  /  ${CYCLE_DAYS}`}</Text>
            </Text>
            <Coin reduce={reduce} spin={claimed} />
          </Stagger>

          <Stagger delay={215} reduce={reduce}>
            <Amount animate={claimed && !reduce} value={amount} />
          </Stagger>

          <Stagger delay={280} reduce={reduce}>
          <Text style={styles.caption}>
            {claimed
              ? t('rewards.checkIn.claimed', {
                  amount,
                  defaultValue: 'Claimed! +{{amount}} coins',
                })
              : t('rewards.checkIn.subtitle', {
                  defaultValue: 'Come back every day for a bigger reward.',
                })}
          </Text>
          </Stagger>

          <Stagger delay={345} reduce={reduce}>
            <ProgressRail position={position} reduce={reduce} />
          </Stagger>

          {!claimed ? (
            <>
              <Pressable
                accessibilityRole="button"
                onPress={onCheckIn}
                style={({ pressed }) => [
                  styles.cta,
                  pressed && styles.ctaPressed,
                ]}
              >
                <Text style={styles.ctaText}>
                  {t('rewards.checkIn.cta', { defaultValue: 'Claim' })}
                </Text>
                <Text style={styles.ctaArrow}>{'→'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                style={({ pressed }) => [
                  styles.ghost,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.ghostText}>
                  {t('rewards.checkIn.later', { defaultValue: 'Later' })}
                </Text>
              </Pressable>
            </>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    width: '100%',
    maxWidth: 310,
    backgroundColor: SHEET,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coin: {
    width: 44,
    height: 44,
  },
  coinFace: {
    flex: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinRim: {
    width: 33,
    height: 33,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(43,42,38,0.28)',
  },
  overline: {
    color: CREAM,
    fontFamily: 'Lato-Bold',
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  overlineDim: {
    color: MUTED,
    letterSpacing: 2.4,
  },
  amount: {
    marginTop: 6,
    color: CREAM,
    fontFamily: 'Lato-Bold',
    fontSize: 46,
    letterSpacing: -2.2,
    // It is a TextInput under the hood; strip the platform chrome so it sits
    // exactly where the old Text did.
    padding: 0,
    margin: 0,
    textAlign: 'left',
    includeFontPadding: false,
  },
  caption: {
    marginTop: 2,
    color: MUTED,
    fontFamily: 'Lato-Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  rail: {
    height: 2,
    marginTop: 18,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  ticks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 7,
  },
  tick: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  tickDone: {
    backgroundColor: 'rgba(244,240,232,0.55)',
  },
  railFill: {
    height: 2,
    borderRadius: 1,
    backgroundColor: CREAM,
    transform: [{ scaleX: 0 }],
    // scaleX pivots from the centre by default; anchor the fill to the left.
    width: '100%',
    transformOrigin: 'left',
  },
  cta: {
    marginTop: 22,
    height: 50,
    borderRadius: 25,
    backgroundColor: CREAM,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  ctaText: {
    color: ON_CREAM,
    fontFamily: 'Lato-Bold',
    fontSize: 16,
  },
  ctaArrow: {
    color: ON_CREAM,
    fontSize: 18,
    lineHeight: 19,
  },
  ghost: {
    marginTop: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  ghostText: {
    color: MUTED,
    fontFamily: 'Lato-Regular',
    fontSize: 13,
  },
  pressed: {
    opacity: 0.85,
  },
});

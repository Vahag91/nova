/**
 * Step 3 - the setup beat between goal selection and the paywall.
 *
 * The trial row is a status indicator, not a control: the user cannot toggle
 * it, and nothing here charges or enrols them. The actual offer is presented
 * by the paywall that follows.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  I18nManager,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import SetupChecklist from './SetupChecklist';
import SetupOrb from './SetupOrb';
import { FadeSwapText } from './primitives';
import {
  WORKSPACE_STEP_DURATION_MS,
  WORKSPACE_TRIAL_DELAY_MS,
  WORKSPACE_TRIAL_SETTLE_MS,
  WORKSPACE_TRIAL_TRAVEL_MS,
} from './content';
import { HAPTIC, haptic } from './haptics';
import { FONT } from './theme';

export default function WorkspaceReadyView({
  active = true,
  content,
  onTrialReady,
  theme,
}) {
  const c = content.workspace;
  const { height } = useWindowDimensions();
  const compact = height < 740;

  const [stepIndex, setStepIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [trialOn, setTrialOn] = useState(false);

  const knob = useRef(new Animated.Value(0)).current;
  const trialProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return undefined;
    const timers = [];
    let trialAnimation = null;
    let cancelled = false;
    const stepCount = c.steps.length;

    c.steps.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setStepIndex(i);
          if (i > 0) haptic(HAPTIC.select);
        }, i * WORKSPACE_STEP_DURATION_MS),
      );
    });

    const readyAt = stepCount * WORKSPACE_STEP_DURATION_MS;
    timers.push(
      setTimeout(() => {
        setIsReady(true);
        haptic(HAPTIC.ready);
        Animated.timing(trialProgress, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }, readyAt),
    );

    const trialAt = readyAt + WORKSPACE_TRIAL_DELAY_MS;
    timers.push(
      setTimeout(() => {
        trialAnimation = Animated.timing(knob, {
          toValue: 1,
          duration: WORKSPACE_TRIAL_TRAVEL_MS,
          easing: Easing.bezier(0.32, 0.9, 0.32, 1),
          useNativeDriver: true,
        });
        trialAnimation.start();
      }, trialAt),
    );

    // The label lands with the knob, not with the animation's final frame.
    timers.push(
      setTimeout(() => {
        if (cancelled) return;
        setTrialOn(true);
        haptic(HAPTIC.advance);
      }, trialAt + WORKSPACE_TRIAL_SETTLE_MS),
    );

    // Hand-off keeps the full travel so the enabled state gets its own beat.
    // It runs on a timer rather than the animation's end callback: an
    // interrupted animation reports finished=false, which used to strand the
    // flow on this screen with the trial already showing as enabled.
    timers.push(
      setTimeout(() => {
        if (cancelled) return;
        onTrialReady?.(true);
      }, trialAt + WORKSPACE_TRIAL_TRAVEL_MS),
    );

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      trialAnimation?.stop();
    };
  }, [active, c.steps, knob, onTrialReady, trialProgress]);

  const knobTravel = compact ? 60 : 68;
  const knobX = knob.interpolate({
    inputRange: [0, 1],
    outputRange: I18nManager.isRTL ? [-4, -knobTravel] : [4, knobTravel],
  });

  // Both labels cross-fade off the knob's own value rather than off a timer, so
  // the wording tracks the distance actually travelled and cannot drift from it.
  // "enabled" is fully in by 0.95, the point the eased knob reads as landed.
  const activatingOpacity = knob.interpolate({
    inputRange: [0, 0.45, 0.8],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  });
  const enabledOpacity = knob.interpolate({
    inputRange: [0, 0.7, 0.95],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  const riseStyle = progress => ({
    opacity: progress,
    transform: [
      {
        translateY: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  });

  return (
    <View style={styles.screen}>
      <View style={styles.stage}>
        <SetupOrb ready={isReady} size={compact ? 148 : 178} theme={theme} />

        <FadeSwapText
          style={[
            styles.readyTitle,
            compact && styles.readyTitleCompact,
            { color: theme.primaryText },
          ]}
        >
          {isReady ? c.readyTitle : c.preparingTitle}
        </FadeSwapText>

        <View style={styles.subtitleSlot}>
          <Animated.Text
            style={[
              styles.stepText,
              { color: theme.secondaryText, opacity: trialProgress },
            ]}
          >
            {c.subtitle}
          </Animated.Text>
        </View>

        <SetupChecklist
          activeIndex={stepIndex}
          compact={compact}
          ready={isReady}
          steps={c.steps}
          theme={theme}
        />

        <Animated.View
          style={[
            styles.trialBlock,
            compact && styles.trialBlockCompact,
            riseStyle(trialProgress),
          ]}
        >
          <View
            style={[
              styles.trialTrack,
              compact && styles.trialTrackCompact,
              { backgroundColor: theme.progressInactive },
            ]}
          >
            <Animated.View
              style={[
                styles.trialFill,
                { backgroundColor: theme.accent, opacity: knob },
              ]}
            />
            <Animated.View
              style={[
                styles.trialKnob,
                compact && styles.trialKnobCompact,
                { transform: [{ translateX: knobX }] },
              ]}
            />
          </View>

          <Text style={[styles.trialTitle, { color: theme.primaryText }]}>
            {c.trialTitle}
          </Text>
          <View style={styles.trialStateSlot}>
            <Animated.Text
              accessibilityElementsHidden={trialOn}
              importantForAccessibility={trialOn ? 'no-hide-descendants' : 'yes'}
              style={[
                styles.trialState,
                styles.trialStateLayer,
                { color: theme.mutedText, opacity: activatingOpacity },
              ]}
            >
              {c.trialActivating}
            </Animated.Text>
            <Animated.Text
              accessibilityElementsHidden={!trialOn}
              importantForAccessibility={trialOn ? 'yes' : 'no-hide-descendants'}
              style={[
                styles.trialState,
                styles.trialStateLayer,
                { color: theme.accent, opacity: enabledOpacity },
              ]}
            >
              {c.trialEnabled}
            </Animated.Text>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  readyTitle: {
    marginTop: 22,
    fontSize: 27,
    fontFamily: FONT.bold,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 33,
  },
  readyTitleCompact: { marginTop: 16, fontSize: 24, lineHeight: 29 },
  subtitleSlot: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  stepText: {
    fontSize: 14,
    fontFamily: FONT.regular,
    lineHeight: 19,
    textAlign: 'center',
  },
  trialBlock: { alignItems: 'center', marginTop: 26 },
  trialBlockCompact: { marginTop: 16 },
  trialTrack: {
    width: 128,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    marginBottom: 14,
  },
  trialTrackCompact: { width: 112, height: 56, borderRadius: 28 },
  trialFill: { ...StyleSheet.absoluteFillObject, borderRadius: 32 },
  trialKnob: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  trialKnobCompact: { width: 48, height: 48, borderRadius: 24 },
  trialTitle: { fontSize: 23, fontFamily: FONT.bold },
  // Fixed slot so the two cross-fading labels overlap instead of reflowing.
  trialStateSlot: { marginTop: 2, height: 26, alignSelf: 'stretch' },
  trialStateLayer: { position: 'absolute', left: 0, right: 0 },
  trialState: {
    fontSize: 19,
    lineHeight: 24,
    fontFamily: FONT.bold,
    textAlign: 'center',
  },
});

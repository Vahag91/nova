/**
 * The four setup steps, ticking over one at a time.
 *
 * A single line of swapping text gave the user nothing to watch during the
 * wait; a list that fills in shows progress being made and makes the beat feel
 * earned rather than padded.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { FONT } from './theme';

function StepRow({ label, state, theme, compact }) {
  const done = state === 'done';
  const active = state === 'active';

  const progress = useRef(new Animated.Value(done ? 1 : 0)).current;
  const emphasis = useRef(new Animated.Value(active || done ? 1 : 0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const previousState = useRef(state);

  useEffect(() => {
    if (previousState.current === state) return undefined;
    previousState.current = state;
    const animation = Animated.parallel([
      Animated.spring(progress, {
        toValue: done ? 1 : 0,
        useNativeDriver: true,
        speed: 16,
        bounciness: done ? 12 : 0,
      }),
      Animated.timing(emphasis, {
        toValue: active || done ? 1 : 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [active, done, emphasis, progress, state]);

  // Only the step being worked on pulses.
  useEffect(() => {
    if (!active) {
      breathe.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 620,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, breathe]);

  const rowStyle = {
    opacity: emphasis.interpolate({
      inputRange: [0, 1],
      outputRange: [0.38, 1],
    }),
    transform: [
      {
        translateX: emphasis.interpolate({
          inputRange: [0, 1],
          outputRange: [-6, 0],
        }),
      },
    ],
  };

  const markerColor = done || active ? theme.accent : theme.progressInactive;

  return (
    <Animated.View style={[styles.row, compact && styles.rowCompact, rowStyle]}>
      <View style={[styles.marker, { borderColor: markerColor }]}>
        <Animated.View
          style={[
            styles.markerDot,
            {
              backgroundColor: theme.accent,
              opacity: Animated.multiply(
                Animated.add(0.55, Animated.multiply(breathe, 0.45)),
                progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
              ),
              transform: [
                {
                  scale: Animated.add(
                    0.7,
                    Animated.multiply(breathe, 0.35),
                  ),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.markerFill,
            {
              backgroundColor: theme.accent,
              opacity: progress,
              transform: [{ scale: progress }],
            },
          ]}
        />
        <Animated.Text
          style={[
            styles.markerTick,
            { opacity: progress, transform: [{ scale: progress }] },
          ]}
        >
          ✓
        </Animated.Text>
      </View>

      <Text
        numberOfLines={1}
        style={[
          styles.label,
          compact && styles.labelCompact,
          { color: done || active ? theme.primaryText : theme.mutedText },
        ]}
      >
        {label}
      </Text>
    </Animated.View>
  );
}

export default function SetupChecklist({
  activeIndex,
  compact,
  ready,
  steps,
  theme,
}) {
  return (
    <View style={styles.list}>
      {steps.map((label, index) => {
        let state = 'pending';
        if (ready || index < activeIndex) state = 'done';
        else if (index === activeIndex) state = 'active';

        return (
          <StepRow
            key={label}
            compact={compact}
            label={label}
            state={state}
            theme={theme}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { alignSelf: 'stretch', paddingHorizontal: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  rowCompact: { paddingVertical: 5 },
  marker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  markerDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  markerFill: { ...StyleSheet.absoluteFillObject, borderRadius: 11 },
  markerTick: {
    position: 'absolute',
    color: '#05070A',
    fontFamily: FONT.bold,
    fontSize: 12,
  },
  label: { flex: 1, fontFamily: FONT.regular, fontSize: 15 },
  labelCompact: { fontSize: 14 },
});

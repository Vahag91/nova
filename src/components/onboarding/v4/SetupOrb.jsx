/**
 * The setup screen's centrepiece: a core with three orbits around it.
 *
 * Depth is real transform work, not a picture of depth - each ring is tilted on
 * X, swung to its own angle on Y, then spun on Z under a shared perspective, so
 * the orbiters trace ellipses that read as circles in space. Every value runs on
 * the native driver: this spins for the whole setup beat and must not compete
 * with the step timers on the JS thread.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

const PERSPECTIVE = 900;
const RING_TILT = '66deg';

const RINGS = [
  { scale: 1, duration: 4200, swing: '0deg', reverse: false, dot: 7 },
  { scale: 0.78, duration: 5600, swing: '58deg', reverse: true, dot: 6 },
  { scale: 0.56, duration: 3400, swing: '-52deg', reverse: false, dot: 5 },
];

function useSpin(duration, reverse) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [duration, spin]);

  return {
    spin,
    rotate: spin.interpolate({
      inputRange: [0, 1],
      outputRange: reverse ? ['360deg', '0deg'] : ['0deg', '360deg'],
    }),
    counterRotate: spin.interpolate({
      inputRange: [0, 1],
      outputRange: reverse ? ['-360deg', '0deg'] : ['0deg', '-360deg'],
    }),
  };
}

function Orbit({ ring, size, theme }) {
  const { spin, rotate, counterRotate } = useSpin(ring.duration, ring.reverse);
  const diameter = size * ring.scale;

  const depth = spin.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ring.reverse ? [1, 0.68, 1, 1.32, 1] : [1, 1.32, 1, 0.68, 1],
  });
  const depthFade = spin.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ring.reverse ? [1, 0.45, 1, 1, 1] : [1, 1, 1, 0.45, 1],
  });

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          borderColor: theme.accent,
          transform: [
            { perspective: PERSPECTIVE },
            { rotateX: RING_TILT },
            { rotateY: ring.swing },
            { rotateZ: rotate },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.orbiter,
          {
            width: ring.dot * 2,
            height: ring.dot * 2,
            borderRadius: ring.dot,
            marginLeft: -ring.dot,
            top: -ring.dot,
            backgroundColor: theme.accent,
            opacity: depthFade,
            transform: [{ rotateZ: counterRotate }, { scale: depth }],
          },
        ]}
      />
    </Animated.View>
  );
}

export default function SetupOrb({ ready, size = 168, theme }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const sonar = useRef(new Animated.Value(0)).current;
  const settle = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sonar, {
        toValue: 1,
        duration: 2600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [sonar]);

  useEffect(() => {
    if (!ready) return undefined;

    const animation = Animated.parallel([
      Animated.sequence([
        Animated.spring(settle, {
          toValue: 1.1,
          useNativeDriver: true,
          speed: 18,
          bounciness: 16,
        }),
        Animated.spring(settle, {
          toValue: 1,
          useNativeDriver: true,
          speed: 12,
          bounciness: 6,
        }),
      ]),
      Animated.timing(glow, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [glow, ready, settle]);

  const coreSize = Math.round(size * 0.34);
  const glowSize = Math.round(size * 0.94);
  const breathe = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1.07],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.root,
        { width: size, height: size, transform: [{ scale: settle }] },
      ]}
    >
      <View style={styles.layer}>
        <Animated.View
          style={{
            opacity: Animated.add(0.5, Animated.multiply(glow, 0.4)),
            transform: [{ scale: breathe }],
          }}
        >
          <Svg width={glowSize} height={glowSize}>
            <Defs>
              <RadialGradient id="setupOrbGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={theme.accent} stopOpacity="0.7" />
                <Stop offset="55%" stopColor={theme.accent} stopOpacity="0.16" />
                <Stop offset="100%" stopColor={theme.accent} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle
              cx={glowSize / 2}
              cy={glowSize / 2}
              r={glowSize / 2}
              fill="url(#setupOrbGlow)"
            />
          </Svg>
        </Animated.View>
      </View>

      <View style={styles.layer}>
        <Animated.View
          style={[
            styles.sonar,
            {
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
              borderColor: theme.accent,
              opacity: sonar.interpolate({
                inputRange: [0, 0.15, 1],
                outputRange: [0, 0.5, 0],
              }),
              transform: [
                {
                  scale: sonar.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 2.9],
                  }),
                },
              ],
            },
          ]}
        />
      </View>

      {RINGS.map(ring => (
        <View key={ring.swing} style={styles.layer}>
          <Orbit ring={ring} size={size} theme={theme} />
        </View>
      ))}

      <View style={styles.layer}>
        <Animated.View
          style={[
            styles.core,
            {
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
              backgroundColor: theme.accent,
              transform: [{ scale: breathe }],
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: { borderWidth: 1.4, opacity: 0.55 },
  orbiter: { position: 'absolute', left: '50%' },
  sonar: { borderWidth: 1.5 },
  core: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
});

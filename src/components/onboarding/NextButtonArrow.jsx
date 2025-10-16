import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Animated } from 'react-native';
import MyPressable from './MyPressable';

const NextButtonArrow = ({ onBtnPress, animationController, isAnimating = false }) => {
  // 0 = Splash, 1 = RelaxView, 2 = CareView
  const [phase, setPhase] = useState(0);
  const listenerId = useRef(undefined);
  
  // Animation values for smooth transitions
  const textOpacity = useRef(new Animated.Value(1)).current;
  const textScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // read the animated value and map to a phase; no visual animations here
    listenerId.current = animationController.current.addListener(({ value }) => {
      const newPhase = value >= 0.4 ? 2 : value >= 0.2 ? 1 : 0;
      
      if (newPhase !== phase) {
        // Animate text transition when phase changes
        Animated.sequence([
          Animated.parallel([
            Animated.timing(textOpacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(textScale, {
              toValue: 0.8,
              duration: 150,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(textOpacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(textScale, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
        
        setPhase(newPhase);
      }
    });
    return () => {
      if (listenerId.current !== undefined) {
        animationController.current.removeListener(listenerId.current);
      }
    };
  }, [animationController, phase, textOpacity, textScale]);

  const isCircle = phase === 0;
  const label = phase === 2 ? "Let's start" : phase === 1 ? "Continue" : null;
  const width = phase === 2 ? 220 : phase === 1 ? 160 : 58;

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
          { 
            width, 
            borderRadius: isCircle ? 29 : 16,
            opacity: isAnimating ? 0.5 : 1,
          }
        ]}
        disabled={isAnimating}
      >
        <View style={styles.centered}>
          <Animated.Text 
            style={[
              styles.label,
              {
                opacity: textOpacity,
                transform: [{ scale: textScale }],
              }
            ]}
          >
            {label}
          </Animated.Text>
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

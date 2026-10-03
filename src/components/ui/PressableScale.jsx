import React, { useCallback } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const PRESS_IN = { duration: 110, easing: EASE_OUT, reduceMotion: ReduceMotion.System };
const PRESS_OUT = { duration: 180, easing: EASE_OUT, reduceMotion: ReduceMotion.System };

// Pressable that sinks slightly under the finger. The scale runs on the UI
// thread, so it responds on press-in even while JS is busy. `style` must be a
// plain style (object or array): an animated component drops the
// ({ pressed }) => style function form.
export default function PressableScale({
  children,
  style,
  pressedScale = 0.96,
  onPressIn,
  onPressOut,
  ...rest
}) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(
    event => {
      scale.value = withTiming(pressedScale, PRESS_IN);
      onPressIn?.(event);
    },
    [onPressIn, pressedScale, scale],
  );

  const handlePressOut = useCallback(
    event => {
      scale.value = withTiming(1, PRESS_OUT);
      onPressOut?.(event);
    },
    [onPressOut, scale],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

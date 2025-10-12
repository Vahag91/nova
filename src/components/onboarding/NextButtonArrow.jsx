import React, { useRef, useEffect } from 'react';
import { StyleSheet, Text, Animated, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MyPressable from './MyPressable';

const IconPressable = Animated.createAnimatedComponent(Icon);

/*
 * Refactored to use scaleX instead of width animation
 * This allows useNativeDriver: true for 60fps performance
 */
const NextButtonArrow = ({
  onBtnPress,
  animationController,
}) => {
  const arrowAnim = useRef(new Animated.Value(0));

  arrowAnim.current = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8],
    outputRange: [0, 0, 0, 0, 1],
  });

  // Debug animation values - reduced frequency to improve performance
  useEffect(() => {
    console.log(`🏹 [NextButtonArrow] Component mounted, using native driver animation`);
    
    let lastLogTime = 0;
    const listener = animationController.current.addListener(({ value }) => {
      // Only log every 500ms to reduce console spam
      if (value >= 0.6 && Date.now() - lastLogTime > 500) {
        console.log(`🏹 [NextButtonArrow] Native animation active, value: ${value.toFixed(3)}`);
        lastLogTime = Date.now();
      }
    });
    
    return () => {
      console.log(`🏹 [NextButtonArrow] Cleaning up listener`);
      animationController.current.removeListener(listener);
    };
  }, [animationController]);

  // Transition from arrow to sign up
  const transitionAnim = arrowAnim.current.interpolate({
    inputRange: [0, 0.85, 1],
    outputRange: [36, 0, 0],
  });
  const opacityAnim = arrowAnim.current.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [0, 0, 1],
  });
  const iconTransitionAnim = arrowAnim.current.interpolate({
    inputRange: [0, 0.35, 0.85, 1],
    outputRange: [0, 0, -36, -36],
  });
  const iconOpacityAnim = arrowAnim.current.interpolate({
    inputRange: [0, 0.7, 1],
    outputRange: [1, 0, 0],
  });

  // Use scaleX instead of width for native driver support
  const scaleXAnim = arrowAnim.current.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 4.448], // 258/58 = 4.448 (from 58px to 258px)
  });

  // Use translateY instead of marginBottom
  const translateYAnim = arrowAnim.current.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -38], // Move up by 38px
  });

  // Border radius scale approximation (visual effect)
  const scaleRadiusAnim = arrowAnim.current.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.95], // Slight scale down for visual rounded->square effect
  });

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.container,
          {
            transform: [
              { translateY: translateYAnim },
              { scaleX: scaleXAnim },
              { scaleY: scaleRadiusAnim },
            ],
          },
        ]}
      >
        <MyPressable
          style={{ flex: 1, justifyContent: 'center' }}
          android_ripple={{ color: 'darkgrey' }}
          onPress={() => onBtnPress()}
        >
          <Animated.View
            style={[
              styles.signupContainer,
              {
                opacity: opacityAnim,
                transform: [{ translateY: transitionAnim }],
              },
            ]}
          >
            <Text style={styles.signupText}>Sign Up</Text>
            <Icon name="arrow-forward" size={24} color="white" />
          </Animated.View>

          <IconPressable
            style={[
              styles.icon,
              {
                opacity: iconOpacityAnim,
                transform: [{ translateY: iconTransitionAnim }],
              },
            ]}
            name="arrow-forward-ios"
            size={24}
            color="white"
          />
        </MyPressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    height: 58,
    width: 58,
    marginBottom: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    height: 58,
    width: 58,
    backgroundColor: 'rgb(21, 32, 54)',
    borderRadius: 40,
    overflow: 'hidden',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  signupText: {
    fontSize: 18,
    fontFamily: 'WorkSans-Medium',
    color: 'white',
  },
  icon: {
    position: 'absolute',
    alignSelf: 'center',
  },
});

export default NextButtonArrow;
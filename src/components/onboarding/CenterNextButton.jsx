import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NextButtonArrow from './NextButtonArrow';

const DotIndicator = ({
  index,
  selectedIndex,
}) => {
  const activeIndexRef = useRef(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(activeIndexRef.current, {
      toValue: index === selectedIndex ? 1 : 0,
      duration: 480,
      useNativeDriver: false,
    }).start();
  }, [selectedIndex, index]);

  const bgColor = activeIndexRef.current.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E3E4E4', '#132137'],
  });

  return (
    <Animated.View
      style={[styles.pageIndicator, { backgroundColor: bgColor }]}
    />
  );
};

const CenterNextButton = ({
  onNextClick,
  animationController,
}) => {
  const opacity = useRef(new Animated.Value(0));
  const currentOpacity = useRef(0);
  const lastSelectedIndex = useRef(0); // Track the actual current index to prevent unnecessary updates

  const [selectedIndex, setSelectedIndex] = useState(0);

  const { bottom } = useSafeAreaInsets();
  const paddingBottom = 16 + bottom;

  const dots = useMemo(() => [0, 1, 2, 3], []);

  useEffect(() => {
    console.log(`🔧 [CenterNextButton] Setting up animation listener`);
    
    const listener = animationController.current.addListener(({ value }) => {
      const isVisible = value >= 0.2 && value <= 0.6;
      
      if (
        (isVisible && currentOpacity.current === 0) ||
        (!isVisible && currentOpacity.current === 1)
      ) {
        console.log(`👁️ [CenterNextButton] Visibility change: ${isVisible ? 'visible' : 'hidden'}`);
        
        Animated.timing(opacity.current, {
          toValue: isVisible ? 1 : 0,
          duration: 480,
          useNativeDriver: true,
        }).start();
        currentOpacity.current = isVisible ? 1 : 0;
      }

      // Update selected index with throttling to prevent excessive re-renders
      let newIndex;
      if (value >= 0.7) {
        newIndex = 3;
      } else if (value >= 0.5) {
        newIndex = 2;
      } else if (value >= 0.3) {
        newIndex = 1;
      } else {
        newIndex = 0; // Default to 0 for all values < 0.3
      }
      
      // Only update if the index actually changed (use ref to avoid stale closure)
      if (newIndex !== lastSelectedIndex.current) {
        console.log(`🎯 [CenterNextButton] Dot index change: ${lastSelectedIndex.current} → ${newIndex} (value: ${value.toFixed(3)})`);
        lastSelectedIndex.current = newIndex;
        setSelectedIndex(newIndex);
      }
    });

    // Cleanup function to remove listener
    return () => {
      console.log(`🧹 [CenterNextButton] Cleaning up animation listener`);
      animationController.current.removeListener(listener);
    };
  }, [animationController]); // No selectedIndex dependency - using ref to avoid stale closure

  const topViewAnim = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8],
    outputRange: [96 * 5, 0, 0, 0, 0], // 96 is total height of next button view
  });
  const loginTextMoveAnimation = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8],
    outputRange: [30 * 5, 30 * 5, 30 * 5, 30 * 5, 0], // 96 is total height of next button view
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingBottom, transform: [{ translateY: topViewAnim }] },
      ]}
    >
      <Animated.View
        style={[styles.dotsContainer, { opacity: opacity.current }]}
      >
        {dots.map(item => (
          <DotIndicator
            key={item}
            index={item}
            {...{ selectedIndex, animationController }}
          />
        ))}
      </Animated.View>

      <NextButtonArrow {...{ animationController }} onBtnPress={onNextClick} />

      <Animated.View
        style={[
          styles.footerTextContainer,
          { transform: [{ translateY: loginTextMoveAnimation }] },
        ]}
      >
        <Text style={{ color: 'grey', fontFamily: 'WorkSans-Regular' }}>
          Already have an account?{' '}
        </Text>
        <Text style={styles.loginText}>Login</Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  pageIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    margin: 4,
  },
  footerTextContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  loginText: {
    color: '#132137',
    fontSize: 16,
    fontFamily: 'WorkSans-Bold',
  },
});

export default CenterNextButton;
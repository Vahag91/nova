import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Animated } from 'react-native';
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
  isAnimating,
}) => {
  const opacity = useRef(new Animated.Value(0));
  const currentOpacity = useRef(0);
  const lastSelectedIndex = useRef(0); // Track the actual current index to prevent unnecessary updates

  const [selectedIndex, setSelectedIndex] = useState(0);

  const { bottom } = useSafeAreaInsets();
  const paddingBottom = 16 + bottom;

  const dots = useMemo(() => [0, 1], []);

  useEffect(() => {
    const listener = animationController.current.addListener(({ value }) => {
      const isVisible = value >= 0.2 && value <= 0.8;
      
      if (
        (isVisible && currentOpacity.current === 0) ||
        (!isVisible && currentOpacity.current === 1)
      ) {
        Animated.timing(opacity.current, {
          toValue: isVisible ? 1 : 0,
          duration: 480,
          useNativeDriver: true,
        }).start();
        currentOpacity.current = isVisible ? 1 : 0;
      }

      let newIndex;
      if (value >= 0.6) {
        newIndex = 2; // CareView (last page)
      } else if (value >= 0.2) {
        newIndex = 1; // RelaxView (middle page)
      } else {
        newIndex = 0; // SplashView (first page)
      }
      
      if (newIndex !== lastSelectedIndex.current) {
        lastSelectedIndex.current = newIndex;
        setSelectedIndex(newIndex);
      }
    });

    return () => {
      animationController.current.removeListener(listener);
    };
  }, [animationController]);

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

      <NextButtonArrow {...{ animationController, isAnimating }} onBtnPress={onNextClick} />
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
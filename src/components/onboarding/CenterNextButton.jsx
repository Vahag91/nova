import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NextButtonArrow from './NextButtonArrow';

const DotIndicator = ({ selected }) => {
  const selectedProgress = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(selectedProgress, {
      toValue: selected ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [selected, selectedProgress]);

  return (
    <View style={[styles.pageIndicator, styles.pageIndicatorIdle]}>
      <Animated.View
        style={[
          styles.selectedIndicator,
          {
            opacity: selectedProgress,
            transform: [
              {
                scale: selectedProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.55, 1],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
};

const CenterNextButton = ({
  onNextClick,
  animationController,
  isAnimating,
  step,
}) => {
  const { bottom } = useSafeAreaInsets();
  const paddingBottom = 16 + bottom;

  const topViewAnim = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8],
    outputRange: [96 * 5, 0, 0, 0, 0], // 96 is total height of next button view
  });
  const controlsOpacity = animationController.current.interpolate({
    inputRange: [0, 0.16, 0.2, 0.8],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { paddingBottom, transform: [{ translateY: topViewAnim }] },
      ]}
    >
      <Animated.View style={[styles.dotsContainer, { opacity: controlsOpacity }]}>
        {[1, 2].map(item => (
          <DotIndicator key={item} selected={item === step} />
        ))}
      </Animated.View>

      <NextButtonArrow phase={step} {...{ isAnimating }} onBtnPress={onNextClick} />
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
  selectedIndicator: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 5,
    backgroundColor: '#132137',
  },
  pageIndicatorIdle: {
    backgroundColor: '#E3E4E4',
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

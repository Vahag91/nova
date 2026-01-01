import React from 'react';
import { StyleSheet, Animated, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import MyPressable from './MyPressable';

const TopBackSkipView = ({
  onBackClick,
  isAnimating = false,
  animationController,
}) => {
  const { top } = useSafeAreaInsets();
  const marginTop = Platform.OS === 'ios' ? top : StatusBar.currentHeight;

  const headerTranslateY = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8],
    outputRange: [-(58 + (marginTop ?? 0)), 0, 0, 0, 0],
  });

  return (
    <Animated.View
      style={[
        styles.buttonContainer,
        { marginTop, transform: [{ translateY: headerTranslateY }] },
      ]}
    >
      <MyPressable
        style={styles.backBtn}
        android_ripple={{ color: 'darkgrey', borderless: true, radius: 28 }}
        onPress={isAnimating ? undefined : () => onBackClick()}
        disabled={isAnimating}
      >
        <Svg height="24" viewBox="0 -960 960 960" width="24">
          <Path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z" fill="#FFFFFF" />
        </Svg>
      </MyPressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 8,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  backBtn: {
    width: 56,
    height: 56,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TopBackSkipView;

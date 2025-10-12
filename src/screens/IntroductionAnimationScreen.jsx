import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  SplashView,
  RelaxView,
  CareView,
  MoodDiaryView,
  WelcomeView,
  TopBackSkipView,
  CenterNextButton,
} from '../components/onboarding';

const IntroductionAnimationScreen = () => {
  const navigation = useNavigation();
  const window = useWindowDimensions();

  const [currentPage, setCurrentPage] = useState(0);

  // Performance monitoring
  useEffect(() => {
    console.log(`🚀 [PERFORMANCE] IntroductionAnimationScreen mounted`);
    console.log(`📱 [DEVICE] Screen dimensions: ${window.width}x${window.height}`);
    
    // Monitor memory usage (if available)
    if (global.performance && global.performance.memory) {
      const memory = global.performance.memory;
      console.log(`💾 [MEMORY] Used: ${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB, Total: ${Math.round(memory.totalJSHeapSize / 1024 / 1024)}MB`);
    }
  }, []);

  const animationController = useRef(new Animated.Value(0));
  const animValue = useRef(0);

  useEffect(() => {
    let frameCount = 0;
    let lastLogTime = Date.now();
    
    const listener = animationController.current.addListener(({ value }) => {
      frameCount++;
      const now = Date.now();
      
      // Log every 200ms to reduce console spam and improve performance
      if (now - lastLogTime >= 200) {
        const fps = Math.round((frameCount * 1000) / (now - lastLogTime));
        console.log(`🎬 [PERFORMANCE] Animation value: ${value.toFixed(3)}, FPS: ${fps}, Frame: ${frameCount}`);
        frameCount = 0;
        lastLogTime = now;
      }
      
      animValue.current = value;
      setCurrentPage(value);
    });

    // Cleanup function to remove listener
    return () => {
      animationController.current.removeListener(listener);
    };
  }, []);

  const relaxTranslateY = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8],
    outputRange: [window.height, 0, 0, 0, 0],
  });

  const playAnimation = useCallback(
    (toValue, duration = 1600) => {
      const startTime = Date.now();
      console.log(`🚀 [ANIMATION] Starting animation to value: ${toValue}, duration: ${duration}ms`);
      
      Animated.timing(animationController.current, {
        toValue,
        duration,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1.0),
        // ✅ Now using native driver! NextButtonArrow refactored to use transform instead of width
        useNativeDriver: true,
      }).start((finished) => {
        const endTime = Date.now();
        const actualDuration = endTime - startTime;
        console.log(`✅ [ANIMATION] Animation ${finished ? 'completed' : 'cancelled'} in ${actualDuration}ms (expected: ${duration}ms)`);
      });
    },
    [],
  );

  const onNextClick = useCallback(() => {
    const clickTime = Date.now();
    console.log(`👆 [USER ACTION] Next button clicked at ${clickTime}`);
    
    let toValue;
    const currentValue = animValue.current;
    
    // Progress through screens: 0 → 0.2 → 0.4 → 0.6 → 0.8 → exit
    if (currentValue < 0.2) {
      toValue = 0.2;  // Splash → Relax
    } else if (currentValue >= 0.2 && currentValue < 0.4) {
      toValue = 0.4;  // Relax → Care
    } else if (currentValue >= 0.4 && currentValue < 0.6) {
      toValue = 0.6;  // Care → Mood Diary
    } else if (currentValue >= 0.6 && currentValue < 0.8) {
      toValue = 0.8;  // Mood Diary → Welcome
    } else if (currentValue >= 0.8) {
      console.log(`🏁 [NAVIGATION] Going back to main app`);
      navigation.goBack();
      return;
    }

    console.log(`📊 [STATE] Current value: ${animValue.current.toFixed(2)}, Next value: ${toValue}`);
    toValue !== undefined && playAnimation(toValue);
  }, [playAnimation, navigation]);

  const onBackClick = useCallback(() => {
    console.log(`⬅️ [USER ACTION] Back button clicked`);
    const currentValue = animValue.current;
    console.log(`📊 [STATE] Current value: ${currentValue.toFixed(2)}`);
    
    let toValue;
    
    // Go back through screens: 0.8 → 0.6 → 0.4 → 0.2 → 0
    if (currentValue >= 0.8) {
      toValue = 0.6;  // Welcome → Mood Diary
    } else if (currentValue >= 0.6 && currentValue < 0.8) {
      toValue = 0.4;  // Mood Diary → Care
    } else if (currentValue >= 0.4 && currentValue < 0.6) {
      toValue = 0.2;  // Care → Relax
    } else if (currentValue >= 0.2 && currentValue < 0.4) {
      toValue = 0.0;  // Relax → Splash
    }

    console.log(`📊 [STATE] Back value: ${toValue}`);
    toValue !== undefined && playAnimation(toValue);
  }, [playAnimation]);

  const onSkipClick = useCallback(() => {
    console.log(`⏭️ [USER ACTION] Skip button clicked`);
    console.log(`📊 [STATE] Skipping to final screen (0.8)`);
    playAnimation(0.8, 1200);
  }, [playAnimation]);

  return (
    <View style={{ flex: 1, backgroundColor: 'rgb(245, 235, 226)' }}>
      <StatusBar barStyle={`${currentPage > 0 ? 'dark' : 'light'}-content`} />
      <SplashView {...{ onNextClick, animationController }} />

      <Animated.View
        style={[
          styles.scenesContainer,
          { transform: [{ translateY: relaxTranslateY }] },
        ]}
      >
        <RelaxView {...{ animationController }} />

        <CareView {...{ animationController }} />

        <MoodDiaryView {...{ animationController }} />

        <WelcomeView {...{ animationController }} />
      </Animated.View>

      <TopBackSkipView {...{ onBackClick, onSkipClick, animationController }} />

      <CenterNextButton {...{ onNextClick, animationController }} />
    </View>
  );
};

const styles = StyleSheet.create({
  scenesContainer: {
    justifyContent: 'center',
    ...StyleSheet.absoluteFillObject,
  },
});

export default IntroductionAnimationScreen;
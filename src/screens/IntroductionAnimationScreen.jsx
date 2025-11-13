// src/screens/IntroductionAnimationScreen.tsx (or .js)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  Animated,
  Easing,
  StatusBar,
  ImageBackground,
  Image,
} from 'react-native';
import {
  SplashView,
  RelaxView,
  CareView,
  TopBackSkipView,
  CenterNextButton,
} from '../components/onboarding';
import RateUsService from '../services/RateUsService';

const IntroductionAnimationScreen = ({ onComplete }) => {
  const window = useWindowDimensions();

  const [currentPage, setCurrentPage] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const continueCountRef = useRef(0);

  useEffect(() => {
    Image.prefetch(
      Image.resolveAssetSource(
        require('../../assets/images/onboardingtheme.jpg')
      ).uri
    )
      .then(() => setImageLoaded(true))
      .catch(() => setImageLoaded(true));
  }, []);

  const animationController = useRef(new Animated.Value(0));
  const animValue = useRef(0);

  useEffect(() => {
    const listener = animationController.current.addListener(({ value }) => {
      animValue.current = value;
      setCurrentPage(value);
    });
    return () => {
      animationController.current.removeListener(listener);
    };
  }, []);

  const relaxTranslateY = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8],
    outputRange: [window.height, 0, 0, 0, 0],
  });

  const playAnimation = useCallback((toValue, duration = 1600) => {
    Animated.timing(animationController.current, {
      toValue,
      duration,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1.0),
      useNativeDriver: true,
    }).start();
  }, []);

  const onNextClick = useCallback(async () => {
    const v = animValue.current;
    if (v < 0.2) {
      // SplashView → RelaxView
      continueCountRef.current += 1;
      playAnimation(0.2);
    } else if (v >= 0.2 && v < 0.4) {
      // RelaxView → CareView (2nd continue)
      continueCountRef.current += 1;
      playAnimation(0.4);
      
      // After 2nd continue, check for rate prompt
      if (continueCountRef.current >= 2) {
        const checkResult = await RateUsService.canShowRatePrompt();
        if (checkResult.canShow) {
          setTimeout(() => {
            RateUsService.showRatePrompt();
          }, 1500);
        }
      }
    } else if (v >= 0.4) {
      // LAST SCREEN - call onComplete to close onboarding
      if (onComplete) onComplete();
    }
  }, [playAnimation, onComplete]);

  const onBackClick = useCallback(() => {
    const v = animValue.current;
    if (v >= 0.4) playAnimation(0.2);
    else if (v >= 0.2) playAnimation(0.0);
  }, [playAnimation]);

  const onSkipClick = useCallback(() => {
    playAnimation(0.4, 1200);
  }, [playAnimation]);

  return (
    <ImageBackground
      source={require('../../assets/images/onboardingtheme.jpg')}
      style={[styles.bg, !imageLoaded && { backgroundColor: '#000000' }]}
      imageStyle={styles.bgImage}
      onLoad={() => setImageLoaded(true)}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.overlay} pointerEvents="box-none">
        <SplashView {...{ onNextClick, animationController }} />
        <Animated.View
          style={[
            styles.scenesContainer,
            { transform: [{ translateY: relaxTranslateY }] },
          ]}
          pointerEvents="box-none"
        >
          <RelaxView {...{ animationController }} />
          <CareView {...{ animationController }} />
        </Animated.View>
        <TopBackSkipView {...{ onBackClick, onSkipClick, animationController }} />
        <CenterNextButton {...{ onNextClick, animationController }} />
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bg: { flex: 1 },
  bgImage: { objectFit: 'cover' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  scenesContainer: {
    justifyContent: 'center',
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
});

export default IntroductionAnimationScreen;

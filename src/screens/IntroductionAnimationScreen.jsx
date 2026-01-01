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

  const [imageLoaded, setImageLoaded] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const continueCountRef = useRef(0);
  const transitionLockedRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    Image.prefetch(
      Image.resolveAssetSource(
        require('../../assets/images/onboardingtheme.jpg')
      ).uri
    )
      .then(() => {
        if (isMountedRef.current) setImageLoaded(true);
      })
      .catch(() => {
        if (isMountedRef.current) setImageLoaded(true);
      });
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const animationController = useRef(new Animated.Value(0));
  const animValue = useRef(0);

  useEffect(() => {
    const controller = animationController.current;
    const listenerId = controller.addListener(({ value }) => {
      animValue.current = value;
    });
    return () => {
      controller.removeListener(listenerId);
    };
  }, []);

  const relaxTranslateY = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8],
    outputRange: [window.height, 0, 0, 0, 0],
  });

  const playAnimation = useCallback((toValue, duration = 1600) => {
    return new Promise(resolve => {
      Animated.timing(animationController.current, {
        toValue,
        duration,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1.0),
        useNativeDriver: true,
      }).start(({ finished }) => resolve(finished));
    });
  }, []);

  const beginTransition = useCallback(
    (toValue, duration = 1600) => {
      if (transitionLockedRef.current) return null;
      transitionLockedRef.current = true;
      if (isMountedRef.current) setIsAnimating(true);
      return playAnimation(toValue, duration).finally(() => {
        if (isMountedRef.current) setIsAnimating(false);
        transitionLockedRef.current = false;
      });
    },
    [playAnimation]
  );

  const onNextClick = useCallback(async () => {
    const v = animValue.current;
    if (v < 0.2) {
      // SplashView → RelaxView
      const transition = beginTransition(0.2);
      if (!transition) return;
      continueCountRef.current += 1;
      await transition;
    } else if (v >= 0.2 && v < 0.4) {
      // RelaxView → CareView (2nd continue)
      const transition = beginTransition(0.4);
      if (!transition) return;
      continueCountRef.current += 1;
      
      // After 2nd continue, check for rate prompt
      if (continueCountRef.current >= 2) {
        RateUsService.canShowRatePrompt()
          .then(checkResult => {
            if (checkResult.canShow) {
              setTimeout(() => {
                RateUsService.showRatePrompt();
              }, 1500);
            }
          })
          .catch(() => {});
      }

      await transition;
    } else if (v >= 0.4) {
      // LAST SCREEN - call onComplete to close onboarding
      if (transitionLockedRef.current) return;
      transitionLockedRef.current = true;
      if (isMountedRef.current) setIsAnimating(true);
      if (onComplete) onComplete();
    }
  }, [beginTransition, onComplete]);

  const onBackClick = useCallback(() => {
    const v = animValue.current;
    if (v >= 0.4) beginTransition(0.2);
    else if (v >= 0.2) beginTransition(0.0);
  }, [beginTransition]);

  const onSkipClick = useCallback(() => {
    beginTransition(0.4, 1200);
  }, [beginTransition]);

  return (
    <ImageBackground
      source={require('../../assets/images/onboardingtheme.jpg')}
      style={[styles.bg, !imageLoaded && { backgroundColor: '#000000' }]}
      imageStyle={styles.bgImage}
      onLoad={() => setImageLoaded(true)}
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.overlay} pointerEvents="box-none">
        <SplashView {...{ onNextClick, animationController, isAnimating }} />
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
        <TopBackSkipView {...{ onBackClick, onSkipClick, animationController, isAnimating }} />
        <CenterNextButton {...{ onNextClick, animationController, isAnimating }} />
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

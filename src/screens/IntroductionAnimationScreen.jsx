// src/screens/IntroductionAnimationScreen.tsx (or .js)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  Animated,
  Easing,
  ImageBackground,
  InteractionManager,
} from 'react-native';
import {
  SplashView,
  RelaxView,
  CareView,
  TopBackSkipView,
  CenterNextButton,
} from '../components/onboarding';

const SCREEN_TRANSITION_MS = 900;
const SKIP_TRANSITION_MS = 760;

const IntroductionAnimationScreen = ({
  onComplete,
  onReady,
  onSubscriptionWarmup,
}) => {
  const window = useWindowDimensions();

  const [isAnimating, setIsAnimating] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [secondaryScenesMounted, setSecondaryScenesMounted] = useState(false);
  const [secondaryImagesReady, setSecondaryImagesReady] = useState(false);
  const [initialBackgroundReady, setInitialBackgroundReady] = useState(false);
  const [initialHeroReady, setInitialHeroReady] = useState(false);
  const [initialLayoutReady, setInitialLayoutReady] = useState(false);
  const [step, setStep] = useState(0);
  const transitionLockedRef = useRef(false);
  const isMountedRef = useRef(true);
  const subscriptionWarmupTimerRef = useRef(null);
  const subscriptionWarmupTaskRef = useRef(null);
  const secondaryImagesReadyRef = useRef(new Set());
  const completionFrameRef = useRef(null);
  const initialReadyFrameRef = useRef(null);
  const initialReadyReportedRef = useRef(false);
  const animationController = useRef(new Animated.Value(0));
  const stepRef = useRef(0);
  const criticalSceneReady =
    initialBackgroundReady &&
    initialHeroReady &&
    initialLayoutReady;
  const initialSceneReady =
    criticalSceneReady && secondaryScenesMounted && secondaryImagesReady;

  useEffect(() => {
    if (!initialLayoutReady || criticalSceneReady) return undefined;
    const timeoutId = setTimeout(() => {
      if (!isMountedRef.current) return;
      setInitialBackgroundReady(true);
      setInitialHeroReady(true);
    }, 1500);
    return () => clearTimeout(timeoutId);
  }, [criticalSceneReady, initialLayoutReady]);

  useEffect(() => {
    if (!secondaryScenesMounted || secondaryImagesReady) return undefined;
    const timeoutId = setTimeout(() => {
      if (isMountedRef.current) setSecondaryImagesReady(true);
    }, 1200);
    return () => clearTimeout(timeoutId);
  }, [secondaryImagesReady, secondaryScenesMounted]);

  useEffect(() => {
    if (!criticalSceneReady) return undefined;
    const warmupTask = InteractionManager.runAfterInteractions(() => {
      if (!isMountedRef.current) return;
      setSecondaryScenesMounted(true);
    });
    return () => warmupTask.cancel();
  }, [criticalSceneReady]);

  useEffect(() => {
    if (!initialSceneReady) return undefined;

    subscriptionWarmupTimerRef.current = setTimeout(() => {
      subscriptionWarmupTaskRef.current =
        InteractionManager.runAfterInteractions(() => {
          if (isMountedRef.current) onSubscriptionWarmup?.();
        });
    }, 450);

    return () => {
      if (subscriptionWarmupTimerRef.current) {
        clearTimeout(subscriptionWarmupTimerRef.current);
      }
      subscriptionWarmupTaskRef.current?.cancel?.();
    };
  }, [initialSceneReady, onSubscriptionWarmup]);

  useEffect(() => {
    const controller = animationController.current;
    return () => {
      isMountedRef.current = false;
      transitionLockedRef.current = true;
      controller.stopAnimation();
      controller.removeAllListeners();
      if (subscriptionWarmupTimerRef.current) {
        clearTimeout(subscriptionWarmupTimerRef.current);
      }
      subscriptionWarmupTaskRef.current?.cancel?.();
      if (completionFrameRef.current !== null) {
        cancelAnimationFrame(completionFrameRef.current);
      }
      if (initialReadyFrameRef.current !== null) {
        cancelAnimationFrame(initialReadyFrameRef.current);
      }
    };
  }, []);

  const handleSecondaryImageReady = useCallback(imageKey => {
    if (secondaryImagesReadyRef.current.has(imageKey)) return;
    secondaryImagesReadyRef.current.add(imageKey);
    if (
      secondaryImagesReadyRef.current.size >= 5 &&
      isMountedRef.current
    ) {
      setSecondaryImagesReady(true);
    }
  }, []);

  useEffect(() => {
    if (
      !onReady ||
      !initialSceneReady ||
      initialReadyReportedRef.current
    ) {
      return undefined;
    }

    initialReadyFrameRef.current = requestAnimationFrame(() => {
      initialReadyFrameRef.current = null;
      if (!isMountedRef.current || initialReadyReportedRef.current) return;
      initialReadyReportedRef.current = true;
      onReady();
    });

    return () => {
      if (initialReadyFrameRef.current !== null) {
        cancelAnimationFrame(initialReadyFrameRef.current);
        initialReadyFrameRef.current = null;
      }
    };
  }, [
    initialSceneReady,
    onReady,
  ]);

  useEffect(() => {
    if (!isCompleting) return undefined;

    completionFrameRef.current = requestAnimationFrame(() => {
      completionFrameRef.current = requestAnimationFrame(() => {
        completionFrameRef.current = null;
        if (isMountedRef.current) onComplete?.();
      });
    });
    return () => {
      if (completionFrameRef.current !== null) {
        cancelAnimationFrame(completionFrameRef.current);
        completionFrameRef.current = null;
      }
    };
  }, [isCompleting, onComplete]);

  const relaxTranslateY = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8],
    outputRange: [window.height, 0, 0, 0, 0],
  });

  const playAnimation = useCallback((toValue, duration = SCREEN_TRANSITION_MS) => {
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
    (toValue, nextStep, duration = SCREEN_TRANSITION_MS) => {
      if (transitionLockedRef.current) return null;
      transitionLockedRef.current = true;
      if (isMountedRef.current) setIsAnimating(true);
      return playAnimation(toValue, duration)
        .then(finished => {
          if (finished && isMountedRef.current) {
            stepRef.current = nextStep;
            setStep(nextStep);
          }
          return finished;
        })
        .finally(() => {
          if (isMountedRef.current) setIsAnimating(false);
          transitionLockedRef.current = false;
        });
    },
    [playAnimation]
  );

  const onNextClick = useCallback(async () => {
    const currentStep = stepRef.current;
    if (currentStep === 0) {
      const transition = beginTransition(0.2, 1);
      if (!transition) return;
      await transition;
    } else if (currentStep === 1) {
      const transition = beginTransition(0.4, 2);
      if (!transition) return;
      await transition;
    } else {
      // Detach native animated nodes before replacing the Fabric tree with
      // navigation/paywall to prevent concurrent mounting transactions.
      if (transitionLockedRef.current) return;
      transitionLockedRef.current = true;
      animationController.current.stopAnimation(() => {
        animationController.current.removeAllListeners();
        if (isMountedRef.current) setIsCompleting(true);
      });
    }
  }, [beginTransition]);

  const onBackClick = useCallback(() => {
    const currentStep = stepRef.current;
    if (currentStep === 2) beginTransition(0.2, 1);
    else if (currentStep === 1) beginTransition(0.0, 0);
  }, [beginTransition]);

  const onSkipClick = useCallback(async () => {
    await beginTransition(0.4, 2, SKIP_TRANSITION_MS);
  }, [beginTransition]);

  return (
    <View onLayout={() => setInitialLayoutReady(true)} style={styles.bg}>
      <ImageBackground
        onLoad={() => setInitialBackgroundReady(true)}
        onError={() => setInitialBackgroundReady(true)}
        source={require('../../assets/images/onboardingtheme.jpg')}
        style={styles.bg}
        imageStyle={styles.bgImage}
      >
        <View style={styles.overlay} pointerEvents="box-none">
          <SplashView
            {...{ onNextClick, animationController, isAnimating }}
            interactionEnabled={initialSceneReady}
            onCriticalImageReady={() => setInitialHeroReady(true)}
          />
          <Animated.View
            renderToHardwareTextureAndroid={isAnimating}
            style={[
              styles.scenesContainer,
              { transform: [{ translateY: relaxTranslateY }] },
            ]}
            pointerEvents="box-none"
          >
            {secondaryScenesMounted ? (
              <>
                <RelaxView
                  animationController={animationController}
                  isAnimating={isAnimating}
                  onImageReady={handleSecondaryImageReady}
                />
                <CareView
                  animationController={animationController}
                  isAnimating={isAnimating}
                  onImageReady={handleSecondaryImageReady}
                />
              </>
            ) : null}
          </Animated.View>
          <TopBackSkipView {...{ onBackClick, onSkipClick, animationController, isAnimating }} />
          <CenterNextButton {...{ onNextClick, animationController, isAnimating, step }} />
        </View>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  // This color must be opaque on the very first onboarding frame so the
  // preloaded paywall image can never bleed through while this bitmap decodes.
  bg: { flex: 1, backgroundColor: '#0A0A0A' },
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

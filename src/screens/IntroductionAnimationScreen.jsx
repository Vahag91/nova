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

  // Performance monitoring removed for production

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

  const playAnimation = useCallback(
    (toValue, duration = 1600) => {
      Animated.timing(animationController.current, {
        toValue,
        duration,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1.0),
        useNativeDriver: true,
      }).start();
    },
    [],
  );

  const onNextClick = useCallback(() => {
    let toValue;
    const currentValue = animValue.current;
    
    if (currentValue < 0.2) {
      toValue = 0.2;
    } else if (currentValue >= 0.2 && currentValue < 0.4) {
      toValue = 0.4;
    } else if (currentValue >= 0.4 && currentValue < 0.6) {
      toValue = 0.6;
    } else if (currentValue >= 0.6 && currentValue < 0.8) {
      toValue = 0.8;
    } else if (currentValue >= 0.8) {
      navigation.goBack();
      return;
    }

    toValue !== undefined && playAnimation(toValue);
  }, [playAnimation, navigation]);

  const onBackClick = useCallback(() => {
    const currentValue = animValue.current;
    let toValue;
    
    if (currentValue >= 0.8) {
      toValue = 0.6;
    } else if (currentValue >= 0.6 && currentValue < 0.8) {
      toValue = 0.4;
    } else if (currentValue >= 0.4 && currentValue < 0.6) {
      toValue = 0.2;
    } else if (currentValue >= 0.2 && currentValue < 0.4) {
      toValue = 0.0;
    }

    toValue !== undefined && playAnimation(toValue);
  }, [playAnimation]);

  const onSkipClick = useCallback(() => {
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
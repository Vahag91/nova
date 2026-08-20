import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors } from '../styles/colors';

const LOADER_COLOR = '#0ABAB5';
const DOT_STYLES = [
  ['dotTop', 'dot100'],
  ['dotUpperRight', 'dot72'],
  ['dotLowerRight', 'dot50'],
  ['dotBottom', 'dot34'],
  ['dotLowerLeft', 'dot20'],
  ['dotUpperLeft', 'dot10'],
];

export default function StartupLoadingScreen({ onReady }) {
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();
  const [layoutReady, setLayoutReady] = useState(false);
  const readyFrameRef = useRef(null);
  const rotation = useRef(new Animated.Value(0)).current;
  const screenHeight = Dimensions.get('screen').height;
  const statusBarHeight =
    Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0;
  // The Android splash icon is centered across the physical display while
  // the React root stops above the navigation bar. Subtract the translucent
  // status-bar inset, then compensate for half of the remaining bottom inset.
  const nativeCenterOffset =
    Platform.OS === 'android'
      ? Math.max(0, (screenHeight - windowHeight - statusBarHeight) / 2)
      : 0;

  const rotationStyle = useMemo(
    () => ({
      transform: [
        {
          rotate: rotation.interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
          }),
        },
      ],
    }),
    [rotation],
  );

  useEffect(() => {
    rotation.setValue(0);
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 780,
        easing: Easing.linear,
        isInteraction: false,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [rotation]);

  useEffect(() => {
    if (!onReady || !layoutReady) return undefined;

    readyFrameRef.current = requestAnimationFrame(() => {
      readyFrameRef.current = null;
      onReady();
    });

    return () => {
      if (readyFrameRef.current !== null) {
        cancelAnimationFrame(readyFrameRef.current);
        readyFrameRef.current = null;
      }
    };
  }, [layoutReady, onReady]);

  const handleLayout = useCallback(() => {
    setLayoutReady(true);
  }, []);

  return (
    <View
      accessibilityLabel={t('app.launch.accessibilityLabel')}
      onLayout={handleLayout}
      style={styles.loadingContainer}>
      <View
        style={[
          styles.loaderPositioner,
          { transform: [{ translateY: nativeCenterOffset }] },
        ]}>
        <Animated.View style={[styles.loader, rotationStyle]}>
          {DOT_STYLES.map(([position, opacity], index) => (
            <View
              key={index}
              style={[styles.dot, styles[position], styles[opacity]]}
            />
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loader: {
    width: 24,
    height: 24,
  },
  loaderPositioner: {
    width: 24,
    height: 24,
  },
  dot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: LOADER_COLOR,
  },
  dotTop: { left: 10, top: 1 },
  dotUpperRight: { left: 17, top: 5 },
  dotLowerRight: { left: 17, top: 13 },
  dotBottom: { left: 10, top: 17 },
  dotLowerLeft: { left: 3, top: 13 },
  dotUpperLeft: { left: 3, top: 5 },
  dot100: { opacity: 1 },
  dot72: { opacity: 0.72 },
  dot50: { opacity: 0.5 },
  dot34: { opacity: 0.34 },
  dot20: { opacity: 0.2 },
  dot10: { opacity: 0.1 },
});

import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import SvgIcon from '../SvgIcon';

export const workspaceThemes = {
  document: {
    accent: '#F4D8AA',
    secondary: '#D7C4EE',
    gradient: ['#F4DDBB', '#E8C8A4'],
    hero: ['#302A24', '#24211E', '#1C1B19'],
    panel: '#28241F',
    border: '#42382E',
    selection: '#493B30',
    glow: '#248AF5',
  },
  video: {
    accent: '#D6C9EE',
    secondary: '#F4D8AA',
    gradient: ['#E0D1F4', '#C3B0E1'],
    hero: ['#2C2733', '#24212B', '#1B191F'],
    panel: '#27232E',
    border: '#40364D',
    selection: '#44384F',
    glow: '#A66AFF',
  },
};

// Decorative motion stops off-screen, in the background and for reduced motion.
function useAmbientMotion() {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(
    AppState.currentState === 'active',
  );
  const [reduced, setReduced] = useState(true);
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let live = true;
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled())
      .then(enabled => {
        if (live) setReduced(!!enabled);
      })
      .catch(() => {});
    const reduce = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduced,
    );
    const state = AppState.addEventListener('change', next =>
      setForeground(next === 'active'),
    );
    return () => {
      live = false;
      reduce.remove();
      state.remove();
    };
  }, []);
  useEffect(() => {
    if (!focused || !foreground || reduced) {
      value.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [focused, foreground, reduced, value]);
  return value;
}

export function WorkspaceHero({ video, c }) {
  const motion = useAmbientMotion();
  return (
    <View style={styles.studioHero}>
      <View
        style={styles.scene}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.Image
          source={require('../../../assets/images/workspace/cloud-studio.png')}
          resizeMode="cover"
          style={[
            styles.sceneImage,
            {
              transform: [
                {
                  scale: motion.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1.02, 1.07],
                  }),
                },
                {
                  translateY: motion.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -4],
                  }),
                },
              ],
            },
          ]}
        />
        <LinearGradient
          colors={['#F4D0BB00', '#F4D0BB']}
          style={styles.sceneFade}
        />
      </View>
      <View style={styles.studioCopy}>
        <Text style={styles.studioKicker}>
          {c('studioLabel', 'A little more clarity.')}
        </Text>
        <Text accessibilityRole="header" style={styles.studioTitle}>
          {video
            ? c('studioVideoTitle', 'Watch less.\nTake more away.')
            : c('studioDocumentTitle', 'Big ideas.\nLess reading.')}
        </Text>
        <Text style={styles.studioDescription}>
          {video
            ? c(
                'studioVideoDescriptionV3',
                'See the whole story. Turn scenes and spoken words into ideas you can come back to.',
              )
            : c(
                'studioDocumentDescription',
                'From a whole lot of pages to your next lightbulb moment.',
              )}
        </Text>
      </View>
    </View>
  );
}

export function WorkspaceProcessing({ video }) {
  const theme = workspaceThemes[video ? 'video' : 'document'];
  const motion = useAmbientMotion();
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.wave}
    >
      {[16, 26, 38, 22, 32, 44, 28, 18, 34].map((height, index) => (
        <Animated.View
          key={index}
          style={{
            width: 5,
            height,
            borderRadius: 3,
            backgroundColor: index % 3 === 0 ? theme.secondary : theme.accent,
            opacity: 0.85,
            transform: [
              {
                scaleY: motion.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: index % 2 ? [0.4, 1, 0.65] : [1, 0.45, 0.9],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

export function WorkspaceResultMark({ video }) {
  const theme = workspaceThemes[video ? 'video' : 'document'];
  return (
    <View
      accessible={false}
      style={[styles.resultArt, { backgroundColor: theme.accent }]}
    >
      <SvgIcon
        name={video ? 'workspace-video' : 'workspace-document'}
        size={24}
        color="#29231F"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  studioHero: {
    borderRadius: 28,
    backgroundColor: '#F4D0BB',
    overflow: 'hidden',
  },
  scene: { height: 158, overflow: 'hidden' },
  sceneImage: { width: '100%', height: 240, position: 'absolute', top: -36 },
  sceneFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 55 },
  studioCopy: { paddingHorizontal: 24, paddingBottom: 25, gap: 10 },
  studioKicker: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Lato-Bold',
    color: '#684C40',
  },
  studioTitle: {
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1.1,
    fontFamily: 'Lato-Bold',
    color: '#2C2521',
  },
  studioDescription: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Lato-Regular',
    color: '#634C41',
    maxWidth: 300,
  },
  hero: {
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    overflow: 'hidden',
    gap: 14,
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kicker: {
    fontFamily: 'Lato-Bold',
    fontSize: 10,
    letterSpacing: 1.6,
    flexShrink: 1,
    lineHeight: 16,
  },
  heroRow: { minHeight: 142, flexDirection: 'row', alignItems: 'center' },
  heroStack: { flexDirection: 'column-reverse' },
  heroCopy: { width: '59%', zIndex: 1 },
  heroCopyStack: { width: '100%' },
  headline: {
    fontFamily: 'Lato-Bold',
    fontSize: 29,
    lineHeight: 35,
    letterSpacing: -0.6,
    color: '#F7FAFF',
  },
  artWrap: {
    position: 'absolute',
    width: '53%',
    height: 184,
    right: -20,
    top: -19,
  },
  artStack: {
    position: 'relative',
    width: 180,
    height: 160,
    right: 0,
    top: 0,
    alignSelf: 'center',
  },
  art: { width: '100%', height: '100%' },
  description: {
    color: '#BCCCE2',
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Lato-Regular',
  },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF06',
  },
  featureText: {
    fontFamily: 'Lato-Bold',
    fontSize: 11,
    lineHeight: 16,
    color: '#DCE8FA',
  },
  dot: { width: 4, height: 4, borderRadius: 2 },
  orbit: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1,
    top: -60,
    right: -100,
  },
  orbitInner: {
    width: 230,
    height: 230,
    borderRadius: 115,
    right: -65,
    top: -25,
  },
  glow: {
    position: 'absolute',
    right: -40,
    top: 0,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  wave: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  resultArt: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultImage: { width: 64, height: 64, margin: -3 },
});

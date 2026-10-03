import React, { memo, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import SvgIcon from '../SvgIcon';

// Both workspaces share the app palette: flat grey panels, one orange accent.
// `gradient` and `hero` stay arrays because callers pass them to a gradient
// view; equal stops render as a flat fill.
const flatTheme = {
  accent: '#F05A28',
  secondary: '#A6A6AB',
  gradient: ['#F05A28', '#F05A28'],
  hero: ['#2D2D31', '#2D2D31', '#2D2D31'],
  panel: '#2D2D31',
  border: 'transparent',
  selection: '#39393E',
  glow: '#F05A28',
};

export const workspaceThemes = {
  document: flatTheme,
  video: flatTheme,
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

export const WorkspaceHero = memo(function WorkspaceHero({ video, c }) {
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
});

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

export function WorkspacePendingCard({ video, title, status, progress, actions }) {
  const theme = workspaceThemes[video ? 'video' : 'document'];
  const motion = useAmbientMotion();
  return (
    <View style={pendingStyles.card}>
      <View style={pendingStyles.row}>
        <Animated.View
          accessible={false}
          style={[pendingStyles.icon, {
            opacity: motion.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }),
            transform: [{ scale: motion.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] }) }],
          }]}
        >
          <SvgIcon name={video ? 'workspace-video' : 'workspace-document'} size={22} color={theme.accent} />
        </Animated.View>
        <View style={pendingStyles.copy}>
          <Text style={pendingStyles.status} numberOfLines={2}>{status}</Text>
          {!!title && <Text style={pendingStyles.title} numberOfLines={2}>{title}</Text>}
        </View>
        {progress != null && <Text style={pendingStyles.percent}>{Math.round(progress * 100)}%</Text>}
      </View>
      <Animated.View
        accessible={false}
        style={[pendingStyles.track, { opacity: motion.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.75] }) }]}
      />
      <View style={pendingStyles.actions}>
        {actions.map(({ label, onPress, testID, secondary, disabled }) => (
          <Pressable key={testID} testID={testID} onPress={onPress} disabled={disabled}
            accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}
            style={({ pressed }) => [pendingStyles.action, !secondary && pendingStyles.primary, { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}
          >
            <Text style={[pendingStyles.actionText, secondary && pendingStyles.secondaryText]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const pendingStyles = StyleSheet.create({
  card: { backgroundColor: '#2D2D31', borderRadius: 20, padding: 14, marginVertical: 6, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F05A281A', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  status: { color: '#A6A6AB', fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  title: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', lineHeight: 21 },
  percent: { color: '#F05A28', fontSize: 13, fontWeight: '600' },
  track: { height: 2, borderRadius: 1, backgroundColor: '#F05A28' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#F05A2824' },
  actionText: { color: '#F05A28', fontWeight: '600', fontSize: 13 },
  secondaryText: { color: '#A6A6AB' },
});

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
        color="#FFFFFF"
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

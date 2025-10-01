// app/src/components/chat/VoiceOverlay.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSpring, Easing } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import SvgIcon from '../SvgIcon';
import { colors } from '../../styles/colors';

export default function VoiceOverlay({ visible, isRecording, transcript, onInsert, onClose }) {
  const dots = 24;
  const progress = useRef(new Animated.Value(0)).current;
  const micPulse = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);
  const sheetOffset = useSharedValue(480);
  const [render, setRender] = useState(visible);
  const bars = 18;
  const barValsRef = useRef(Array.from({ length: bars }, () => new Animated.Value(0)));
  const barLoopsRef = useRef([]);
  const progLoopRef = useRef(null);

  // mount/unmount controller to allow exit animation
  useEffect(() => {
    if (visible) setRender(true);
    const EXIT_MS = 280;
    if (!visible) {
      const t = setTimeout(() => setRender(false), EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [visible]);

  // start/stop visual loops
  useEffect(() => {
    if (!render) return;
    if (visible) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(progress, { toValue: 1, duration: 1400, useNativeDriver: false }),
          Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: false }),
        ])
      );
      loop.start();
      progLoopRef.current = loop;
      barLoopsRef.current = barValsRef.current.map((v, i) => {
        const seq = Animated.loop(
          Animated.sequence([
            Animated.timing(v, { toValue: 1, duration: 750, delay: i * 60, useNativeDriver: false }),
            Animated.timing(v, { toValue: 0, duration: 750, useNativeDriver: false }),
          ])
        );
        seq.start();
        return seq;
      });
    }
    return () => {
      progLoopRef.current?.stop?.();
      barLoopsRef.current.forEach(l => l?.stop?.());
    };
  }, [render, visible, progress]);

  // animate show/hide
  useEffect(() => {
    if (!render) return;
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      sheetOffset.value = withSpring(0, { damping: 22, stiffness: 180, mass: 0.9, overshootClamping: true });
      micPulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
    } else {
      overlayOpacity.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) });
      sheetOffset.value = withTiming(480, { duration: 280, easing: Easing.in(Easing.cubic) });
      micPulse.value = withTiming(0, { duration: 120 });
    }
  }, [render, visible]);

  const wrapAnimatedStyle = useAnimatedStyle(() => ({ backgroundColor: `rgba(0,0,0,${0.88 * overlayOpacity.value})` }));
  const sheetAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetOffset.value }] }));
  const micWrapStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + micPulse.value * 0.08 }], shadowOpacity: 0.35 + micPulse.value * 0.3 }));

  const dotViews = useMemo(() => Array.from({ length: dots }), [dots]);
  const activeIndex = progress.interpolate({ inputRange: [0, 1], outputRange: [0, dots - 1] });

  if (!render) return null;

  return (
    <Reanimated.View style={[styles.wrap, wrapAnimatedStyle]} pointerEvents="auto">
      <Reanimated.View style={[styles.sheet, sheetAnimatedStyle]}>
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="voice_overlay_grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0B0B0BCC" />
              <Stop offset="0.55" stopColor="#0B0B0BB3" />
              <Stop offset="1" stopColor="#0B1220CC" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height="100%" fill="url(#voice_overlay_grad)" />
        </Svg>
        <View style={styles.handle} />
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close recorder">
          <SvgIcon name="clear" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>{transcript?.trim()?.length ? transcript : (isRecording ? 'Listening…' : 'Start recording…')}</Text>

          <Reanimated.View style={[styles.micWrap, micWrapStyle]}>
            <View style={styles.micCircle}>
              <SvgIcon name="mic" size={40} color="#FFFFFF" />
            </View>
          </Reanimated.View>

          <View style={styles.waveRow}>
            {barValsRef.current.map((v, i) => {
              const h = v.interpolate({ inputRange: [0, 1], outputRange: [10, 60] });
              return (
                <Animated.View key={i} style={[styles.waveBar, { height: h }]} />
              );
            })}
          </View>
        </View>

        <TouchableOpacity style={[styles.insertBtn, !transcript?.trim()?.length && styles.insertDisabled]} onPress={onInsert} disabled={!transcript?.trim()?.length} accessibilityLabel="Insert transcript">
          <Text style={styles.insertText}>Insert</Text>
        </TouchableOpacity>
      </Reanimated.View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#00000088', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111213', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 18, paddingBottom: 28, paddingHorizontal: 20, minHeight: 380, overflow: 'hidden', borderTopWidth: 1, borderColor: '#3B82F633', alignSelf: 'stretch' },
  handle: { alignSelf: 'center', width: 56, height: 6, borderRadius: 3, backgroundColor: '#2A2A2A', marginBottom: 12 },
  closeBtn: { position: 'absolute', right: 14, top: 14, padding: 10 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 6, paddingBottom: 10 },
  title: { fontSize: 18, color: '#E5E7EB', textAlign: 'center', marginBottom: 16, paddingHorizontal: 8, fontFamily: 'Lato-Regular' },
  micWrap: { width: 124, height: 124, borderRadius: 62, backgroundColor: '#2563EBCC', alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#3B82F6' },
  micCircle: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
  waveRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', height: 80, marginTop: 6, marginBottom: 24, paddingHorizontal: 6 },
  waveBar: { width: 4, marginHorizontal: 3, borderRadius: 2, backgroundColor: '#60A5FA' },
  insertBtn: { alignSelf: 'stretch', backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 16, marginTop: 8, marginHorizontal: 20, shadowColor: 'rgba(59,130,246,0.5)', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 12 },
  insertDisabled: { opacity: 0.5 },
  insertText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'Lato-Bold', textAlign: 'center' },
});



// app/src/components/chat/VoiceOverlay.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSpring,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import SvgIcon from '../SvgIcon';
import { colors } from '../../styles/colors';
import { useTranslation } from 'react-i18next';

const BAR_COUNT = 18;

// Smooth + gated behavior
const PHASE_MS = 2400;
const SPEAK_ENERGY = 0.54;  // modest amplitude while speaking
const RISE_MS = 160;        // gentle ramp up
const FALL_MS = 650;        // smooth fall after silence
const SILENCE_MS = 700;     // how long without tokens = "silence"

function WaveBar({ i, phase, energy, offsets, centers }) {
  const style = useAnimatedStyle(() => {
    const wave = 0.5 + 0.5 * Math.sin(phase.value + offsets[i]); // 0..1
    const hNorm = 0.02 + energy.value * wave * centers[i];        // ~0.02..~0.38
    return { 
      height: 10 + hNorm * 40,
      opacity: 0.7 + energy.value * 0.3 // Dynamic opacity for smoother appearance
    };
  }, [phase, energy, offsets, centers]);
  
  return <Reanimated.View style={[styles.waveBar, style]} />;
}

export default function VoiceOverlay({ visible, isRecording, transcript, onInsert, onClose }) {
  const { t } = useTranslation();
  const { height: screenH } = useWindowDimensions();



  // mount/unmount for exit anim
  const [render, setRender] = useState(visible);
  useEffect(() => {
    if (visible) setRender(true);
    const EXIT_MS = 280;
    if (!visible) {
      const t = setTimeout(() => setRender(false), EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [visible]);

  // overlay drivers
  const overlayOpacity = useSharedValue(0);
  const sheetOffset = useSharedValue(480);
  const micPulse = useSharedValue(0);
  const isOpen = useSharedValue(false);

  // Spring config matching menu animation
  const SPRING_CONFIG = {
    duration: 1200,
    overshootClamping: true,
    dampingRatio: 0.8,
  };

  // wave drivers (single envelope)
  const phase = useSharedValue(0);
  const energy = useSharedValue(0);

  // simple speech gate
  const speakingGateRef = useRef(false);
  const silenceTORef = useRef(null);
  const lastTranscript = useRef('');

  // precomputed arrays captured by worklets
  const pos = useMemo(() => Array.from({ length: BAR_COUNT }, (_, i) => (BAR_COUNT <= 1 ? 0 : i / (BAR_COUNT - 1))), []);
  const centers = useMemo(() => pos.map(p => 0.6 + 0.4 * Math.sin(p * Math.PI)), [pos]); // center emphasis
  const offsets = useMemo(() => Array.from({ length: BAR_COUNT }, (_, i) => i * 0.35), []);

  // Clean up animations on unmount
  useEffect(() => {
    return () => {
      // Clear any pending timeouts
      if (silenceTORef.current) {
        clearTimeout(silenceTORef.current);
      }
      // Cancel all animations
      cancelAnimation(phase);
      cancelAnimation(energy);
      cancelAnimation(micPulse);
    };
  }, []);

  // show/hide overlay & pulse
  useEffect(() => {
    if (!render) return;
    
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      sheetOffset.value = withSpring(0, { damping: 22, stiffness: 180, mass: 0.9, overshootClamping: true });
      // Delay opening animation slightly
      setTimeout(() => {
        isOpen.value = true;
      }, 50);
      micPulse.value = withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }), 
        -1, 
        true
      );
    } else {
      isOpen.value = false;
      overlayOpacity.value = withTiming(0, { duration: 220, easing: Easing.in(Easing.cubic) });
      sheetOffset.value = withTiming(480, { duration: 280, easing: Easing.in(Easing.cubic) });
      cancelAnimation(micPulse);
      micPulse.value = withTiming(0, { duration: 120 });
    }
  }, [render, visible]);

  // start/stop recording - FIXED VERSION
  useEffect(() => {
    // Clear any pending silence timeout
    if (silenceTORef.current) { 
      clearTimeout(silenceTORef.current); 
      silenceTORef.current = null; 
    }
    
    speakingGateRef.current = false;
    lastTranscript.current = '';

    if (isRecording) {
      // Cancel previous animations
      cancelAnimation(phase);
      cancelAnimation(energy);
      
      // Park phase; no animation until voice is detected
      phase.value = -Math.PI / 2;
      energy.value = withTiming(0, { duration: 150 });
    } else {
      // Stop recording - smoothly stop animations
      cancelAnimation(phase);
      cancelAnimation(energy);
      
      energy.value = withTiming(0, { 
        duration: 180,
        easing: Easing.out(Easing.cubic)
      });
    }
  }, [isRecording]);

  // transcript changes → gate-based control - FIXED VERSION
  useEffect(() => {
    if (!isRecording) return;
    
    const t = (transcript || '').trim();

    // Ignore if nothing changed
    if (t === lastTranscript.current) return;
    lastTranscript.current = t;

    // Clear existing timeout
    if (silenceTORef.current) { 
      clearTimeout(silenceTORef.current); 
    }

    // If we have new text content
    if (t.length > 0) {
      // Set silence timeout
      silenceTORef.current = setTimeout(() => {
      // Silence detected - drop to baseline
      speakingGateRef.current = false;
      cancelAnimation(phase);
      phase.value = -Math.PI / 2; // park low, no sine updates
      cancelAnimation(energy);
      energy.value = withTiming(0, { 
        duration: FALL_MS, 
        easing: Easing.inOut(Easing.cubic) 
      });
        silenceTORef.current = null;
      }, SILENCE_MS);

      // If we weren't speaking before, ramp up
      if (!speakingGateRef.current) {
        speakingGateRef.current = true;
        // start wave only now
        cancelAnimation(phase);
        phase.value = -Math.PI / 2;
        phase.value = withRepeat(
          withTiming(phase.value + 2 * Math.PI, { 
            duration: PHASE_MS, 
            easing: Easing.linear 
          }),
          -1,
          false
        );
        cancelAnimation(energy);
        energy.value = withTiming(SPEAK_ENERGY, { 
          duration: RISE_MS, 
          easing: Easing.out(Easing.cubic) 
        });
      }
    } else {
      // No text - ensure we're at baseline
      speakingGateRef.current = false;
      cancelAnimation(phase);
      phase.value = -Math.PI / 2; // park low, no sine updates
      cancelAnimation(energy);
      energy.value = withTiming(0, { 
        duration: FALL_MS, 
        easing: Easing.inOut(Easing.cubic) 
      });
    }

    // Cleanup timeout on unmount or effect re-run
    return () => {
      if (silenceTORef.current) {
        clearTimeout(silenceTORef.current);
      }
    };
  }, [transcript, isRecording]);

  const wrapAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(0,0,0,${0.88 * overlayOpacity.value})`,
  }), [overlayOpacity]);

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetOffset.value }],
  }), [sheetOffset]);

  const micWrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + micPulse.value * 0.14 }],
    shadowOpacity: 0.35 + micPulse.value * 0.35,
    shadowRadius: 8 + micPulse.value * 10,
  }), [micPulse]);

  // Staggered animations for different elements
  const getElementStyle = (index) => {
    return useAnimatedStyle(() => {
      const delay = index * 60;
      const scaleValue = isOpen.value ? 1 : 0;
      const translateValue = isOpen.value ? 0 : 30;
      
      return {
        opacity: withDelay(delay, withTiming(scaleValue, { duration: 200 })),
        transform: [
          { translateY: withDelay(delay, withSpring(translateValue, SPRING_CONFIG)) },
          { scale: withDelay(delay, withSpring(scaleValue, SPRING_CONFIG)) },
        ],
      };
    });
  };

  const titleStyle = getElementStyle(0);
  const micStyle = getElementStyle(1);
  const waveStyle = getElementStyle(2);
  const buttonStyle = getElementStyle(3);

  const titleText = useMemo(() => {
    const txt = transcript?.trim();
    if (txt?.length) return txt;
    return isRecording ? t('chat.listening') : t('chat.startRecording');
  }, [transcript, isRecording, t]);

  if (!render) return null;

  return (
    <Reanimated.View style={[styles.wrap, wrapAnimatedStyle]} pointerEvents="auto">
      <Reanimated.View style={[styles.sheet, { maxHeight: screenH * 0.92 }, sheetAnimatedStyle]}>
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

        <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel={t('chat.closeRecorder')}>
          <SvgIcon name="clear" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.content}>
          <Reanimated.View style={[styles.titleWrap, { maxHeight: screenH * 0.4 }, titleStyle]}>
            <ScrollView
              style={styles.titleScroll}
              contentContainerStyle={styles.titleScrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              <Text style={styles.title} maxFontSizeMultiplier={1.3}>
                {titleText}
              </Text>
            </ScrollView>
          </Reanimated.View>

          <Reanimated.View style={[styles.micWrap, micWrapStyle, micStyle]}>
            <View style={styles.micCircle}>
              <SvgIcon name="mic" size={32} color="#FFFFFF" />
            </View>
          </Reanimated.View>

          <Reanimated.View style={[styles.waveRow, waveStyle]}>
            {Array.from({ length: BAR_COUNT }).map((_, i) => (
              <WaveBar 
                key={i} 
                i={i} 
                phase={phase} 
                energy={energy} 
                offsets={offsets} 
                centers={centers} 
              />
            ))}
          </Reanimated.View>
        </View>

        <Reanimated.View style={buttonStyle}>
          <TouchableOpacity
            style={[styles.insertBtn, !transcript?.trim()?.length && styles.insertDisabled]}
            onPress={onInsert}
            disabled={!transcript?.trim()?.length}
            accessibilityLabel={t('chat.insertTranscript')}
          >
            <Text style={styles.insertText}>{t('chat.insertTranscript')}</Text>
          </TouchableOpacity>
        </Reanimated.View>
      </Reanimated.View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { 
    position: 'absolute', 
    left: 0, 
    right: 0, 
    top: 0, 
    bottom: 0, 
    backgroundColor: '#00000088', 
    justifyContent: 'flex-end',
    zIndex: 1000 
  },
  sheet: { 
    backgroundColor: '#111213', 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    paddingTop: 18, 
    paddingBottom: 28, 
    paddingHorizontal: 20, 
    minHeight: 380, 
    overflow: 'hidden', 
    borderTopWidth: 1, 
    borderColor: '#3B82F633', 
    alignSelf: 'stretch' 
  },
  handle: { 
    alignSelf: 'center', 
    width: 56, 
    height: 6, 
    borderRadius: 3, 
    backgroundColor: '#2A2A2A', 
    marginBottom: 12 
  },
  closeBtn: { 
    position: 'absolute', 
    right: 14, 
    top: 14, 
    padding: 10,
    zIndex: 1 
  },
  content: { 
    justifyContent: 'flex-start', 
    alignItems: 'center', 
    paddingTop: 6, 
    paddingBottom: 10, 
    alignSelf: 'stretch' 
  },
  titleWrap: { 
    alignSelf: 'stretch', 
    marginBottom: 12, 
    paddingHorizontal: 8 
  },
  titleScroll: { 
    alignSelf: 'stretch' 
  },
  titleScrollContent: { 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  title: { 
    fontSize: 18, 
    lineHeight: 22, 
    color: '#E5E7EB', 
    textAlign: 'center', 
    fontFamily: 'Lato-Regular' 
  },
  micWrap: { 
    width: 75, 
    height: 75, 
    borderRadius: 50, 
    backgroundColor: '#2563EBCC', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 16, 
    shadowColor: '#3B82F6', 
    shadowOffset: { width: 0, height: 0 }, 
    flexShrink: 0 
  },
  micCircle: { 
    width: 60, 
    height: 60, 
    borderRadius: 44, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  waveRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    justifyContent: 'center', 
    height: 80, 
    marginTop: 6, 
    marginBottom: 24, 
    paddingHorizontal: 6, 
    flexShrink: 0 
  },
  waveBar: { 
    width: 4, 
    marginHorizontal: 3, 
    borderRadius: 2, 
    backgroundColor: '#60A5FA',
    minHeight: 10 // Ensure minimum height
  },
  insertBtn: { 
    alignSelf: 'stretch', 
    backgroundColor: colors.primary, 
    paddingHorizontal: 24, 
    paddingVertical: 16, 
    borderRadius: 16, 
    marginTop: 8, 
    marginHorizontal: 20, 
    shadowColor: 'rgba(59,130,246,0.5)', 
    shadowOffset: { width: 0, height: 0 }, 
    shadowOpacity: 1, 
    shadowRadius: 12 
  },
  insertDisabled: { 
    opacity: 0.5 
  },
  insertText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontFamily: 'Lato-Bold', 
    textAlign: 'center' 
  },
});
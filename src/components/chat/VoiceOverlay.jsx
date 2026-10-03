// app/src/components/chat/VoiceOverlay.jsx
import React, { useEffect, useMemo, useRef, useState, memo } from 'react';
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
import SvgIcon from '../SvgIcon';
import { colors } from '../../styles/colors';
import { useTranslation } from 'react-i18next';

const BAR_COUNT = 18;
const TRANSCRIPT_LINE_HEIGHT = 24;
const TRANSCRIPT_MAX_LINES = 3;
const TRANSCRIPT_MAX_HEIGHT = TRANSCRIPT_LINE_HEIGHT * TRANSCRIPT_MAX_LINES;

// Smooth + gated behavior
const PHASE_MS = 2400;
const SPEAK_ENERGY = 0.54;  // modest amplitude while speaking
const RISE_MS = 160;        // gentle ramp up
const FALL_MS = 650;        // smooth fall after silence
const SILENCE_MS = 700;     // how long without tokens = "silence"

const SPRING_CONFIG = {
  duration: 1200,
  overshootClamping: true,
  dampingRatio: 0.8,
};

function useEntranceAnimatedStyle(index, isOpenShared) {
  return useAnimatedStyle(() => {
    const delay = index * 60;
    const open = isOpenShared.value ? 1 : 0;
    const translateValue = open ? 0 : 30;

    return {
      opacity: withDelay(delay, withTiming(open, { duration: 200 })),
      transform: [
        { translateY: withDelay(delay, withSpring(translateValue, SPRING_CONFIG)) },
        { scale: withDelay(delay, withSpring(open, SPRING_CONFIG)) },
      ],
    };
  }, [isOpenShared, index]);
}

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

function VoiceOverlay({ visible, isRecording, transcript, volume = 0, onInsert, onClose }) {
  useEffect(() => {}, []);
  const { t } = useTranslation();
  const { height: screenH } = useWindowDimensions();
  const transcriptScrollRef = useRef(null);



  // mount/unmount for exit anim
  const [render, setRender] = useState(visible);
  useEffect(() => {
    if (visible) setRender(true);
    const EXIT_MS = 280;
    if (!visible) {
      const d = setTimeout(() => setRender(false), EXIT_MS);
      return () => clearTimeout(d);
    }
  }, [visible]);

  // overlay drivers
  const overlayOpacity = useSharedValue(0);
  const sheetOffset = useSharedValue(480);
  const micPulse = useSharedValue(0);
  const isOpen = useSharedValue(false);

  // wave drivers (single envelope)
  const phase = useSharedValue(0);
  const energy = useSharedValue(0);

  // simple speech gate
  const speakingGateRef = useRef(false);
  const silenceTORef = useRef(null);
  const lastTranscript = useRef('');
  const smoothVolumeRef = useRef(0);
  const [smoothVolume, setSmoothVolume] = useState(0);

  useEffect(() => {
    const v = Math.max(0, Math.min(1, typeof volume === 'number' ? volume : 0));
    smoothVolumeRef.current = smoothVolumeRef.current * 0.6 + v * 0.4;
    const next = smoothVolumeRef.current;
    setSmoothVolume(next);
  }, [volume]);

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
  }, [energy, micPulse, phase]);

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
  }, [render, visible, overlayOpacity, sheetOffset, micPulse, isOpen]);

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
      smoothVolumeRef.current = 0;
      setSmoothVolume(0);
    }
  }, [isRecording, energy, phase]);

  // transcript changes → gate-based control - FIXED VERSION
  useEffect(() => {
    if (!isRecording) return;
    
    const text = (transcript || '').trim();
    lastTranscript.current = text;

    const hasText = text.length > 0;
    const volActive = smoothVolume > 0.12;
    const speaking = hasText || volActive;

    if (silenceTORef.current) { clearTimeout(silenceTORef.current); }

    if (speaking) {
      silenceTORef.current = setTimeout(() => {
        speakingGateRef.current = false;
        cancelAnimation(phase);
        phase.value = -Math.PI / 2;
        cancelAnimation(energy);
        energy.value = withTiming(0, {
          duration: FALL_MS,
          easing: Easing.inOut(Easing.cubic),
        });
        silenceTORef.current = null;
      }, SILENCE_MS);

      if (!speakingGateRef.current) {
        speakingGateRef.current = true;
        cancelAnimation(phase);
        phase.value = -Math.PI / 2;
        phase.value = withRepeat(
          withTiming(phase.value + 2 * Math.PI, {
            duration: PHASE_MS,
            easing: Easing.linear,
          }),
          -1,
          false
        );
      }

      const target = hasText ? SPEAK_ENERGY : Math.max(SPEAK_ENERGY * 0.5, smoothVolume * 0.9);
      cancelAnimation(energy);
      energy.value = withTiming(target, {
        duration: RISE_MS,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      speakingGateRef.current = false;
      cancelAnimation(phase);
      phase.value = -Math.PI / 2;
      cancelAnimation(energy);
      energy.value = withTiming(0, {
        duration: FALL_MS,
        easing: Easing.inOut(Easing.cubic),
      });
    }

    // Cleanup timeout on unmount or effect re-run
    return () => {
      if (silenceTORef.current) {
        clearTimeout(silenceTORef.current);
      }
    };
  }, [transcript, smoothVolume, isRecording, energy, phase]);

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
  const titleStyle = useEntranceAnimatedStyle(0, isOpen);
  const micStyle = useEntranceAnimatedStyle(1, isOpen);
  const waveStyle = useEntranceAnimatedStyle(2, isOpen);
  const buttonStyle = useEntranceAnimatedStyle(3, isOpen);

  const titleText = useMemo(() => {
    const txt = transcript?.trim();
    if (txt?.length) return txt;
    return isRecording ? t('chat.listening') : t('chat.startRecording');
  }, [transcript, isRecording, t]);
  const hasTranscript = !!transcript?.trim()?.length;
  const titleWrapDynamicStyle = useMemo(
    () => [
      styles.titleWrap,
      hasTranscript
        ? styles.titleWrapTranscript
        : styles.titleWrapIdle,
    ],
    [hasTranscript],
  );

  useEffect(() => {
    if (!visible || !hasTranscript) {
      return;
    }

    const timeoutId = setTimeout(() => {
      transcriptScrollRef.current?.scrollToEnd?.({ animated: false });
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [hasTranscript, titleText, visible]);

  if (!render) return null;

  return (
    <Reanimated.View style={[styles.wrap, wrapAnimatedStyle]} pointerEvents="auto">
      <Reanimated.View style={[styles.sheet, { maxHeight: screenH * 0.92 }, sheetAnimatedStyle]}>
        <View style={styles.handle} />

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => { try { onClose?.(); } catch {} }}
          accessibilityLabel={t('chat.closeRecorder')}
        >
          <SvgIcon name="clear" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.stage}>
            <Reanimated.View style={[titleWrapDynamicStyle, titleStyle]}>
              {hasTranscript ? (
                <ScrollView
                  ref={transcriptScrollRef}
                  style={styles.titleScroll}
                  contentContainerStyle={styles.titleScrollContent}
                  showsVerticalScrollIndicator
                  indicatorStyle="white"
                  nestedScrollEnabled
                  bounces={false}
                >
                  <Text style={styles.title} maxFontSizeMultiplier={1.3}>
                    {titleText}
                  </Text>
                </ScrollView>
              ) : (
                <View style={styles.titleIdleWrap}>
                  <Text
                    style={[styles.title, styles.titleIdle]}
                    maxFontSizeMultiplier={1.2}
                    numberOfLines={2}
                  >
                    {titleText}
                  </Text>
                </View>
              )}
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
        </View>

        <Reanimated.View style={[styles.footer, buttonStyle]}>
          <TouchableOpacity
            style={[styles.insertBtn, !hasTranscript && styles.insertDisabled]}
            onPress={() => { try { onInsert?.(); } catch {} }}
            disabled={!hasTranscript}
            accessibilityLabel={t('chat.insertTranscript')}
          >
            <Text style={styles.insertText}>{t('chat.insertTranscript')}</Text>
          </TouchableOpacity>
        </Reanimated.View>
      </Reanimated.View>
    </Reanimated.View>
  );
}

export default memo(VoiceOverlay);

const VOICE_GREY = '#2D2D31';
const VOICE_ACCENT = '#F05A28';

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
    backgroundColor: VOICE_GREY, 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    paddingTop: 18, 
    paddingBottom: 28, 
    paddingHorizontal: 20, 
    minHeight: 380, 
    overflow: 'hidden', 
    alignSelf: 'stretch' 
  },
  handle: { 
    alignSelf: 'center', 
    width: 56, 
    height: 6, 
    borderRadius: 3, 
    backgroundColor: '#4A4A50', 
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
    flex: 1,
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingTop: 12,
    paddingBottom: 10, 
    alignSelf: 'stretch' 
  },
  stage: {
    width: '100%',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  titleWrap: { 
    alignSelf: 'center',
    width: '100%',
    maxWidth: 292,
    minHeight: 46,
    justifyContent: 'center',
    marginBottom: 26, 
    paddingHorizontal: 10,
  },
  titleWrapTranscript: {
    maxHeight: TRANSCRIPT_MAX_HEIGHT,
  },
  titleWrapIdle: {
    maxWidth: 248,
    minHeight: 0,
    marginBottom: 28,
  },
  titleScroll: { 
    width: '100%',
  },
  titleScrollContent: { 
    flexGrow: 1,
    alignItems: 'center', 
    justifyContent: 'center',
  },
  titleIdleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { 
    fontSize: 18, 
    lineHeight: TRANSCRIPT_LINE_HEIGHT,
    color: '#E5E7EB', 
    textAlign: 'center', 
    fontFamily: 'Lato-Regular',
    width: '100%',
  },
  titleIdle: {
    fontSize: 16,
    lineHeight: 22,
    color: '#F3F4F6',
  },
  micWrap: { 
    width: 75, 
    height: 75, 
    borderRadius: 50, 
    backgroundColor: VOICE_ACCENT, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 18, 
    shadowColor: VOICE_ACCENT, 
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
    alignSelf: 'center',
    minWidth: 164,
    height: 54, 
    marginTop: 0, 
    marginBottom: 0, 
    paddingHorizontal: 0, 
    flexShrink: 0 
  },
  waveBar: { 
    width: 4, 
    marginHorizontal: 2.5, 
    borderRadius: 2, 
    backgroundColor: VOICE_ACCENT,
    minHeight: 10 // Ensure minimum height
  },
  footer: {
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  insertBtn: { 
    alignSelf: 'stretch', 
    backgroundColor: VOICE_ACCENT, 
    paddingHorizontal: 24, 
    paddingVertical: 16, 
    borderRadius: 16, 
    marginTop: 0, 
    marginHorizontal: 20, 
  },
  insertDisabled: { 
    opacity: 0.45,
  },
  insertText: { 
    color: '#FFFFFF', 
    fontSize: 16, 
    fontFamily: 'Lato-Bold', 
    textAlign: 'center' 
  },
});

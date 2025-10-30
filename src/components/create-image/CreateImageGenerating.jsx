import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useImagesStore } from '../../state/useImagesStore';
import { normalizeImageUri } from '../../lib/imageUtils';

const STEP = {
  APPLYING: 'applying',
  RESULT: 'result',
  ERROR: 'error',
};

const FALLBACK_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAc2mO4U6YlRq35lf_yjhd1ELeq_0fJ_jxfBFmsFSSC01qyVgzwJllyKbn15JEt7ID-deeH6JFNS_rzV6Y2uFUks4nBvYLQBHUYcijjCAc048dgV3HDQWo9DQbXDjmBZ8y2ywCYHoLd1mgfx51PwPFQz9j_MZTmLEeS5T1Vih_o5kfmx0J08XOKDbL-Z0Cf1P45HW7raag2_GGRhOnykAjyDDRqvg3YfgtrB11n8Lz7uN4WWSbkJ3wr0l-YvbPcW9n-xcTGMD8N2AOc';

const DEFAULT_OUTPUT = {
  outputType: 'URL',
  outputFormat: 'JPG',
  outputQuality: 95,
  n: 1,
  mode: 'text2img',
};

const TRACK_WIDTH = 220;

export default function CreateImageGenerating({ visible, payload, onClose }) {
  const createJob = useImagesStore(s => s.createJob);

  const [step, setStep] = useState(STEP.APPLYING);
  const [imageUri, setImageUri] = useState(null);
  const [error, setError] = useState(null);
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  const jobPayload = useMemo(() => {
    if (!payload) return null;
    return {
      ...DEFAULT_OUTPUT,
      ...payload,
      outputType: payload?.outputType || DEFAULT_OUTPUT.outputType,
      outputFormat: payload?.outputFormat || DEFAULT_OUTPUT.outputFormat,
      outputQuality:
        typeof payload?.outputQuality === 'number'
          ? payload.outputQuality
          : DEFAULT_OUTPUT.outputQuality,
      n: payload?.n || DEFAULT_OUTPUT.n,
      mode: payload?.mode || DEFAULT_OUTPUT.mode,
    };
  }, [payload]);

  useEffect(() => {
    if (!visible) {
      setStep(STEP.APPLYING);
      setImageUri(null);
      setError(null);
      progress.setValue(0);
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    if (!jobPayload) return;

    let cancelled = false;
    setStep(STEP.APPLYING);
    setImageUri(null);
    setError(null);
    progress.setValue(0);
    pulse.setValue(0);

    const warmup = Animated.timing(progress, {
      toValue: 0.7,
      duration: 2200,
      useNativeDriver: false,
    });
    warmup.start();

    const pulseLoop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 2600,
        useNativeDriver: true,
      }),
    );
    pulseLoop.start();

    (async () => {
      try {
        const job = await createJob(jobPayload);
        if (cancelled) return;

        Animated.timing(progress, {
          toValue: 1,
          duration: 420,
          useNativeDriver: false,
        }).start();

        const firstImage =
          job?.images?.[0]?.url || job?.images?.[0]?.originalUrl || null;
        const normalized = firstImage ? normalizeImageUri(firstImage) : null;
        setImageUri(normalized);
        setStep(STEP.RESULT);
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || 'Could not generate image.');
        setStep(STEP.ERROR);
      }
    })();

    return () => {
      cancelled = true;
      warmup.stop();
      pulseLoop.stop();
    };
  }, [visible, jobPayload, createJob, progress, pulse]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRACK_WIDTH],
  });

  const pulseScaleOuter = pulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.5, 1],
  });
  const pulseScaleInner = pulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.25, 1],
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.25, 0.9, 0.25],
  });

  const handleClose = () => {
    try {
      onClose?.();
    } catch {}
  };

  const handleSave = () => {
    console.log('[CreateImageGenerating] save image');
  };

  const handleShare = () => {
    console.log('[CreateImageGenerating] share image');
  };

  const handleUpscale = () => {
    console.log('[CreateImageGenerating] upscale image');
  };

  const styleLabel = payload?.styleName || 'your chosen style';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.root}>
        {step === STEP.APPLYING && (
          <View style={styles.applyingContainer}>
            <LinearGradient
              colors={['rgba(7,10,23,0.95)', 'rgba(12,31,55,0.75)', 'rgba(7,10,23,0.95)']}
              style={styles.applyingBackground}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            <View style={styles.pulseStack}>
              <Animated.View
                style={[
                  styles.pulseOuter,
                  {
                    transform: [{ scale: pulseScaleOuter }],
                    opacity: pulseOpacity,
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.pulseInner,
                  {
                    transform: [{ scale: pulseScaleInner }],
                    opacity: pulseOpacity,
                  },
                ]}
              />
              <LinearGradient colors={['#7C5CFF', '#3790FF']} style={styles.pulseCore}>
                <Text style={styles.pulseGlyph}>✺</Text>
              </LinearGradient>
            </View>

            <Text style={styles.applyTitle}>Applying {styleLabel.toLowerCase()}…</Text>
            <Text style={styles.applySubtitle}>
              We’re refining your prompt to match the mood you selected.
            </Text>

            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
            </View>

            <Pressable onPress={handleClose} style={styles.cancelBtn} hitSlop={8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {step === STEP.ERROR && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Generation failed</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <Pressable onPress={handleClose} style={styles.errorButton} hitSlop={8}>
              <Text style={styles.errorButtonText}>Close</Text>
            </Pressable>
          </View>
        )}

        {step === STEP.RESULT && (
          <View style={styles.resultContainer}>
            <LinearGradient
              colors={['rgba(8,13,24,0.96)', 'rgba(8,13,24,0.6)', 'rgba(8,13,24,0.96)']}
              style={styles.resultBackground}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            <Pressable
              onPress={handleClose}
              style={styles.closeButton}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.closeIcon}>×</Text>
            </Pressable>

            <View style={styles.resultCard}>
              <Image
                source={{ uri: imageUri || FALLBACK_IMAGE }}
                resizeMode="cover"
                style={styles.resultImage}
              />
            </View>

            <View style={styles.resultActions}>
              <Pressable
                style={[styles.resultButton, styles.resultButtonSecondary]}
                onPress={handleUpscale}
                hitSlop={8}
              >
                <Text style={styles.resultButtonText}>Upscale ×4</Text>
              </Pressable>
              <Pressable
                style={[styles.resultButton, styles.resultButtonSecondary]}
                onPress={handleSave}
                hitSlop={8}
              >
                <Text style={styles.resultButtonText}>Save</Text>
              </Pressable>
              <Pressable
                style={[styles.resultButton, styles.resultButtonPrimary]}
                onPress={handleShare}
                hitSlop={8}
              >
                <Text style={styles.resultButtonPrimaryText}>Share</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  applyingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  applyingBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  pulseStack: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  pulseOuter: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(124,92,255,0.25)',
  },
  pulseInner: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(55,144,255,0.18)',
  },
  pulseCore: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3C96FF',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  pulseGlyph: {
    color: '#FFFFFF',
    fontSize: 40,
  },
  applyTitle: {
    color: '#F5F7FF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  applySubtitle: {
    color: 'rgba(229,231,235,0.75)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 26,
  },
  progressTrack: {
    width: TRACK_WIDTH,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  cancelBtn: {
    marginTop: 28,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  cancelText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#101922',
    gap: 16,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  errorMessage: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  errorButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#283039',
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  resultContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 36,
    justifyContent: 'flex-end',
  },
  resultBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  closeButton: {
    position: 'absolute',
    top: 32,
    right: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  resultCard: {
    borderRadius: 28,
    overflow: 'hidden',
    aspectRatio: 3 / 4,
    backgroundColor: '#151C24',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    alignSelf: 'center',
    width: '82%',
  },
  resultImage: {
    flex: 1,
  },
  resultActions: {
    marginTop: 28,
    gap: 12,
  },
  resultButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultButtonSecondary: {
    backgroundColor: 'rgba(28,34,43,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  resultButtonPrimary: {
    backgroundColor: '#137FEC',
  },
  resultButtonText: {
    color: '#E5E7EB',
    fontWeight: '700',
    fontSize: 15,
  },
  resultButtonPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});

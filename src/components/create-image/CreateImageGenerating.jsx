import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Alert,
  Animated,
  Image,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import SvgIcon from '../SvgIcon';
import LinearGradient from 'react-native-linear-gradient';
import { useImagesStore } from '../../state/useImagesStore';
import { normalizeImageUri } from '../../lib/imageUtils';
import { toLocalPath } from '../../lib/imageDownloader';
import { useTranslation } from 'react-i18next';
import RateUsService from '../../services/RateUsService';

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

export default function CreateImageGenerating({
  visible,
  payload,
  onClose,
}) {
  const { t } = useTranslation();
  const createJob = useImagesStore(s => s.createJob);

  const [step, setStep] = useState(STEP.APPLYING);
  const [imageUri, setImageUri] = useState(null);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [jobMeta, setJobMeta] = useState(null);
  const progress = useRef(new Animated.Value(0)).current;
  const spinner = useRef(new Animated.Value(0)).current;

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
      setPhaseIndex(0);
      setJobMeta(null);
      progress.setValue(0);
      spinner.stopAnimation();
      spinner.setValue(0);
      return;
    }
    if (!jobPayload) return;

    setStep(STEP.APPLYING);
    setImageUri(null);
    setError(null);
    setErrorCode(null);
    setPhaseIndex(0);
    setJobMeta(null);
    progress.setValue(0);

    // Initial warmup animation to 50%
    const warmup = Animated.timing(progress, {
      toValue: 0.5,
      duration: 1500,
      useNativeDriver: false,
    });

    // Simulated progress animation that continues while waiting for API
    // This animates from 50% to 90% over a longer duration
    // It will be interrupted when the actual job completes
    const simulatedProgress = Animated.timing(progress, {
      toValue: 0.9,
      duration: 15000, // 15 seconds to go from 50% to 90%
      useNativeDriver: false,
    });

    // Chain animations: warmup then simulated progress
    const progressSequence = Animated.sequence([
      warmup,
      simulatedProgress,
    ]);
    progressSequence.start();

    const spinnerLoop = Animated.loop(
      Animated.timing(spinner, {
        toValue: 1,
        duration: 2400,
        useNativeDriver: true,
      }),
    );
    spinner.setValue(0);
    spinnerLoop.start();

    setPhaseIndex(1); // Applying style

    (async () => {
      try {
        setPhaseIndex(2); // Generating
        const job = await createJob(jobPayload);

        // Stop the progress sequence and animate to completion
        progressSequence.stop();
        Animated.timing(progress, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }).start();

        const firstImage =
          job?.images?.[0]?.url || job?.images?.[0]?.originalUrl || null;
        const normalized = firstImage ? normalizeImageUri(firstImage) : null;
        setImageUri(normalized);
        setJobMeta({
          jobId: job?.id || null,
          imageId: job?.images?.[0]?.id || null,
          imagesCount: Array.isArray(job?.images) ? job.images.length : 1,
          payload: jobPayload,
          // effective size returned by server (may differ from requested)
          effectiveSize: job?.size || jobPayload?.size || null,
        });
        setPhaseIndex(3); // Finishing
        setStep(STEP.RESULT);
        
        // Check for rate prompt after successful photo creation
        const checkResult = await RateUsService.canShowRatePrompt();
        if (checkResult.canShow) {
          setTimeout(() => {
            RateUsService.showRatePrompt();
          }, 2000);
        }
      } catch (err) {
        // Stop progress animation on error
        progressSequence.stop();
        setError(err?.message || t('createImageGenerating.errors.genericMessage'));
        setErrorCode(err?.code || null);
        setStep(STEP.ERROR);
      }
    })();

    return () => {
      progressSequence.stop();
      spinnerLoop.stop();
    };
  }, [visible, jobPayload, createJob, progress, spinner, retryCount, t]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRACK_WIDTH],
  });

  const spinnerRotate = spinner.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const spinnerScale = spinner.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.9, 1.05, 0.9],
  });

  const handleClose = () => {
    setJobMeta(null);
    try {
      onClose?.();
    } catch {}
  };

  const handleSave = async () => {
    if (!imageUri) return;
    try {
      const local = await toLocalPath(imageUri);
      // Provide only the URL so share targets don't also post a text path
      await Share.share({ url: local });
    } catch (err) {
      Alert.alert(
        t('createImageGenerating.alerts.saveFailedTitle'),
        t('createImageGenerating.alerts.tryAgain')
      );
    }
  };

  const handleShare = async () => {
    if (!imageUri) return;
    try {
      // Only include the URL/attachment to avoid duplicate text messages
      await Share.share({ url: imageUri });
    } catch (err) {
      Alert.alert(
        t('createImageGenerating.alerts.shareFailedTitle'),
        t('createImageGenerating.alerts.tryAgain')
      );
    }
  };

const deleteImage = useImagesStore(s => s.deleteImage);
const deleteJob = useImagesStore(s => s.deleteJob);
  const handleDelete = () => {
    if (jobMeta?.jobId) {
      const remaining = jobMeta?.imagesCount ?? Number.POSITIVE_INFINITY;
      try {
        if (remaining <= 1 && deleteJob) {
          deleteJob(jobMeta.jobId);
        } else if (jobMeta.imageId && deleteImage) {
          deleteImage(jobMeta.jobId, jobMeta.imageId);
        }
      } catch {}
  }
  handleClose();
};

const handleRetry = () => {
  if (!payload) return;
  setStep(STEP.APPLYING);
  setPhaseIndex(0);
  setError(null);
  setImageUri(null);
  setJobMeta(null);
  progress.setValue(0);
  spinner.setValue(0);
  setRetryCount(c => c + 1);
};

  // Only show style label if a style is actually selected
  const hasStyle = payload?.styleId || (payload?.styleName && typeof payload.styleName === 'string' && payload.styleName.length > 0);
  const styleLabel = hasStyle && payload?.styleName
    ? payload.styleName
    : null;
  
  const resolveStylePlaceholder = useCallback(
    (text) => {
      if (typeof text !== 'string') return text;
      // If no style, remove the style placeholder entirely
      if (!styleLabel) {
        // Remove patterns like "{{style}}" or "{style}" and clean up surrounding text
        return text
          .replace(/\{\{\s*style\s*\}\}/gi, '')
          .replace(/\{\s*style\s*\}/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
      }
      return text
        .replace(/\{\{\s*style\s*\}\}/gi, styleLabel)
        .replace(/\{\s*style\s*\}/gi, styleLabel);
    },
    [styleLabel],
  );
  
  const phases = useMemo(
    () => [
      { label: resolveStylePlaceholder(t('createImageGenerating.phases.blend', { style: styleLabel || '' })) },
      { label: t('createImageGenerating.phases.paint') },
      { label: t('createImageGenerating.phases.finish') },
    ],
    [resolveStylePlaceholder, styleLabel, t],
  );
  const sheetSubtitleText = resolveStylePlaceholder(
    t('createImageGenerating.sheetSubtitle', { style: styleLabel || '' })
  );

  const requestedSize = jobMeta?.effectiveSize || jobMeta?.payload?.size || payload?.size;
  const previewAspectRatio = useMemo(() => {
    if (typeof requestedSize === 'string') {
      const match = requestedSize.trim().match(/^(\d+)\s*x\s*(\d+)$/i);
      if (match) {
        const width = Number(match[1]);
        const height = Number(match[2]);
        if (width > 0 && height > 0) {
          return width / height;
        }
      }
    }
    return 3 / 4;
  }, [requestedSize]);

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
        <View style={styles.root}>
          {step === STEP.APPLYING && (
          <View style={styles.applyingContainer}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Animated.View
                  style={[
                    styles.spinnerTrack,
                    { transform: [{ rotate: spinnerRotate }, { scale: spinnerScale }] },
                  ]}
                />
                <View style={styles.spinnerCenter}>
                  <Text style={styles.spinnerGlyph}>✨</Text>
                </View>
              </View>
              <View style={styles.sheetBody}>
                <Text style={styles.sheetTitle}>{t('createImageGenerating.sheetTitle')}</Text>
                <Text style={styles.sheetSubtitle}>
                  {sheetSubtitleText}
                </Text>
                <View style={styles.phaseList}>
                  {phases.map((phase, index) => {
                    const isActive = phaseIndex >= index + 1;
                    return (
                      <View key={phase.label} style={styles.phaseRow}>
                        <View
                          style={[
                            styles.phaseDot,
                            isActive && styles.phaseDotActive,
                            phaseIndex === index ? styles.phaseDotCurrent : null,
                          ]}
                        />
                        <Text
                          style={[
                            styles.phaseLabel,
                            isActive && styles.phaseLabelActive,
                            phaseIndex === index ? styles.phaseLabelCurrent : null,
                          ]}
                        >
                          {phase.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
              <View style={styles.sheetFooter}>
                <View style={styles.progressTrack}>
                  <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
                </View>
              </View>
            </View>
          </View>
        )}

        {step === STEP.ERROR && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>
              {errorCode === 'restricted_content'
                ? t('createImageGenerating.errors.restrictedTitle')
                : t('createImageGenerating.errors.genericTitle')}
            </Text>
            <Text style={styles.errorMessage}>{error}</Text>
            {errorCode === 'restricted_content' ? (
              <View style={styles.errorActions}>
                <Pressable onPress={handleClose} style={[styles.errorButton, styles.errorButtonPrimary]} hitSlop={8}>
                  <Text style={styles.errorButtonPrimaryText}>{t('createImageGenerating.actions.close')}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.errorActions}>
                <Pressable onPress={handleRetry} style={[styles.errorButton, styles.errorButtonPrimary]} hitSlop={8}>
                  <Text style={styles.errorButtonPrimaryText}>{t('createImageGenerating.actions.retry')}</Text>
                </Pressable>
                <Pressable onPress={handleClose} style={styles.errorButton} hitSlop={8}>
                  <Text style={styles.errorButtonText}>{t('createImageGenerating.actions.close')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {step === STEP.RESULT && (
          <View style={styles.resultContainer}>
            <LinearGradient
              colors={['rgba(10,13,20,0.95)', 'rgba(9,15,22,0.85)', 'rgba(7,10,18,0.95)']}
              style={styles.resultBackground}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            <View style={styles.resultContent}>
              <Pressable
                onPress={handleClose}
                style={styles.closeBadge}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('createImageGenerating.accessibility.close')}
              >
                <Text style={styles.closeIcon}>×</Text>
              </Pressable>
              <View style={[styles.previewWrap, { aspectRatio: previewAspectRatio }]}>
                <View style={styles.previewBorder} />
                <Image
                  source={{ uri: imageUri || FALLBACK_IMAGE }}
                  resizeMode="contain"
                  style={styles.resultImage}
                />
              </View>

              <View style={styles.resultMeta}>
                <Text style={styles.resultTitle}>{t('createImageGenerating.result.complete')}</Text>
                {payload?.originalPrompt ? (
                  <Text style={styles.resultPrompt} numberOfLines={2}>
                    “{payload.originalPrompt.trim()}”
                  </Text>
                ) : null}
                <View style={styles.resultTags}>
                  {hasStyle && styleLabel ? (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{styleLabel}</Text>
                    </View>
                  ) : null}
                  {payload?.size ? (
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>{payload.size}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.resultActionsRow}>
                <Pressable
                  style={[styles.iconButton, styles.iconButtonDestructive]}
                  onPress={handleDelete}
                  hitSlop={8}
                >
                  <SvgIcon name="delete" size={22} color="#FFD0D0" />
                </Pressable>
                <Pressable
                  style={styles.iconButton}
                  onPress={handleSave}
                  hitSlop={8}
                >
                  <SvgIcon name="download" size={22} color="#DDE4FF" />
                </Pressable>
                <Pressable
                  style={[styles.iconButton, styles.iconButtonPrimary]}
                  onPress={handleShare}
                  hitSlop={8}
                >
                  <SvgIcon name="share-upload" size={22} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          </View>
        )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(11,11,14,0.94)',
  },
  applyingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    width: '92%',
    maxWidth: 360,
    borderRadius: 28,
    backgroundColor: 'rgba(23,23,28,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.18)',
    paddingHorizontal: 24,
    paddingVertical: 26,
    gap: 24,
  },
  sheetHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  spinnerTrack: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.08)',
    borderTopColor: '#7C5CFF',
    borderRightColor: '#5F8DFF',
  },
  spinnerCenter: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,92,255,0.18)',
  },
  spinnerGlyph: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
  },
  sheetBody: {
    gap: 18,
  },
  sheetTitle: {
    color: '#F4F6FD',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  sheetSubtitle: {
    color: 'rgba(214,216,231,0.72)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  phaseList: {
    gap: 14,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  phaseDotActive: {
    backgroundColor: '#7C5CFF',
  },
  phaseDotCurrent: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#96A6FF',
  },
  phaseLabel: {
    color: 'rgba(214,220,232,0.6)',
    fontSize: 13,
    flex: 1,
  },
  phaseLabelActive: {
    color: '#F4F6FD',
  },
  phaseLabelCurrent: {
    color: '#D9DEFF',
    fontWeight: '600',
  },
  sheetFooter: {
    gap: 16,
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#7C5CFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: 'rgba(11,11,14,0.96)',
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
  errorActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  errorButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(40,48,57,0.85)',
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  errorButtonPrimary: {
    backgroundColor: '#7C5CFF',
    shadowColor: '#7C5CFF',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  errorButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  resultContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'center',
  },
  resultBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,11,14,0.96)',
  },
  resultContent: {
    gap: 24,
    alignItems: 'center',
    width: '94%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  closeBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  previewWrap: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    borderRadius: 32,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 20 },
  },
  previewBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  resultImage: {
    flex: 1,
  },
  resultMeta: {
    width: '92%',
    alignItems: 'center',
    gap: 12,
  },
  resultTitle: {
    color: '#F4F6FD',
    fontSize: 20,
    fontWeight: '700',
  },
  resultPrompt: {
    color: 'rgba(219,225,240,0.8)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  resultTags: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(124,92,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(124,92,255,0.32)',
  },
  tagText: {
    color: '#D6DEFF',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  resultActionsRow: {
    flexDirection: 'row',
    gap: 18,
    width: '68%',
    justifyContent: 'center',
  },
  iconButton: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: '#17171C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDestructive: {
    backgroundColor: 'rgba(110,32,38,0.85)',
    borderColor: 'rgba(255,120,120,0.4)',
  },
  iconButtonPrimary: {
    backgroundColor: '#7C5CFF',
    borderColor: 'rgba(124,92,255,0.75)',
    shadowColor: '#7C5CFF',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
  },
});

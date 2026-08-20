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
import { saveImageToGallery } from '../../lib/saveImageToGallery';
import { useTranslation } from 'react-i18next';
import RateUsService from '../../services/RateUsService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mapProxyError } from '../../lib/errors';
import ReportContentModal from '../reporting/ReportContentModal';

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
  const insets = useSafeAreaInsets();
  const createJob = useImagesStore(s => s.createJob);

  const [step, setStep] = useState(STEP.APPLYING);
  const [imageUri, setImageUri] = useState(null);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [jobMeta, setJobMeta] = useState(null);
  const [reportVisible, setReportVisible] = useState(false);
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
      setReportVisible(false);
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
    setReportVisible(false);
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
          originalUrl:
            job?.images?.[0]?.originalUrl ||
            (/^https?:\/\//i.test(firstImage || '') ? firstImage : null),
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
        const pretty = mapProxyError(err, t);
        setError(pretty?.message || t('createImageGenerating.errors.genericMessage'));
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
    setReportVisible(false);
    try {
      onClose?.();
    } catch {}
  };

  const handleSave = async () => {
    if (!imageUri) return;
    const result = await saveImageToGallery(imageUri);
    if (result.ok) {
      Alert.alert(
        t('createImageGenerating.alerts.savedTitle', { defaultValue: 'Saved' }),
        t('createImageGenerating.alerts.savedMessage', {
          defaultValue: 'Image saved to your gallery.',
        })
      );
      return;
    }
    if (result.reason === 'permission-denied') {
      Alert.alert(
        t('createImageGenerating.alerts.permissionTitle', {
          defaultValue: 'Permission needed',
        }),
        t('createImageGenerating.alerts.permissionMessage', {
          defaultValue: 'Allow storage access to save images to your gallery.',
        })
      );
      return;
    }
    Alert.alert(
      t('createImageGenerating.alerts.saveFailedTitle'),
      t('createImageGenerating.alerts.tryAgain')
    );
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

  const topPad = Math.max(18, (insets?.top || 0) + 12);
  const bottomPad = Math.max(14, (insets?.bottom || 0) + 10);
  const mode = jobMeta?.payload?.mode || jobPayload?.mode || 'text2img';
  const reportPayload = useMemo(
    () => ({
      content_type: mode === 'text2img' ? 'generated_image' : 'edited_image',
      content_id: jobMeta?.imageId || jobMeta?.jobId || undefined,
      prompt: payload?.originalPrompt || jobMeta?.payload?.prompt || undefined,
      image_url: jobMeta?.originalUrl || undefined,
      model: jobMeta?.payload?.model || payload?.model || undefined,
      source_screen: 'create_image_generating',
      metadata: {
        job_id: jobMeta?.jobId || null,
        mode,
      },
    }),
    [jobMeta, mode, payload?.model, payload?.originalPrompt],
  );

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
              colors={['#05050A', '#0B0B12', '#05050A']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            <View style={[styles.resultContent, { paddingTop: topPad, paddingBottom: bottomPad }]}>
              <View style={styles.resultTop}>
                <Pressable
                  onPress={handleClose}
                  style={styles.closeBadge}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('createImageGenerating.accessibility.close')}
                >
                  <SvgIcon name="close" size={22} color="rgba(255,255,255,0.92)" />
                </Pressable>
              </View>

              <View style={styles.resultMain}>
                <View style={styles.previewOuter}>
                  <View style={[styles.previewWrap, { aspectRatio: previewAspectRatio }]}>
                    <Image
                      source={{ uri: imageUri || FALLBACK_IMAGE }}
                      resizeMode="cover"
                      style={styles.resultImage}
                    />
                    <LinearGradient
                      colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0.0)']}
                      start={{ x: 0.5, y: 1 }}
                      end={{ x: 0.5, y: 0 }}
                      style={styles.imageOverlay}
                      pointerEvents="none"
                    />
                    <View style={styles.previewBorder} pointerEvents="none" />
                  </View>
                </View>

                <View style={styles.resultMeta}>
                  <Text style={styles.resultTitle}>{t('createImageGenerating.result.complete')}</Text>
                  {payload?.originalPrompt ? (
                    <Text style={styles.resultPrompt} numberOfLines={2}>
                      “{payload.originalPrompt.trim()}”
                    </Text>
                  ) : null}
                  {requestedSize ? (
                    <View style={styles.sizePill}>
                      <Text style={styles.sizePillText}>{requestedSize}</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.resultActionsRow}>
                      <View style={styles.actionItem}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.iconButton,
                        styles.iconButtonDestructive,
                        pressed && styles.iconButtonPressed,
                      ]}
                      onPress={handleDelete}
                      hitSlop={10}
                      accessibilityLabel={t('imageViewer.accessibility.delete')}
                    >
                      <SvgIcon name="delete" size={22} color="#FF7B7B" />
                    </Pressable>
                    <Text style={styles.actionLabel}>{t('imageViewer.actions.delete')}</Text>
                  </View>
                  <View style={styles.actionItem}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.iconButton,
                        pressed && styles.iconButtonPressed,
                      ]}
                      onPress={handleSave}
                      hitSlop={10}
                      accessibilityLabel={t('imageViewer.accessibility.save')}
                    >
                      <SvgIcon name="download" size={22} color="rgba(255,255,255,0.92)" />
                    </Pressable>
                    <Text style={styles.actionLabel}>{t('imageViewer.actions.save')}</Text>
                  </View>
                  <View style={styles.actionItem}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.iconButton,
                        styles.iconButtonPrimary,
                        pressed && styles.iconButtonPressed,
                      ]}
                      onPress={handleShare}
                      hitSlop={10}
                      accessibilityLabel={t('imageViewer.accessibility.share')}
                    >
                      <SvgIcon name="share-upload" size={22} color="#FFFFFF" />
                    </Pressable>
                        <Text style={styles.actionLabel}>{t('imageViewer.actions.share')}</Text>
                      </View>
                      <View style={styles.actionItem}>
                        <Pressable
                           style={({ pressed }) => [
                             styles.iconButton,
                             pressed && styles.iconButtonPressed,
                          ]}
                          onPress={() => setReportVisible(true)}
                          hitSlop={10}
                          accessibilityLabel={t('reportContent.accessibilityLabel')}
                        >
                          <SvgIcon name="flag" size={22} color="rgba(255,255,255,0.92)" />
                        </Pressable>
                        <Text style={styles.actionLabel}>
                          {t('reportContent.actions.report')}
                        </Text>
                      </View>
                    </View>
              </View>

              <View style={styles.bottomHandle} />
            </View>
          </View>
        )}
        </View>
          </Modal>
          <ReportContentModal
            visible={reportVisible && step === STEP.RESULT}
            report={reportPayload}
            onClose={() => setReportVisible(false)}
          />
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
  },
  resultBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,11,14,0.96)',
  },
  resultContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 22,
  },
  resultTop: {
    width: '100%',
    alignItems: 'center',
  },
  resultMain: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -10,
  },
  closeBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  previewOuter: {
    width: '100%',
    maxWidth: 560,
    position: 'relative',
    alignItems: 'center',
    marginBottom: 22,
  },
  previewWrap: {
    width: '100%',
    maxWidth: 560,
    maxHeight: 500,
    alignSelf: 'center',
    borderRadius: 32,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1A1A20',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 20 },
    elevation: 18,
  },
  previewBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  resultImage: {
    ...StyleSheet.absoluteFillObject,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  resultMeta: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  resultTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  resultPrompt: {
    color: 'rgba(225,228,240,0.72)',
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  sizePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginTop: 2,
  },
  sizePillText: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
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
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  actionItem: {
    alignItems: 'center',
    gap: 8,
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    fontWeight: '600',
  },
  iconButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  iconButtonDestructive: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  iconButtonPrimary: {
    backgroundColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  bottomHandle: {
    width: 120,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    opacity: 0.65,
  },
});

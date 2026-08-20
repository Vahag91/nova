import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  Image as RNImage,
  StyleSheet,
  Alert,
} from 'react-native';
import { Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useImagesStore } from '../../state/useImagesStore';
import { saveImageToGallery } from '../../lib/saveImageToGallery';
import SvgIcon from '../SvgIcon';
import { useTranslation } from 'react-i18next';
import ReportContentModal from '../reporting/ReportContentModal';

const ImageViewer = memo(({ 
  visible,
  imageUri,
  onClose,
  imageId,
  jobId,
  hideEdit = false,
}) => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [reportVisible, setReportVisible] = useState(false);

  const handleClose = useCallback(() => {
    setReportVisible(false);
    onClose?.();
  }, [onClose]);

  const jobs = useImagesStore(s => s.jobs);
  const job = useMemo(() => jobs.find(j => j.id === jobId), [jobs, jobId]);
  const selectedImage = useMemo(
    () => job?.images?.find(image => image?.id === imageId) || null,
    [imageId, job],
  );

  const promptText = useMemo(() => (job?.prompt ? String(job.prompt).trim() : ''), [job?.prompt]);
  const reportPayload = useMemo(
    () => ({
      content_type:
        !job?.mode || job?.mode === 'text2img' ? 'generated_image' : 'edited_image',
      content_id: imageId || jobId || undefined,
      prompt: promptText || undefined,
      image_url:
        selectedImage?.originalUrl ||
        (/^https?:\/\//i.test(imageUri || '') ? imageUri : undefined),
      model: job?.model || undefined,
      source_screen: 'image_viewer',
      metadata: {
        job_id: jobId || null,
        mode: job?.mode || 'text2img',
      },
    }),
    [imageId, imageUri, job?.mode, job?.model, jobId, promptText, selectedImage?.originalUrl],
  );
  const requestedSize = job?.size || null;
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
    return 1;
  }, [requestedSize]);

  const topPad = Math.max(18, (insets?.top || 0) + 12);
  const bottomPad = Math.max(14, (insets?.bottom || 0) + 10);

  // Robust delete: if provided id doesn't match, fall back by URL
  const handleDelete = useCallback(() => {
    try {
      const st = useImagesStore.getState?.();
      const del = st?.deleteImage;
      const delJob = st?.deleteJob;
      if (!del || !jobId) {
        handleClose();
        return;
      }
      let targetId = imageId;
      if (!targetId) {
        const targetJob = (st.jobs || []).find(j => j.id === jobId);
        const guess = targetJob?.images?.find(img => img?.url === imageUri || img?.originalUrl === imageUri);
        if (guess?.id) targetId = guess.id;
      }
      if (targetId) {
        try {
          const targetJob = (st.jobs || []).find(j => j.id === jobId);
          const remaining = Array.isArray(targetJob?.images) ? targetJob.images.length : Number.POSITIVE_INFINITY;
          if (remaining <= 1 && delJob) {
            delJob(jobId);
          } else {
            del(jobId, targetId);
          }
        } catch {}
      }
    } catch {}
    handleClose();
  }, [jobId, imageId, imageUri, handleClose]);

  const handleShare = useCallback(async () => {
    const url = imageUri;
    try {
      // Avoid duplicate text posts; only provide the URL/attachment
      await Share.share({ url });
    } catch (e) {}
  }, [imageUri]);

  const handleDownload = useCallback(async () => {
    const result = await saveImageToGallery(imageUri);
    if (result.ok) {
      Alert.alert(
        t('imageViewer.alerts.savedTitle', { defaultValue: 'Saved' }),
        t('imageViewer.alerts.savedMessage', {
          defaultValue: 'Image saved to your gallery.',
        }),
      );
      return;
    }
    if (result.reason === 'permission-denied') {
      Alert.alert(
        t('imageViewer.alerts.permissionTitle', { defaultValue: 'Permission needed' }),
        t('imageViewer.alerts.permissionMessage', {
          defaultValue: 'Allow storage access to save images to your gallery.',
        }),
      );
      return;
    }
    Alert.alert(
      t('imageViewer.alerts.saveFailedTitle', { defaultValue: 'Could not save' }),
      t('imageViewer.alerts.tryAgain', { defaultValue: 'Please try again.' }),
    );
  }, [imageUri, t]);

  if (!visible || !imageUri) return null;

  return (
    <>
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.root}>
        <LinearGradient
          colors={['#05050A', '#0B0B12', '#05050A']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        <View style={[styles.content, { paddingTop: topPad, paddingBottom: bottomPad }]}>
          <View style={styles.top}>
            <Pressable
              onPress={handleClose}
              style={styles.closeButton}
              hitSlop={12}
              accessibilityLabel={t('imageViewer.accessibility.close')}
            >
              <SvgIcon name="close" size={22} color="rgba(255,255,255,0.92)" />
            </Pressable>
          </View>

          <View style={styles.main}>
            <View style={[styles.previewWrap, { aspectRatio: previewAspectRatio }]}>
              <RNImage source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
              <LinearGradient
                colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0.0)']}
                start={{ x: 0.5, y: 1 }}
                end={{ x: 0.5, y: 0 }}
                style={styles.imageOverlay}
                pointerEvents="none"
              />
            </View>

            <View style={styles.meta}>
              <Text style={styles.title}>{t('createImageGenerating.result.complete')}</Text>
              {promptText ? (
                <Text style={styles.prompt} numberOfLines={2}>
                  “{promptText}”
                </Text>
              ) : null}
              {requestedSize ? (
                <View style={styles.sizePill}>
                  <Text style={styles.sizePillText}>{requestedSize}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.actionsRow}>
              <View style={styles.actionItem}>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && styles.actionButtonPressed,
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
                    styles.actionButton,
                    pressed && styles.actionButtonPressed,
                  ]}
                  onPress={handleDownload}
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
                    styles.actionButton,
                    styles.actionButtonPrimary,
                    pressed && styles.actionButtonPressed,
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
                    styles.actionButton,
                    pressed && styles.actionButtonPressed,
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
    </Modal>
    <ReportContentModal
      visible={reportVisible}
      report={reportPayload}
      onClose={() => setReportVisible(false)}
    />
    </>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#05050A',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
  },
  top: {
    width: '100%',
    alignItems: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -10,
  },
  previewWrap: {
    width: '100%',
    maxWidth: 360,
    maxHeight: 520,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#1A1A20',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
    marginBottom: 22,
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  meta: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  prompt: {
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
    marginTop: 2,
  },
  sizePillText: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'center',
    alignItems: 'center',
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
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  actionButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  bottomHandle: {
    width: 120,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    opacity: 0.65,
  },
});

export default ImageViewer;

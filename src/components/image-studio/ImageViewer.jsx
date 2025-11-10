import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  Image as RNImage,
  StyleSheet,
  LayoutAnimation,
} from 'react-native';
import { Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useImagesStore } from '../../state/useImagesStore';
import { toLocalPath } from '../../lib/imageDownloader';
import SvgIcon from '../SvgIcon';
import { useTranslation } from 'react-i18next';

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
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!imageUri) return;
    try {
      RNImage.getSize(
        imageUri,
        (w, h) => setImgSize({ w, h }),
        () => setImgSize({ w: 0, h: 0 })
      );
    } catch {
      setImgSize({ w: 0, h: 0 });
    }
  }, [imageUri]);

  const metrics = useMemo(() => {
    if (!containerSize.w || !containerSize.h || !imgSize.w || !imgSize.h) {
      return { dispW: containerSize.w, dispH: containerSize.h, vGap: 0, hGap: 0 };
    }
    const scale = Math.min(containerSize.w / imgSize.w, containerSize.h / imgSize.h);
    const dispW = imgSize.w * scale;
    const dispH = imgSize.h * scale;
    const vGap = Math.max(0, (containerSize.h - dispH) / 2);
    const hGap = Math.max(0, (containerSize.w - dispW) / 2);
    return { dispW, dispH, vGap, hGap };
  }, [containerSize, imgSize]);

  // Close button anchored relative to image top, with safe-area floor
  const closeTop = useMemo(() => {
    return Math.max(insets.top + 8, Math.round(metrics.vGap - 82));
  }, [metrics.vGap, insets.top]);

  // Reserve so tap overlays don't block controls
  const bottomReserve = useMemo(() => Math.max(insets.bottom + 14, 20) + 110, [insets.bottom]);
  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // Robust delete: if provided id doesn't match, fall back by URL
  const handleDelete = useCallback(() => {
    try {
      try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch {}
      const st = useImagesStore.getState?.();
      const del = st?.deleteImage;
      if (!del || !jobId) {
        handleClose();
        return;
      }
      let targetId = imageId;
      if (!targetId) {
        const job = (st.jobs || []).find(j => j.id === jobId);
        const guess = job?.images?.find(img => img?.url === imageUri || img?.originalUrl === imageUri);
        if (guess?.id) targetId = guess.id;
      }
      if (targetId) {
        try { del(jobId, targetId); } catch {}
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
    try {
      const local = await toLocalPath(imageUri);
      // Share only the local URL so targets receive a single attachment
      await Share.share({ url: local });
    } catch (e) {}
  }, [imageUri]);

  if (!visible || !imageUri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.viewerBackdrop} onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout || {};
        if (width && height) setContainerSize({ w: width, h: height });
      }}>
        {/* Background catch (behind content) */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.viewerCenter}
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
        >
          <RNImage 
            source={{ uri: imageUri }} 
            style={styles.viewerImage} 
            resizeMode="contain" 
          />
        </ScrollView>

        {/* Tap-to-close overlays in letterbox areas */}
        {metrics.vGap > 1 && (
          <View style={[styles.tapOverlay, { top: 0, left: 0, right: 0, height: metrics.vGap, zIndex: 2 }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          </View>
        )}
        {metrics.vGap > 1 && metrics.vGap - bottomReserve > 4 && (
          <View style={[styles.tapOverlay, { bottom: bottomReserve, left: 0, right: 0, height: metrics.vGap - bottomReserve, zIndex: 2 }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          </View>
        )}
        {metrics.hGap > 1 && (
          <>
            <View style={[styles.tapOverlay, { left: 0, width: metrics.hGap, top: 0, bottom: bottomReserve, zIndex: 2 }]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
            </View>
            <View style={[styles.tapOverlay, { right: 0, width: metrics.hGap, top: 0, bottom: bottomReserve, zIndex: 2 }]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
            </View>
          </>
        )}

        {/* Top center close */}
        <View style={[styles.headerCloseWrap, { top: closeTop }]}>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            style={styles.headerIconBtn}
            accessibilityLabel={t('imageViewer.accessibility.close')}
          >
            <SvgIcon name="close" size={30} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={[styles.bottomBar, { bottom: Math.max(insets.bottom + 14, 20) }]}>
          <View style={styles.bottomRow}>
            <View style={styles.bottomItem}>
              <Pressable onPress={handleDelete} style={[styles.bottomIconButton, styles.bottomIconButtonDestructive]} accessibilityLabel={t('imageViewer.accessibility.delete')}>
                <SvgIcon name="delete" size={22} color="#FFD0D0" />
              </Pressable>
              <Text style={styles.bottomLabel}>{t('imageViewer.actions.delete')}</Text>
            </View>
            {!hideEdit && (
              <View style={styles.bottomItem}>
                <Pressable onPress={() => {}} style={styles.bottomIconButton} accessibilityLabel={t('imageViewer.accessibility.edit')}>
                  <SvgIcon name="photo" size={22} color="#DDE4FF" />
                </Pressable>
                <Text style={styles.bottomLabel}>{t('imageViewer.actions.edit')}</Text>
              </View>
            )}
            <View style={styles.bottomItem}>
              <Pressable onPress={handleDownload} style={styles.bottomIconButton} accessibilityLabel={t('imageViewer.accessibility.save')}>
                <SvgIcon name="download" size={22} color="#DDE4FF" />
              </Pressable>
              <Text style={styles.bottomLabel}>{t('imageViewer.actions.save')}</Text>
            </View>
            <View style={styles.bottomItem}>
              <Pressable onPress={handleShare} style={[styles.bottomIconButton, styles.bottomIconButtonPrimary]} accessibilityLabel={t('imageViewer.accessibility.share')}>
                <SvgIcon name="share-upload" size={22} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.bottomLabel}>{t('imageViewer.actions.share')}</Text>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
});

const styles = {
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,11,14,0.95)',
  },
  viewerCenter: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.06 }],
  },
  headerCloseWrap: {
    position: 'absolute',
    top: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 3,
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 24, alignItems: 'center', zIndex: 4 },
  bottomRow: { flexDirection: 'row', gap: 18, alignItems: 'center', justifyContent: 'center' },
  bottomItem: { alignItems: 'center', gap: 6 },
  bottomIconButton: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: '#17171C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomIconButtonDestructive: {
    backgroundColor: 'rgba(103,27,36,0.85)',
    borderColor: 'rgba(255,120,120,0.4)',
  },
  bottomIconButtonPrimary: {
    backgroundColor: '#7C5CFF',
    borderColor: 'rgba(124,92,255,0.75)',
  },
  bottomLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  tapOverlay: { position: 'absolute' },
  // overlayTouch removed to avoid intercepting taps on controls
};

export default ImageViewer;

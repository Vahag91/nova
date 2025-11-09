import React, { memo, useCallback } from 'react';
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
import { useImagesStore } from '../../state/useImagesStore';
import { toLocalPath } from '../../lib/imageDownloader';
import SvgIcon from '../SvgIcon';

const ImageViewer = memo(({ 
  visible,
  imageUri,
  onClose,
  imageId,
  jobId,
  hideEdit = false,
}) => {
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
      await Share.share({ url, message: url });
    } catch (e) {}
  }, [imageUri]);

  const handleDownload = useCallback(async () => {
    try {
      const local = await toLocalPath(imageUri);
      await Share.share({ url: local, message: local });
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
      <View style={styles.viewerBackdrop}>
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

        {/* Remove foreground overlay to allow bottom actions to receive touches */}

        {/* Top center close */}
        <View style={styles.headerCloseWrap}>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            style={styles.headerIconBtn}
            accessibilityLabel="Close"
          >
            <SvgIcon name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={styles.bottomBar}>
          <View style={styles.bottomRow}>
            <View style={styles.bottomItem}>
              <Pressable onPress={handleDelete} style={[styles.bottomIconButton, styles.bottomIconButtonDestructive]} accessibilityLabel="Delete image">
                <SvgIcon name="delete" size={22} color="#FFD0D0" />
              </Pressable>
              <Text style={styles.bottomLabel}>Delete</Text>
            </View>
            {!hideEdit && (
              <View style={styles.bottomItem}>
                <Pressable onPress={() => {}} style={styles.bottomIconButton} accessibilityLabel="Edit">
                  <SvgIcon name="photo" size={22} color="#DDE4FF" />
                </Pressable>
                <Text style={styles.bottomLabel}>Edit</Text>
              </View>
            )}
            <View style={styles.bottomItem}>
              <Pressable onPress={handleDownload} style={styles.bottomIconButton} accessibilityLabel="Save">
                <SvgIcon name="download" size={22} color="#DDE4FF" />
              </Pressable>
              <Text style={styles.bottomLabel}>Save</Text>
            </View>
            <View style={styles.bottomItem}>
              <Pressable onPress={handleShare} style={[styles.bottomIconButton, styles.bottomIconButtonPrimary]} accessibilityLabel="Share">
                <SvgIcon name="share-upload" size={22} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.bottomLabel}>Share</Text>
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
    top: '12%',
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
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: '10%', alignItems: 'center', zIndex: 4 },
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
  // overlayTouch removed to avoid intercepting taps on controls
};

export default ImageViewer;

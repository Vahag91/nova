import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  Image as RNImage,
  StyleSheet,
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
}) => {
  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const deleteImage = useImagesStore?.(s => s.deleteImage);

  const handleDelete = useCallback(() => {
    try {
      if (deleteImage && jobId && imageId) {
        deleteImage(jobId, imageId);
      }
    } catch (e) {}
    handleClose();
  }, [deleteImage, jobId, imageId, handleClose]);

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

        {/* Foreground catch to close when tapping anywhere outside actions */}
        <Pressable style={styles.overlayTouch} onPress={handleClose} />

        {/* Top right icon cluster */}
        <View style={styles.headerIconsWrap}>
          <Pressable onPress={handleClose} hitSlop={12} style={styles.headerIconBtn} accessibilityLabel="Close">
            <SvgIcon name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={styles.bottomBar}>
          <View style={styles.bottomRow}>
            <Pressable onPress={handleDelete} style={styles.bottomItem} accessibilityLabel="Delete image">
              <SvgIcon name="delete" size={28} color="#FFFFFF" />
              <Text style={styles.bottomLabel}>Delete</Text>
            </Pressable>
            <Pressable onPress={() => {}} style={styles.bottomItem} accessibilityLabel="Edit">
              <SvgIcon name="photo" size={28} color="#FFFFFF" />
              <Text style={styles.bottomLabel}>Edit</Text>
            </Pressable>
            <Pressable onPress={handleDownload} style={styles.bottomItem} accessibilityLabel="Save">
              <SvgIcon name="download" size={28} color="#FFFFFF" />
              <Text style={styles.bottomLabel}>Save</Text>
            </Pressable>
            <Pressable onPress={handleShare} style={styles.bottomItem} accessibilityLabel="Share">
              <SvgIcon name="share-upload" size={28} color="#FFFFFF" />
              <Text style={styles.bottomLabel}>Share</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
});

const styles = {
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
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
  headerIconsWrap: { position: 'absolute', top: '18%', right: 12, flexDirection: 'row', gap: 12, zIndex: 3 },
  headerIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: '12%', paddingHorizontal: 12, backgroundColor: 'transparent' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  bottomItem: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  bottomLabel: { color: '#FFFFFF', fontSize: 12 },
  overlayTouch: { ...StyleSheet.absoluteFillObject, zIndex: 2 },
  actionRow: { flexDirection: 'row', gap: 24 },
  actionBtn: { paddingHorizontal: 0, paddingVertical: 0 },
  iconBtn: { paddingHorizontal: 6, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
};

export default ImageViewer;

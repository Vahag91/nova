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

const ImageViewer = memo(({
  visible,
  imageUri,
  onClose,
}) => {
  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  if (!visible || !imageUri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.viewerBackdrop}>
        <Pressable 
          style={StyleSheet.absoluteFill} 
          onPress={handleClose} 
        />
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

        {/* Close button */}
        <View style={styles.viewerTopBar}>
          <Pressable onPress={handleClose} hitSlop={10}>
            <Text style={styles.viewerClose}>✕</Text>
          </Pressable>
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
  },
  viewerTopBar: {
    position: 'absolute',
    top: 50,
    right: 20,
  },
  viewerClose: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    minWidth: 40,
    minHeight: 40,
    textAlign: 'center',
    lineHeight: 16,
  },
};

export default ImageViewer;

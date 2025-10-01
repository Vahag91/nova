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
    top: '18%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  viewerClose: {
    color: '#fff',
    fontSize: 25,
    fontWeight: '600',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 22,
    minWidth: 44,
    minHeight: 44,
    textAlign: 'center',
    lineHeight: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
};

export default ImageViewer;

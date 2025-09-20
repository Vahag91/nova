import React, { memo, useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  Alert,
  Platform,
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { uploadImage, prepareImageForUpload } from '../../lib/runwareUpload';

const ImageUpload = memo(({
  label,
  imageUri,
  onImageSelected,
  onRemoveImage,
  required = false,
  disabled = false,
}) => {
  const [loading, setLoading] = useState(false);

  const handleImagePicker = useCallback(() => {
    const options = {
      mediaType: 'photo',
      includeBase64: true,
      maxHeight: 2048,
      maxWidth: 2048,
      quality: 0.8,
    };

    Alert.alert(
      'Select Image',
      'Choose an option',
      [
        {
          text: 'Camera',
          onPress: () => launchCamera(options, handleImageResponse),
        },
        {
          text: 'Photo Library',
          onPress: () => launchImageLibrary(options, handleImageResponse),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  }, []);

  const handleImageResponse = useCallback(async (response) => {
    setLoading(false);
    
    if (response.didCancel || response.errorMessage) {
      return;
    }

    const asset = response.assets?.[0];
    if (asset) {
      setLoading(true);
      try {
        // Convert to base64 data URI
        const base64DataUri = `data:image/jpeg;base64,${asset.base64}`;
        
        // For now, skip upload and use base64 directly
        // TODO: Re-enable upload once Supabase function is deployed
        // const imageUUID = await uploadImage(base64DataUri);
        // onImageSelected?.(imageUUID);
        
        // Use base64 data URI directly
        onImageSelected?.(base64DataUri);
        
      } catch (error) {
        console.error('Image processing failed:', error);
        Alert.alert('Error', 'Failed to process image. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  }, [onImageSelected]);

  const handleRemove = useCallback(() => {
    Alert.alert(
      'Remove Image',
      'Are you sure you want to remove this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: onRemoveImage },
      ]
    );
  }, [onRemoveImage]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      
      {imageUri ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
          <Pressable
            onPress={handleRemove}
            style={styles.removeButton}
            disabled={disabled}
          >
            <Text style={styles.removeIcon}>✕</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={handleImagePicker}
          style={[styles.uploadButton, disabled && styles.uploadButtonDisabled]}
          disabled={disabled || loading}
        >
          <Text style={styles.uploadIcon}>📷</Text>
          <Text style={styles.uploadText}>
            {loading ? 'Processing...' : 'Tap to upload image'}
          </Text>
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    color: '#9CA3AF',
    fontWeight: '600',
    marginBottom: 8,
    fontSize: 14,
    fontFamily: 'Lato-Bold',
  },
  required: {
    color: '#EF4444',
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: '#374151',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E1E',
    minHeight: 120,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  uploadText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Lato-Regular',
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#374151',
  },
  previewImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
});

export default ImageUpload;

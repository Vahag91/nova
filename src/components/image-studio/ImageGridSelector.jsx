import React, { memo, useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';

const ImageGridSelector = memo(({
  label,
  selectedImageUri,
  onImageSelected,
  onRemoveImage,
  required = false,
  disabled = false,
  availableImages = [],
}) => {
  const [loading, setLoading] = useState(false);
  const screenWidth = Dimensions.get('window').width;
  const containerWidth = screenWidth - 40; // Account for padding
  const imageSize = (containerWidth - 24) / 3; // 3 columns with gaps

  const handleImagePress = useCallback((imageUri) => {
    if (selectedImageUri === imageUri) {
      // If already selected, deselect it
      onRemoveImage?.();
    } else {
      // Select this image
      onImageSelected?.(imageUri);
    }
  }, [selectedImageUri, onImageSelected, onRemoveImage]);

  const handleRemoveSelected = useCallback(() => {
    onRemoveImage?.();
  }, [onRemoveImage]);

  const handleCameraPress = useCallback(() => {
    const options = {
      mediaType: 'photo',
      includeBase64: true,
      maxHeight: 2048,
      maxWidth: 2048,
      quality: 0.8,
    };

    launchCamera(options, handleImageResponse);
  }, []);

  const handleLibraryPress = useCallback(() => {
    const options = {
      mediaType: 'photo',
      includeBase64: true,
      maxHeight: 2048,
      maxWidth: 2048,
      quality: 0.8,
    };

    launchImageLibrary(options, handleImageResponse);
  }, []);

  const handleImageResponse = useCallback(async (response) => {
    if (response.didCancel || response.errorMessage) {
      return;
    }

    const asset = response.assets?.[0];
    if (asset) {
      setLoading(true);
      try {
        // Convert to base64 data URI
        const base64DataUri = `data:image/jpeg;base64,${asset.base64}`;
        
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

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Upload buttons */}
        <Pressable
          style={[
            styles.uploadContainer,
            { width: imageSize, height: imageSize }
          ]}
          onPress={handleCameraPress}
          disabled={disabled || loading}
        >
          <Text style={styles.uploadIcon}>📷</Text>
          <Text style={styles.uploadText}>
            {loading ? 'Processing...' : 'Camera'}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.uploadContainer,
            { width: imageSize, height: imageSize }
          ]}
          onPress={handleLibraryPress}
          disabled={disabled || loading}
        >
          <Text style={styles.uploadIcon}>🖼️</Text>
          <Text style={styles.uploadText}>
            {loading ? 'Processing...' : 'Library'}
          </Text>
        </Pressable>

        {/* Available images */}
        {availableImages.map((image, index) => {
          const isSelected = selectedImageUri === image.url;
          
          return (
            <Pressable
              key={`${image.id || index}`}
              style={[
                styles.imageContainer,
                { width: imageSize, height: imageSize },
                isSelected && styles.selectedContainer
              ]}
              onPress={() => handleImagePress(image.url)}
              disabled={disabled}
            >
              <Image 
                source={{ uri: image.url }} 
                style={[styles.image, { width: imageSize, height: imageSize }]} 
              />
              
              {/* Selection indicator */}
              {isSelected && (
                <View style={styles.selectionIndicator}>
                  <Text style={styles.checkmark}>✓</Text>
                </View>
              )}
              
              {/* Remove button for selected image */}
              {isSelected && (
                <Pressable
                  style={styles.removeButton}
                  onPress={handleRemoveSelected}
                  disabled={disabled}
                >
                  <Text style={styles.removeIcon}>✕</Text>
                </Pressable>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

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
    marginBottom: 12,
    fontSize: 14,
    fontFamily: 'Lato-Bold',
  },
  required: {
    color: '#EF4444',
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingRight: 20,
  },
  uploadContainer: {
    marginRight: 8,
    borderRadius: 12,
    backgroundColor: '#1E1E1E',
    borderWidth: 2,
    borderColor: '#374151',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  uploadIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  uploadText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Lato-Bold',
    textAlign: 'center',
  },
  imageContainer: {
    marginRight: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  selectedContainer: {
    borderColor: '#8A42FF',
    backgroundColor: 'rgba(139, 66, 255, 0.1)',
  },
  image: {
    resizeMode: 'cover',
  },
  selectionIndicator: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8A42FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  removeButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeIcon: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default ImageGridSelector;

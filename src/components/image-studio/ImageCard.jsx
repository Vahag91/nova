import React, { memo, useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import { cacheToFile } from '../../lib/imageUtils';

const ImageCard = memo(({ 
  item, 
  style, 
  onPress,
  onLongPress,
  onDelete,
  isGenerating = false,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelection,
}) => {
  const [uri, setUri] = useState(item.url);
  
  const handlePress = useCallback(() => {
    onPress?.(item);
  }, [item, onPress]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(item);
  }, [item, onLongPress]);

  const handleImageLoad = useCallback(() => {
    // Image loaded successfully
  }, []);

  const handleImageError = useCallback(async (error) => {
    // Try to re-cache the image if it's a local file that failed
    if (uri?.startsWith('file://')) {
      try {
        // Try to re-download from original URL if available
        const originalUrl = item.originalUrl || item.url;
        if (originalUrl && /^https?:\/\//i.test(originalUrl)) {
          const newUri = await cacheToFile(originalUrl);
          if (newUri && newUri !== originalUrl) {
            setUri(newUri);
            return;
          }
        }
      } catch (reCacheError) {
        // Silent re-cache failure
      }
    }
    
    // One retry with a cache buster only for http URLs
    if (/^https?:\/\//i.test(uri) && !/[?&]t=/.test(uri)) {
      const retryUri = uri + (uri.includes('?') ? '&' : '?') + 't=' + Date.now();
      setUri(retryUri);
    }
  }, [uri, item.id, item.originalUrl, item.url]);

  return (
    <Pressable
      style={[
        styles.card, 
        style,
        isSelectionMode && styles.cardSelectionMode,
        isSelected && styles.cardSelected
      ]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      android_ripple={{ color: '#374151' }}
      accessibilityLabel="Generated image"
      accessibilityHint={isSelectionMode ? "Tap to select/deselect" : "Double tap to view full screen, long press for options"}
    >
      {/* Selection checkbox */}
      {isSelectionMode && (
        <View style={[
          styles.selectionCheckbox,
          isSelected && styles.selectionCheckboxSelected
        ]}>
          {isSelected && (
            <Text style={styles.selectionCheckmark}>✓</Text>
          )}
        </View>
      )}
      
      <Image
        source={{ uri }}
        style={[
          styles.image,
          isSelectionMode && styles.imageSelectionMode,
          isSelected && styles.imageSelected
        ]}
        resizeMode="cover"
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
      
      {/* Generation status indicator */}
      {isGenerating && (
        <View style={styles.generatingOverlay}>
          <ActivityIndicator color="#00E0C7" size="small" />
          <Text style={styles.generatingText}>Generating...</Text>
        </View>
      )}
    </Pressable>
  );
});

const styles = {
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    position: 'relative',
    aspectRatio: 1, // Force square aspect ratio
  },
  image: {
    width: '100%',
    height: '100%',
  },
  generatingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  generatingText: {
    color: '#00E0C7',
    fontSize: 12,
    fontWeight: '600',
  },
  // Selection mode styles
  cardSelectionMode: {
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: '#8A42FF',
    backgroundColor: 'rgba(139, 66, 255, 0.1)',
  },
  selectionCheckbox: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderWidth: 2,
    borderColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  selectionCheckboxSelected: {
    backgroundColor: '#8A42FF',
    borderColor: '#8A42FF',
  },
  selectionCheckmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  imageSelectionMode: {
    opacity: 1,
  },
  imageSelected: {
    opacity: 0.8,
  },
};

export default ImageCard;

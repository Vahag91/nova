import React, { memo, useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Image,
} from 'react-native';
import OptimizedImage from './OptimizedImage';

const ImageCard = memo(({ 
  item, 
  style, 
  onPress,
  onLongPress,
  onDelete,
  isGenerating = false,
}) => {
  const [uri, setUri] = useState(item.url);
  
  const handlePress = useCallback(() => {
    onPress?.(item);
  }, [item, onPress]);

  const handleLongPress = useCallback(() => {
    console.log('🎯 [CARD] Long press detected for item:', item.id);
    onLongPress?.(item);
  }, [item, onLongPress]);

  const handleImageLoad = useCallback(() => {
    console.log('✅ [CARD] Image loaded successfully:', {
      itemId: item.id,
      uri: uri.slice(0, 80),
      urlType: uri.startsWith('data:') ? 'data-uri' : uri.startsWith('file://') ? 'local-file' : 'remote-url'
    });
  }, [uri, item.id]);

  const handleImageError = useCallback(() => {
    console.warn('🖼️ [CARD] Image failed to load:', {
      uri: uri.slice(0, 80),
      fullUri: uri,
      itemId: item.id,
      itemUrl: item.url
    });
    // One retry with a cache buster only for http URLs
    if (/^https?:\/\//i.test(uri) && !/[?&]t=/.test(uri)) {
      const retryUri = uri + (uri.includes('?') ? '&' : '?') + 't=' + Date.now();
      console.log('🖼️ [CARD] Retrying with cache buster:', retryUri.slice(0, 80));
      setUri(retryUri);
    }
  }, [uri, item.id, item.url]);

  return (
    <Pressable
      style={[styles.card, style]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      android_ripple={{ color: '#374151' }}
      accessibilityLabel="Generated image"
      accessibilityHint="Double tap to view full screen, long press for options"
    >
      <Image
        source={{ uri }}
        style={styles.image}
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
};

export default ImageCard;

import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import OptimizedImage from './OptimizedImage';

const ImageCard = memo(({ 
  item, 
  style, 
  onPress,
  onLongPress,
  isGenerating = false,
}) => {
  const handlePress = useCallback(() => {
    onPress?.(item);
  }, [item, onPress]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(item);
  }, [item, onLongPress]);

  return (
    <Pressable
      style={[styles.card, style]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      android_ripple={{ color: '#374151' }}
      accessibilityLabel="Generated image"
      accessibilityHint="Double tap to view full screen, long press for options"
    >
      <OptimizedImage
        source={{ uri: item.url }}
        style={styles.image}
        resizeMode="cover"
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

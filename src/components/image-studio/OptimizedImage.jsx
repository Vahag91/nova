import React, { useState, useRef, useCallback, memo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Image as RNImage,
  Animated,
} from 'react-native';

// Image Cache
const imageCache = new Map();
const CACHE_SIZE_LIMIT = 50;

const addToCache = (url, imageData) => {
  if (imageCache.size >= CACHE_SIZE_LIMIT) {
    const firstKey = imageCache.keys().next().value;
    imageCache.delete(firstKey);
  }
  imageCache.set(url, imageData);
};

const getFromCache = (url) => imageCache.get(url);

// Error Boundary Component
class ImageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Image Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorFallback}>
          <Text style={styles.errorFallbackText}>⚠️</Text>
          <Text style={styles.errorFallbackTitle}>Image Error</Text>
          <Text style={styles.errorFallbackSubtitle}>Failed to load image</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const OptimizedImage = memo(({ 
  source, 
  style, 
  onLoad, 
  onError, 
  resizeMode = 'cover',
  ...props 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  

  const handleLoad = useCallback(() => {
    setLoading(false);
    setError(false);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    onLoad?.();
  }, [fadeAnim, onLoad]);

  const handleError = useCallback((err) => {
    setLoading(false);
    setError(true);
    onError?.(err);
  }, [onError]);

  // Check cache first
  const cachedImage = getFromCache(source.uri);
  if (cachedImage) {
    return (
      <Animated.View style={[style, { opacity: fadeAnim }]}>
        <RNImage source={cachedImage} style={style} resizeMode={resizeMode} {...props} />
      </Animated.View>
    );
  }

  return (
    <ImageErrorBoundary>
      <View style={style}>
        {loading && (
          <View style={styles.imageLoadingOverlay}>
            <ActivityIndicator color="#00E0C7" size="small" />
          </View>
        )}
        {error && (
          <View style={styles.imageErrorOverlay}>
            <Text style={styles.imageErrorIcon}>⚠️</Text>
            <Text style={styles.imageErrorText}>Failed to load</Text>
          </View>
        )}
        <Animated.View style={{ opacity: fadeAnim }}>
          <RNImage
            source={source}
            style={style}
            onLoad={handleLoad}
            onError={handleError}
            onLoadEnd={() => {
              addToCache(source.uri, source);
            }}
            resizeMode={resizeMode}
            {...props}
          />
        </Animated.View>
      </View>
    </ImageErrorBoundary>
  );
});

const styles = {
  errorFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  errorFallbackText: {
    fontSize: 32,
  },
  errorFallbackTitle: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  errorFallbackSubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    fontFamily: 'Lato-Regular',
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageErrorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1E1E1E',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  imageErrorIcon: {
    fontSize: 24,
  },
  imageErrorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '500',
  },
};

export default OptimizedImage;

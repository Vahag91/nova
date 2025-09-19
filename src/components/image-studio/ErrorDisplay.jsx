import React, { memo } from 'react';
import {
  View,
  Text,
  Pressable,
} from 'react-native';

const ErrorDisplay = memo(({
  error,
  retryCount = 0,
  maxRetries = 3,
  onRetry,
}) => {
  if (!error) return null;

  const canRetry = retryCount < maxRetries;

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>{error}</Text>
      {canRetry && onRetry && (
        <Pressable onPress={onRetry} style={styles.retryButton}>
          <Text style={styles.retryText}>
            Retry ({maxRetries - retryCount} left)
          </Text>
        </Pressable>
      )}
    </View>
  );
});

const styles = {
  errorContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EF444410',
    borderWidth: 1,
    borderColor: '#EF4444',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#EF4444',
    borderRadius: 4,
  },
  retryText: {
    color: '#F9FAFB',
    fontSize: 12,
    fontWeight: '600',
  },
};

export default ErrorDisplay;

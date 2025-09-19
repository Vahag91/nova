import React, { memo } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Animated,
} from 'react-native';

const GenerateButton = memo(({
  onPress,
  disabled = false,
  busy = false,
  modelName = 'gpt-image-1',
  animatedValue,
}) => {
  return (
    <View style={styles.ctaContainer}>
      <Animated.View style={{ transform: [{ scale: animatedValue || 1 }] }}>
        <Pressable
          onPress={onPress}
          disabled={disabled}
          style={styles.cta}
          accessibilityLabel={busy ? "Generating image" : "Generate image"}
          accessibilityHint="Tap to generate an image based on your description"
        >
          {busy ? (
            <View style={styles.ctaLoading}>
              <ActivityIndicator color="#000000" size="small" />
              <Text style={styles.ctaLoadingText}>Generating...</Text>
            </View>
          ) : (
            <>
              <Text style={styles.ctaText}>{modelName}</Text>
              <Text style={styles.ctaArrow}>↑</Text>
            </>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
});

const styles = {
  ctaContainer: {
    marginTop: 16,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00E0C7',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#00E0C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  ctaLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctaLoadingText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 16,
    fontFamily: 'Lato-Bold',
  },
  ctaText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 18,
    fontFamily: 'Lato-Bold',
  },
  ctaArrow: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 22,
  },
};

export default GenerateButton;

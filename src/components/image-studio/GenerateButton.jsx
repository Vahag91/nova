import React, { memo } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Animated,
} from 'react-native';
import SvgIcon from '../SvgIcon';

const GenerateButton = memo(({
  onPress,
  disabled = false,
  busy = false,
  modelName = 'gpt-image-1',
  actualModelName = null, // The model that will actually be used
  modelChanged = false, // Whether the model was auto-selected
  animatedValue,
  onAdvancedParams,
  style, // Allow custom styling
}) => {
  return (
    <View style={[styles.ctaContainer, style]}>
      <Animated.View style={{ transform: [{ scale: animatedValue || 1 }] }}>
        <Pressable
          onPress={() => {
            onPress?.();
          }}
          disabled={disabled}
          style={styles.cta}
          accessibilityLabel={busy ? "Generating image" : "Generate image"}
          accessibilityHint="Tap to generate an image based on your description"
        >
          {busy ? (
            <View style={styles.ctaLoading}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.ctaLoadingText}>Generating...</Text>
            </View>
          ) : (
            <View style={styles.ctaContent}>
              <Text style={styles.ctaText}>Generate</Text>
              <SvgIcon name="stars" size={20} color="#FFFFFF" />
            </View>
          )}
        </Pressable>
      </Animated.View>
      
      {/* Advanced Parameters Button */}
      {/* {onAdvancedParams && !busy && (
        <Pressable
          onPress={onAdvancedParams}
          style={styles.advancedButton}
          accessibilityLabel="Advanced parameters"
          accessibilityHint="Tap to configure advanced generation parameters"
        >
          <Text style={styles.advancedIcon}>⚙️</Text>
          <Text style={styles.advancedText}>Advanced</Text>
        </Pressable>
      )} */}
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
    backgroundColor: '#8A42FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#8A42FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  ctaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctaLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctaLoadingText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    fontFamily: 'Lato-Bold',
  },
  ctaText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 18,
    fontFamily: 'Lato-Bold',
  },
  advancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#374151',
    gap: 6,
  },
  advancedIcon: {
    fontSize: 16,
  },
  advancedText: {
    color: '#9CA3AF',
    fontWeight: '600',
    fontSize: 14,
    fontFamily: 'Lato-Bold',
  },
};

export default GenerateButton;

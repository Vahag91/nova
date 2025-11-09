import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Animated,
} from 'react-native';
import SvgIcon from '../SvgIcon';
import { useTranslation } from 'react-i18next';

const GenerateButton = memo(({
  onPress,
  disabled = false,
  busy = false,
  modelName = 'gpt-image-1',
  actualModelName = null, // The model that will actually be used
  modelChanged = false, // Whether the model was auto-selected
  animatedValue,
  onAdvancedParams,
  coinCost = null,
  style, // Allow custom styling
}) => {
  const { t } = useTranslation();
  const safePress = useCallback(() => {
    try { onPress?.(); } catch {}
  }, [onPress]);
  return (
    <View style={[styles.ctaContainer, style]}>
      <Animated.View style={{ transform: [{ scale: animatedValue || 1 }] }}>
        <Pressable
          onPress={safePress}
          disabled={disabled}
          style={styles.cta}
          accessibilityLabel={busy ? t('imagesStudio.generating') : t('imagesStudio.generate')}
          accessibilityHint={t('imagesStudio.generateImageHint')}
        >
          <View style={styles.ctaRow}>
            <View style={styles.ctaIconWrap}>
              {busy ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <SvgIcon name="stars" size={20} color="#FFFFFF" />
              )}
            </View>
            <Text style={[styles.ctaText, busy && styles.ctaTextBusy]}>
              {busy ? t('imagesStudio.generating') : t('imagesStudio.generate')}
            </Text>
            {coinCost !== null && coinCost !== undefined && (
              <View style={styles.coinWrap}>
                <SvgIcon
                  name="diamond"
                  size={12}
                  color={busy ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.85)'}
                />
                <Text style={[styles.coinText, busy && styles.coinTextBusy]}>
                  {busy ? '…' : coinCost}
                </Text>
              </View>
            )}
          </View>
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
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    columnGap: 12,
  },
  ctaIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 18,
    fontFamily: 'Lato-Bold',
    flex: 1,
    textAlign: 'center',
  },
  ctaTextBusy: { color: 'rgba(255,255,255,0.85)' },
  coinWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(15,15,19,0.25)',
  },
  coinText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Lato-Bold',
  },
  coinTextBusy: { color: 'rgba(255,255,255,0.6)' },
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

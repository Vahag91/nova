import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  useWindowDimensions,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';

const COLORS = {
  primary: '#009EDC',
  text: '#E0E1E6',
  muted: '#7A808F',
};

const CareView = ({ animationController, isAnimating, onImageReady }) => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  const slideX = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8],
    outputRange: [width, width, 0, -width, -width],
  });

  const CARD_W = useMemo(() => {
    const gap = 12;
    const max = 260;
    return Math.min(max, (width - 32 - gap) / 2);
  }, [width]);

  const CARD_H = 260;

  return (
    <Animated.View
      renderToHardwareTextureAndroid={isAnimating}
      style={[styles.root, { transform: [{ translateX: slideX }] }]}>
      <View style={styles.content}>
        <View style={styles.cardsRow}>
          <Animated.View
            style={[
              styles.card,
              { width: CARD_W, height: CARD_H, transform: [{ rotate: '-6deg' }] },
            ]}
          >
            <Image
              onLoad={() => onImageReady?.('care:before')}
              onError={() => onImageReady?.('care:before')}
              source={require('../../../assets/images/onboarding/before.jpg')}
              style={styles.fullImage}
              resizeMode="cover"
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.card,
              { width: CARD_W, height: CARD_H, transform: [{ rotate: '6deg' }] },
            ]}
          >
            <Image
              onLoad={() => onImageReady?.('care:after')}
              onError={() => onImageReady?.('care:after')}
              source={require('../../../assets/images/onboarding/after.jpg')}
              style={styles.fullImage}
              resizeMode="cover"
            />
          </Animated.View>
        </View>

        <View style={styles.heroBlock}>
          <View style={styles.heroTitleContainer}>
            <Text style={styles.heroTitle}>{t('onboarding.careView.titlePrefix')}</Text>
            <Text style={[styles.heroTitle, { color: '#00F0FF' }]}>{t('onboarding.careView.titleHighlight')}</Text>
          </View>
          <Text style={styles.heroSub}>{t('onboarding.careView.subtitle')}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 86,
    paddingHorizontal: 14,
    backgroundColor: 'transparent',
  },
  content: { width: '100%', alignItems: 'center' },
  cardsRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    backgroundColor: '#0B0D12',
  },
  fullImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroBlock: { width: '100%', alignItems: 'center', marginTop: 30 },
  heroTitleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    color: COLORS.text,
    textAlign: 'center',
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 56,
  },
  heroSub: {
    color: COLORS.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
});

export default CareView;

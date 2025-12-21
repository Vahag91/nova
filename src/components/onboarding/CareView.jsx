import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  useWindowDimensions,
  Platform,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';

const COLORS = {
  primary: '#009EDC',
  text: '#E0E1E6',
  muted: '#7A808F',
};

const CareView = ({ animationController }) => {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  const slideX = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8],
    outputRange: [width, width, 0, -width, -width],
  });

  const fadeIn = animationController.current.interpolate({
    inputRange: [0.2, 0.35, 0.4],
    outputRange: [0, 0.6, 1],
    extrapolate: 'clamp',
  });

  const leftCardTX = animationController.current.interpolate({
    inputRange: [0.2, 0.4, 0.6],
    outputRange: [40, 0, -30],
    extrapolate: 'clamp',
  });
  const rightCardTX = animationController.current.interpolate({
    inputRange: [0.2, 0.4, 0.6],
    outputRange: [60, 0, -40],
    extrapolate: 'clamp',
  });

  const titleTY = animationController.current.interpolate({
    inputRange: [0.2, 0.4],
    outputRange: [12, 0],
    extrapolate: 'clamp',
  });

  const CARD_W = useMemo(() => {
    const gap = 12;
    const max = 260;
    return Math.min(max, (width - 32 - gap) / 2);
  }, [width]);

  const CARD_H = 260; // Increased height to fit prompt + image

  return (
    <Animated.View style={[styles.root, { transform: [{ translateX: slideX }] }]}>
      <Animated.View style={[styles.content, { opacity: fadeIn }]}>
        <View style={styles.cardsRow}>
          {/* CREATE */}
          <Animated.View
            style={[
              styles.card,
              { width: CARD_W, height: CARD_H, transform: [{ translateX: leftCardTX }, { rotate: '-6deg' }] },
            ]}
          >
            {/* full image */}
            <Image source={require('../../../assets/images/onboarding/before.jpg')} style={styles.fullImage} resizeMode="cover" />
          </Animated.View>

          {/* EDIT */}
          <Animated.View
            style={[
              styles.card,
              { width: CARD_W, height: CARD_H, transform: [{ translateX: rightCardTX }, { rotate: '6deg' }] },
            ]}
          >
            {/* full image */}
            <Image source={require('../../../assets/images/onboarding/after.jpg')} style={styles.fullImage} resizeMode="cover" />
          </Animated.View>
        </View>

        <Animated.View style={[styles.heroBlock, { transform: [{ translateY: titleTY }] }]}>
          <View style={styles.heroTitleContainer}>
            <Text style={styles.heroTitle}>
              {t('onboarding.careView.titlePrefix')}
            </Text>
            <Text style={[styles.heroTitle, { color: '#00F0FF' }]}>
              {t('onboarding.careView.titleHighlight')}
            </Text>
          </View>
          <Text style={styles.heroSub}>
            {t('onboarding.careView.subtitle')}
          </Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0, right: 0,
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

  // full-bleed card
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.22,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        backgroundColor: 'transparent',
      },
      android: { elevation: 6, backgroundColor: '#0B0D12' },
    }),
  },

   // full image
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

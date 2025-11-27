import React, { useMemo } from 'react';
import { StyleSheet, View, Text, Animated, useWindowDimensions, Image } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PRESETS } from '../../data/presets';

const RelaxView = ({ animationController }) => {
  const { t } = useTranslation();
  const window = useWindowDimensions();
  const assistantCards = useMemo(() => {
    const ids = ['fitness', 'recipes', 'travel'];
    return PRESETS.filter(p => ids.includes(p.id)).map((preset, index) => ({
      id: preset.id,
      title: t(`onboarding.relaxView.cards.${preset.id}.title`, { defaultValue: preset.name }),
      text: t(`onboarding.relaxView.cards.${preset.id}.text`, { defaultValue: preset.description }),
      image: preset.avatar,
      rotate: index === 0 ? '-2deg' : index === 1 ? '1deg' : '-1deg',
    }));
  }, [t]);

  const slideAnim = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.4, 0.8],
    outputRange: [0, 0, -window.width, -window.width],
  });

  const fadeIn = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.4],
    outputRange: [0, 1, 1],
  });

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateX: slideAnim }], opacity: fadeIn }]}
    >
      <View style={styles.cardsContainer}>
        {assistantCards.map((card) => (
          <Animated.View key={card.id} style={[styles.card, { transform: [{ rotate: card.rotate }] }]}>
            <View style={styles.cardContent}>
              <View style={styles.imageContainer}>
                <Image source={card.image} style={styles.humanImage} resizeMode="cover" />
              </View>
              <View style={styles.textContent}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardText}>{card.text}</Text>
              </View>
            </View>
          </Animated.View>
        ))}
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>
          {t('onboarding.relaxView.title')}{' '}
          <Text style={{ color: '#00F0FF' }}>{t('onboarding.relaxView.titleHighlight')}</Text>
        </Text>
        <Text style={styles.subtitle}>{t('onboarding.relaxView.subtitle')}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 106,
    paddingHorizontal: 14,
  },
  cardsContainer: {
    width: '100%',
    marginBottom: 35,
    gap: 12,
  },
  card: {
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderRadius: 12,
    padding: 16,
    height: 100,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: '100%',
  },
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
  },
  humanImage: {
    width: '100%',
    height: '100%',
  },
  textContent: {
    flex: 1,
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'WorkSans-SemiBold',
    marginBottom: 4,
  },
  cardText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontFamily: 'WorkSans-Regular',
    lineHeight: 16,
  },
  textContainer: {
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: 'WorkSans-Bold',
    lineHeight: 32,
    marginBottom: 6.6,
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    fontFamily: 'WorkSans-Regular',
    lineHeight: 21,
  },
});

export default RelaxView;

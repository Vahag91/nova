import React from 'react';
import { StyleSheet, View, Text, Animated, useWindowDimensions, Image } from 'react-native';

const RelaxView = ({ animationController }) => {
  const window = useWindowDimensions();

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
        {/* Card 1 - Fitness Coach */}
        <Animated.View style={[styles.card, { transform: [{ rotate: '-2deg' }] }]}>
          <View style={styles.cardContent}>
            <View style={styles.imageContainer}>
              <Image
                source={require('../../../assets/icons/human1.jpg')}
                style={styles.humanImage}
                resizeMode="cover"
              />
            </View>
            <View style={styles.textContent}>
              <Text style={styles.cardTitle}>Fitness Coach</Text>
              <Text style={styles.cardText}>Get personalized workout plans and nutrition advice tailored to your goals</Text>
            </View>
          </View>
        </Animated.View>

        {/* Card 2 - Doctor */}
        <Animated.View style={[styles.card, { transform: [{ rotate: '1deg' }] }]}>
          <View style={styles.cardContent}>
            <View style={styles.imageContainer}>
              <Image
                source={require('../../../assets/icons/human2.jpg')}
                style={styles.humanImage}
                resizeMode="cover"
              />
            </View>
            <View style={styles.textContent}>
              <Text style={styles.cardTitle}>Doctor</Text>
              <Text style={styles.cardText}>Get health insights, symptom analysis, and medical guidance when you need it</Text>
            </View>
          </View>
        </Animated.View>

        {/* Card 3 - Pet Care */}
        <Animated.View style={[styles.card, { transform: [{ rotate: '-1deg' }] }]}>
          <View style={styles.cardContent}>
            <View style={styles.imageContainer}>
              <Image
                source={require('../../../assets/icons/human3.jpg')}
                style={styles.humanImage}
                resizeMode="cover"
              />
            </View>
            <View style={styles.textContent}>
              <Text style={styles.cardTitle}>Pet Care</Text>
              <Text style={styles.cardText}>Expert advice on pet health, training, and care for your furry friends</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>Meet Your AI <Text style={{ color: '#00F0FF' }}>Assistants</Text></Text>
        <Text style={styles.subtitle}>Specialized AI experts ready to help with your daily needs</Text>
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
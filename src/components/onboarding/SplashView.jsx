import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  useWindowDimensions,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import MyPressable from './MyPressable';

const COLORS = {
  bg: '#0A0A10',
  surface: 'rgba(22,22,31,0.6)',
  surfaceSoft: 'rgba(22,22,31,0.4)',
  primary: '#5252E0',
  secondary: '#38B2AC',
  textPrimary: '#F0F0F5',
  textSecondary: '#B8B8CC',
  textMuted: '#9A9AB0',
  border: 'rgba(82,82,224,0.2)',
  borderSoft: 'rgba(82,82,224,0.15)',
  buttonBg: 'rgb(21,32,54)',
  gold: '#FFD700',
};

const SplashView = ({ onNextClick, animationController, isAnimating = false }) => {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const splashTranslateY = animationController.current.interpolate({
    inputRange: [0, 0.2, 0.8],
    outputRange: [0, -height, -height],
  });

  // responsive scales
  const isSmall = width < 360;
  const contentMax = Math.min(520, width - 40);

  return (
    <Animated.View style={{ flex: 1, transform: [{ translateY: splashTranslateY }] }}>
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(24, insets.top + 8) }]}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../../assets/icons/appiconsvg.png')}
            style={[styles.appIcon, { width: isSmall ? 84 : 96, height: isSmall ? 84 : 96 }]}
            resizeMode="contain"
          />
        </View>

        {/* Title + underline */}
        <View style={[styles.titleContainer, { maxWidth: contentMax }]}>
          <Text style={[styles.title, { fontSize: isSmall ? 30 : 34 }]} numberOfLines={1}>
            {t('onboarding.splash.title')}
          </Text>
          <View style={styles.titleUnderline} />
        </View>

        {/* Tagline */}
        <Text style={[styles.subtitle, { fontSize: isSmall ? 13 : 14 }]}>
          {t('onboarding.splash.tagline')}
        </Text>

        {/* Description */}
        <View style={[styles.card, { maxWidth: contentMax }]}>
          <Text style={[styles.description, { fontSize: isSmall ? 14 : 15, lineHeight: isSmall ? 22 : 24 }]}>
            {t('onboarding.splash.description')}
          </Text>
        </View>

        {/* Social proof */}
        <View style={[styles.statsCard, { maxWidth: contentMax }]}>
          
          {/* Top Row: Avatars + Text */}
          <View style={styles.userStatsRow}>
            <View style={styles.avatarsContainer}>
              <Image 
                source={require('../../../assets/icons/human1.jpg')}
                style={[styles.avatar, styles.avatar1]}
                resizeMode="cover"
              />
              <Image 
                source={require('../../../assets/icons/human2.jpg')}
                style={[styles.avatar, styles.avatar2, { marginLeft: -10 }]}
                resizeMode="cover"
              />
              <Image 
                source={require('../../../assets/icons/human3.jpg')}
                style={[styles.avatar, styles.avatar3, { marginLeft: -10 }]}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.statsText}>
              {t('onboarding.splash.stats')}
            </Text>
          </View>

          {/* Bottom Row: Stars + Rating Text */}
          <View style={styles.ratingContainer}>
            <View style={styles.starsContainer}>
              <Text style={styles.star}>★</Text>
              <Text style={styles.star}>★</Text>
              <Text style={styles.star}>★</Text>
              <Text style={styles.star}>★</Text>
              <Text style={[styles.star, { opacity: 0.6 }]}>★</Text>
            </View>
            <Text style={styles.ratingText}>
              {t('onboarding.splash.rating')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer button */}
      <View style={[styles.footer, { paddingBottom: Math.max(12, 8 + insets.bottom) }]}>
        <View style={styles.buttonShadowWrapper}>
          <View style={styles.buttonClip}>
            <MyPressable
              style={[
                styles.button,
                {
                  paddingHorizontal: isSmall ? 32 : 48,
                  height: isSmall ? 52 : 56,
                  opacity: isAnimating ? 0.6 : 1,
                },
              ]}
              android_ripple={{ color: 'rgba(82,82,224,0.18)' }}
              touchOpacity={0.6}
              onPress={isAnimating ? undefined : onNextClick}
              disabled={isAnimating}
            >
              <Text style={[styles.buttonText, { fontSize: isSmall ? 16 : 17 }]}>{t('onboarding.splash.button')}</Text>
            </MyPressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
    paddingBottom: 20, // Added safety padding
  },

  /* ---------- Header / Logo ----------- */
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 80,
  },
  appIcon: {
    borderRadius: 20,
  },

  /* ---------- Title ----------- */
  titleContainer: {
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
  },
  title: {
    color: COLORS.textPrimary,
    textAlign: 'center',
    fontFamily: 'WorkSans-Bold',
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  titleUnderline: {
    width: 56,
    height: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },

  /* ---------- Subtitle ----------- */
  subtitle: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontFamily: 'WorkSans-SemiBold',
    marginBottom: 16,
    letterSpacing: 1.1,
  },

  /* ---------- Description Card ----------- */
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
  },
  description: {
    color: '#C8C8D8',
    textAlign: 'center',
    fontFamily: 'WorkSans-Regular',
  },

  /* ---------- Stats Card (FIXED) ----------- */
  statsCard: {
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    width: '100%',
    alignItems: 'center', // Ensures content centers in card
  },
  
  // Row 1: Users
  userStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap', // Allows wrapping on very small screens
    gap: 10,          // Consistent spacing
    marginBottom: 10,
  },
  avatarsContainer: {
    flexDirection: 'row',
    // Removed margin right, using gap in parent instead
    flexShrink: 0,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: COLORS.bg,
  },
  avatar1: {},
  avatar2: {},
  avatar3: {},
  statsText: {
    color: '#D8D8E8',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
    textAlign: 'center', // Centers text if it wraps
    flexShrink: 1, // Prevents text from pushing bounds
  },

  // Row 2: Ratings (Fixed Overlap)
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap', // CRITICAL FIX: Wraps items if screen is narrow
    gap: 8,           // CRITICAL FIX: Adds space between stars and text
  },
  starsContainer: {
    flexDirection: 'row',
    // Removed marginRight, using gap in parent
  },
  star: {
    fontSize: 16,
    color: COLORS.gold,
    textShadowColor: 'rgba(255,215,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginHorizontal: 1,
  },
  ratingText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center', // Centers text if it wraps
    flexShrink: 1,       // Allows text to shrink rather than overflow
  },

  /* ---------- Footer Button ----------- */
  footer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 8,
  },
  buttonShadowWrapper: {
    alignSelf: 'center',
    borderRadius: 32,
    overflow: 'visible',
    ...Platform.select({
      ios: {
        shadowColor: '#15203A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: {
        elevation: 12,
        backgroundColor: COLORS.buttonBg,
      },
    }),
  },
  buttonClip: {
    borderRadius: 32,
    overflow: 'hidden',
  },
  button: {
    backgroundColor: COLORS.buttonBg,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 220,
  },
  buttonText: {
    fontSize: 17,
    fontFamily: 'WorkSans-SemiBold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});

export default SplashView;

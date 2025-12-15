import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import SvgIcon from '../SvgIcon';
import { colors } from '../../styles/colors';

export const PointsHero = ({ points = 0, onSeeRewardsPress }) => {
  const { t } = useTranslation();
  // Pulse animation for dot
  const dotPulse = useSharedValue(0.8);

  useEffect(() => {
    dotPulse.value = withRepeat(
      withTiming(1, { duration: 1500 }),
      -1,
      true
    );
  }, []);

  const dotPulseStyle = useAnimatedStyle(() => ({
    opacity: dotPulse.value,
  }));

    return (
      <View style={styles.container}>
        {/* ==== CENTER CONTENT ==== */}
      <View style={styles.centerContent}>
        <Text style={styles.label}>{t('rewards.pointsHero.totalBalance')}</Text>

        <View style={styles.balanceRow}>
          
          {/* ==== ICON WRAPPER ==== */}
          <View style={styles.iconWrapper}>
            {/* Gradient circle border */}
            <LinearGradient
              colors={['#FCD34D', '#D97706']}
              style={styles.iconBorder}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            >
              {/* Inner card */}
              <View style={styles.iconInner}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.20)', 'transparent']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <SvgIcon name="coin" size={24} color="#FCD34D" />
              </View>
            </LinearGradient>
          </View>

          {/* ==== BALANCE NUMBER ==== */}
          <Text style={styles.balanceText}>{points.toLocaleString()}</Text>

        </View>
      </View>

      {/* ==== BUTTON BELOW ==== */}
      <View style={styles.buttonWrapper}>
        <Pressable
          onPress={onSeeRewardsPress}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed
          ]}
        >
          <Animated.View style={[styles.buttonDot, dotPulseStyle]} />

          <Text style={styles.buttonText}>{t('rewards.pointsHero.seeYourRewards')}</Text>
        </Pressable>
      </View>

    </View>
  );
};

// ================================================================================
// STYLES — EXACT TAILWIND TRANSLATION
// ================================================================================

const styles = StyleSheet.create({
  container: {
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  /* ===== BACKGROUND GLOW (absolute circle, strong opacity, blur simulation) ===== */
  backgroundGlow: {
    position: 'absolute',
    width: 192,      // w-48
    height: 192,     // h-48
    backgroundColor: 'rgba(251,191,36,0.10)', // bg-accent/10
    opacity: 0.6,
    borderRadius: 96,
    top: '50%',
    left: '50%',
    marginLeft: -96,
    marginTop: -96,
    transform: [{ scale: 2.0 }],  // simulates "blur-[60px]"
  },

  /* ===== Center Content ===== */
  centerContent: {
    zIndex: 10,
    alignItems: 'center',
    gap: 20,
    marginTop: 26,
  },

  label: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Lato-Bold',
    color: '#6B7280', // gray-500
    letterSpacing: 3.2, // tracking-[0.2em]
    textTransform: 'uppercase',
  },

  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  /* ===== Icon Wrapper ===== */
  iconWrapper: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },

  /* Gradient border container */
  iconBorder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 1,
  },

  /* Inner circle */
  iconInner: {
    flex: 1,
    borderRadius: 23,
    backgroundColor: colors.surface, // bg-card
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },

  /* ===== Balance Number ===== */
  balanceText: {
    fontSize: 56,
    fontWeight: '800',
    fontFamily: 'Lato-Bold',
    letterSpacing: -0.5,
    color: '#FFFFFF',
    lineHeight: 56,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    fontVariant: ['tabular-nums'],
  },

  /* ===== Button Styles ===== */
  buttonWrapper: {
    marginTop: 22,
  },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surfaceElevated, // bg-subtle
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  buttonPressed: {
    transform: [{ scale: 0.95 }],
    backgroundColor: 'rgba(255,255,255,0.10)',
  },

  buttonDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FBBF24',
    shadowColor: 'rgba(251,191,36,0.8)',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },

  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
    color: 'rgba(203,213,225,1)', // gray-300
  },
});

export default PointsHero;
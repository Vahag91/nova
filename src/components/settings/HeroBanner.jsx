import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTranslation } from 'react-i18next';
import SvgIcon from '../SvgIcon';
import { colors } from '../../styles/colors';

export default function HeroBanner({ onPress }) {
  const { t } = useTranslation();

  return (
    <Pressable style={styles.heroCard} onPress={onPress}>
      {/* BACKGROUND (new approach: clean “neon frame” + deep matte center) */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(99,102,241,0.55)', 'rgba(168,85,247,0.40)', 'rgba(34,211,238,0.28)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View pointerEvents="none" style={styles.frameInset} />

      {/* soft diagonal highlight strip */}
      <View pointerEvents="none" style={styles.diagonalStrip} />

      {/* tiny “grain” pattern using dots (no images) */}
      <View pointerEvents="none" style={styles.dotsWrap}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>

      {/* CONTENT (unchanged text) */}
      <View style={styles.heroCopy}>
        <Text style={styles.heroLabel}>{t('settings.hero.label')}</Text>
        <Text style={styles.heroTitle}>{t('settings.hero.title')}</Text>
        <Pressable
          style={styles.heroButton}
          onPress={(event) => {
            event?.stopPropagation?.();
            onPress?.();
          }}
        >
          <Text style={styles.heroButtonText}>{t('settings.hero.upgrade')}</Text>
        </Pressable>
      </View>

      <View style={styles.heroIconTile}>
        <SvgIcon name="stars" size={26} color="#E5E7EB" />
      </View>
    </Pressable>
  );
}

const RADIUS = 24;

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: RADIUS,
    paddingHorizontal: 20,
    paddingVertical: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 118,
    backgroundColor: '#070A12', // deep matte base
  },
  // Inset panel (creates the frame look without gradients inside)
  frameInset: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderRadius: RADIUS - 1,
    backgroundColor: '#0B1020', // clean, dark, premium
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  // Diagonal highlight strip (simple, modern)
  diagonalStrip: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -150,
    left: -120,
    transform: [{ rotate: '-18deg' }],
  },

  // Minimal dotted texture (no new text, no images)
  dotsWrap: {
    position: 'absolute',
    right: 14,
    top: 14,
    width: 92,
    height: 56,
    flexDirection: 'row',
    flexWrap: 'wrap',
    opacity: 0.35,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    margin: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  // --- EXISTING CONTENT STYLES (kept) ---
  heroCopy: {
    flex: 1,
    gap: 10,
  },
  heroLabel: {
    color: 'rgba(255,255,255,0.65)',
    textTransform: 'uppercase',
    letterSpacing: 1.3,
    fontSize: 11,
    fontWeight: '600',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
  heroButton: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  heroButtonText: {
    color: '#0B0B0E',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  heroIconTile: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
});
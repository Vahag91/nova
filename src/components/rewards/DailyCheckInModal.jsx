import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import SvgIcon from '../SvgIcon';
import { colors } from '../../styles/colors';
import { getDailyLoginRewardForStreakDay } from '../../lib/rewardsSchedule';

const ACCENT = '#FBBF24';
const CYCLE_DAYS = 7;

/**
 * Surfaces the daily reward on the main screen instead of burying it in the
 * drawer, and doubles as the claim action: the streak only advances when the
 * user actually checks in here.
 */
export default function DailyCheckInModal({
  visible,
  currentStreak,
  claimed,
  claimedAmount,
  onCheckIn,
  onClose,
}) {
  const { t } = useTranslation();

  // Position within the repeating 7-day cycle, not the raw streak length.
  const cycleDay = useMemo(() => {
    const day = Math.max(1, Number(currentStreak) || 0);
    return ((day - 1) % CYCLE_DAYS) + 1;
  }, [currentStreak]);

  // The day being claimed right now sits one past the last completed one.
  const activeDay = claimed ? cycleDay : ((Number(currentStreak) || 0) % CYCLE_DAYS) + 1;

  const days = useMemo(
    () =>
      Array.from({ length: CYCLE_DAYS }, (_, index) => {
        const day = index + 1;
        return {
          day,
          amount: getDailyLoginRewardForStreakDay(day),
          isActive: day === activeDay,
          isPast: day < activeDay,
        };
      }),
    [activeDay],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.title}>
                {t('rewards.checkIn.title', {
                  defaultValue: 'Claim your daily coins',
                })}
              </Text>
              <Text style={styles.subtitle}>
                {t('rewards.checkIn.subtitle', {
                  defaultValue: 'Come back every day for a bigger reward.',
                })}
              </Text>
            </View>
            <View style={styles.headerCoin}>
              <SvgIcon name="coin" size={34} color={ACCENT} />
            </View>
          </View>

          <ScrollView
            horizontal={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.grid}
          >
            {days.map(({ day, amount, isActive, isPast }) => (
              <View
                key={day}
                style={[
                  styles.dayCell,
                  day === CYCLE_DAYS && styles.dayCellWide,
                  isPast && styles.dayCellPast,
                  isActive && styles.dayCellActive,
                ]}
              >
                <SvgIcon
                  name={day === CYCLE_DAYS ? 'diamond' : 'coin'}
                  size={day === CYCLE_DAYS ? 24 : 20}
                  color={isActive || isPast ? ACCENT : 'rgba(251,191,36,0.45)'}
                />
                <Text
                  style={[styles.dayAmount, isActive && styles.dayAmountActive]}
                >
                  {`+${amount}`}
                </Text>
                <Text
                  style={[styles.dayLabel, isActive && styles.dayLabelActive]}
                >
                  {t('rewards.streakTracker.dayLabel', { number: day })}
                </Text>
              </View>
            ))}
          </ScrollView>

          {claimed ? (
            <View style={styles.claimedBanner}>
              <SvgIcon name="check" size={18} color="#10B981" />
              <Text style={styles.claimedText}>
                {t('rewards.checkIn.claimed', {
                  amount: claimedAmount,
                  defaultValue: 'Claimed! +{{amount}} coins',
                })}
              </Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
              onPress={onCheckIn}
              accessibilityRole="button"
            >
              <Text style={styles.ctaText}>
                {t('rewards.checkIn.cta', { defaultValue: 'Check in' })}
              </Text>
            </Pressable>
          )}

          <Pressable
            style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.dismissText}>
              {claimed
                ? t('common.close', { defaultValue: 'Close' })
                : t('rewards.checkIn.later', { defaultValue: 'Later' })}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.74)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 26,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.20)',
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  headerCoin: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251,191,36,0.12)',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayCell: {
    width: '23.5%',
    height: 92,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  dayCellWide: {
    width: '49%',
  },
  dayCellPast: {
    borderColor: 'rgba(251,191,36,0.22)',
  },
  dayCellActive: {
    backgroundColor: 'rgba(251,191,36,0.16)',
    borderColor: ACCENT,
  },
  dayAmount: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  dayAmountActive: {
    color: ACCENT,
  },
  dayLabel: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10,
  },
  dayLabelActive: {
    color: colors.text,
  },
  cta: {
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: ACCENT,
    paddingVertical: 15,
    alignItems: 'center',
  },
  ctaText: {
    color: '#1A1206',
    fontSize: 16,
    fontWeight: '700',
  },
  claimedBanner: {
    marginTop: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(16,185,129,0.14)',
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  claimedText: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '700',
  },
  dismiss: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  dismissText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.9,
  },
});

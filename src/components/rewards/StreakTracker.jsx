import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import SvgIcon from '../SvgIcon';
import { colors } from '../../styles/colors';

export const StreakTracker = ({ currentDay, days = [] }) => {
  const { t } = useTranslation();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 0, 0);
      const diff = Math.max(0, next.getTime() - now.getTime());
      const totalSeconds = Math.floor(diff / 1000);
      const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
      const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
      const seconds = String(totalSeconds % 60).padStart(2, '0');
      setTimeLeft(`${hours}:${minutes}:${seconds}`);
    };

    updateCountdown();
    const id = setInterval(updateCountdown, 1000);
    return () => clearInterval(id);
  }, []);

  // Build from provided days; if empty, generate a neutral preview
  const weekDays = days.length > 0 ? days.map((day) => {
    // Use actualDay if available, otherwise try to parse day.day, or use index
    const dayNumber = day.actualDay || (typeof day.day === 'number' ? day.day : (day.day ? parseInt(String(day.day).replace(/Day\s*/i, '')) : null));
    const reward = dayNumber && dayNumber % 7 === 0 ? 300 : (day.reward || 100);
    return {
      ...day,
      status: day.status,
      reward,
      dayNumber: dayNumber || day.displayDay || 1, // Store the day number for translation
    };
  }) : Array.from({ length: 7 }, (_, i) => ({
    status: i === 0 ? 'current' : 'locked',
    reward: (i + 1) % 7 === 0 ? 300 : 100,
    dayNumber: i + 1,
    actualDay: i + 1,
    displayDay: i + 1,
  }));

  const completedCount = weekDays.filter(d => d.status === 'completed').length;
  const currentIndex = weekDays.findIndex(d => d.status === 'current');
  const streakCount = currentDay ?? (completedCount + (currentIndex >= 0 ? 1 : 0));
  const activePosition = currentIndex >= 0 ? currentIndex : Math.max(completedCount - 1, 0);
  const progressPercentage = weekDays.length > 1
    ? (activePosition / (weekDays.length - 1)) * 100
    : 0;

  const nextRewardDay = weekDays.find(d => d.status !== 'completed' && d.reward);
  const nextRewardAmount = nextRewardDay?.reward ?? 100;
  const nextRewardText = `${nextRewardAmount} ${t('rewards.streakTracker.coins')}`;

  // DayItem component - matches the React web code exactly
  const DayItem = ({ day, index, isLast }) => {
    const isCompleted = day.status === 'completed';
    const isCurrent = day.status === 'current' || day.status === 'active';

    // Use dayNumber from mapped day, or fallback to index + 1
    const dayNumber = day.dayNumber || day.actualDay || day.displayDay || (index + 1);
    // Get the translation template and replace the placeholder
    const dayLabelTemplate = t('rewards.streakTracker.dayLabel');
    const dayLabel = dayLabelTemplate.replace('{{number}}', String(dayNumber));

    if (isLast) {
      return (
        <View style={styles.dayWrapper}>
          <LinearGradient
            colors={['#1F2937', '#000000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.prizeNode}
          >
            <View style={styles.prizeNodeOverlay} />
            <Text style={styles.prizeReward}>300</Text>
          </LinearGradient>
          <Text style={styles.prizeLabel}>{t('rewards.streakTracker.prize')}</Text>
        </View>
      );
    }

    if (isCompleted) {
      return (
        <View style={styles.dayWrapper}>
          <View style={styles.completedNode}>
            <SvgIcon name="check" size={20} color="#4F46E5" />
          </View>
          <Text style={styles.completedLabel}>{dayLabel}</Text>
        </View>
      );
    }

    if (isCurrent) {
      return (
        <View style={styles.dayWrapper}>
          <View style={styles.currentNode}>
            <View style={styles.currentNodeRing} />
            <SvgIcon name="check" size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.currentLabel}>{dayLabel}</Text>
        </View>
      );
    }

    // Locked
    return (
      <View style={styles.dayWrapper}>
        <View style={styles.lockedNode}>
          <Text style={styles.lockedReward}>{day.reward}</Text>
        </View>
        <Text style={styles.lockedLabel}>{dayLabel}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>{t('rewards.streakTracker.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('rewards.streakTracker.subtitle')}</Text>
        </View>
        <View style={styles.streakBadge}>
          <SvgIcon name="flame" size={16} color="#FBBF24" />
          <Text style={styles.streakCount}>{streakCount} {t('rewards.streakTracker.days')}</Text>
        </View>
      </View>

      {/* Progress Line */}
      <View style={styles.timelineContainer}>
        {/* Background Track */}
        <View style={styles.trackBackground} />
        {/* Active Progress */}
        <View style={[styles.trackActive, { width: `${progressPercentage}%` }]} />

        {/* Days Nodes */}
        <View style={styles.daysRow}>
          {weekDays.map((day, index) => (
            <DayItem 
              key={index} 
              day={day} 
              index={index}
              isLast={index === weekDays.length - 1}
            />
          ))}
        </View>
      </View>

      {/* Countdown Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {(() => {
            const template = t('rewards.streakTracker.nextReward');
            // Split by placeholders to apply styles
            const parts = template.split(/(\{\{amount\}\}|\{\{time\}\})/);
            
            return parts.map((part, i) => {
              if (part === '{{amount}}') {
                return <Text key={`amt-${i}`} style={styles.footerHighlight}>{nextRewardText}</Text>;
              }
              if (part === '{{time}}') {
                return <Text key={`tm-${i}`} style={styles.footerTime}>{timeLeft}</Text>;
              }
              if (part && part.length > 0) {
                return <Text key={`txt-${i}`}>{part}</Text>;
              }
              return null;
            }).filter(Boolean);
          })()}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#111112', // Container background color
    borderRadius: 32, // rounded-[2rem]
    padding: 22, // p-6
    borderWidth: 1,
    borderColor: '#2A2A2A', // border-border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: 4,
    marginTop: -12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 32, // mb-8
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 20, // text-xl
    fontWeight: '800',
    fontFamily: 'Lato-Bold',
    color: '#FFFFFF', // text-white
  },
  headerSubtitle: {
    fontSize: 12, // text-xs
    color: '#9CA3AF', // text-gray-400
    fontWeight: '500',
    fontFamily: 'Lato-Regular',
    marginTop: 4, // mt-1
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6, // gap-1.5
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // bg-white/5
    paddingHorizontal: 12, // px-3
    paddingVertical: 4, // py-1 (rounded)
    borderRadius: 999, // rounded-full
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)', // border-white/5
  },
  streakCount: {
    fontSize: 14, // text-sm
    fontWeight: '800',
    fontFamily: 'Lato-Bold',
    color: '#FBBF24', // text-accent
  },
  timelineContainer: {
    position: 'relative',
    marginBottom: 46, // mb-8
    height: 40, // To center the track properly
  },
  trackBackground: {
    position: 'absolute',
    top: '50%',
    left: 16, // left-4
    right: 16, // right-4
    height: 4, // h-1
    backgroundColor: '#1E1E1E', // bg-subtle
    borderRadius: 999,
    marginTop: -2, // -translate-y-1/2
  },
  trackActive: {
    position: 'absolute',
    top: '50%',
    left: 16, // left-4
    height: 4, // h-1
    backgroundColor: '#4F46E5', // bg-primary
    borderRadius: 999,
    marginTop: -2, // -translate-y-1/2
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  dayWrapper: {
    alignItems: 'center',
    gap: 12, // gap-3
  },
  // Prize Node (Last Day)
  prizeNode: {
    width: 40, // w-10
    height: 40, // h-10
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)', // border-accent/30
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  prizeNodeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(251, 191, 36, 0.1)', // bg-accent/10
  },
  prizeReward: {
    fontSize: 12, // text-xs
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
    color: '#FBBF24', // text-accent
  },
  prizeLabel: {
    fontSize: 10, // text-[10px]
    fontWeight: '800',
    fontFamily: 'Lato-Bold',
    color: '#FBBF24', // text-accent
    textTransform: 'uppercase',
    letterSpacing: 1, // tracking-wider
  },
  // Completed Node
  completedNode: {
    width: 40, // w-10
    height: 40, // h-10
    borderRadius: 20,
    backgroundColor: '#121212', // bg-card
    borderWidth: 2, // border-2
    borderColor: '#4F46E5', // border-primary
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  completedLabel: {
    fontSize: 10, // text-[10px]
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
    color: '#9CA3AF', // text-gray-400
    textTransform: 'uppercase',
  },
  // Current/Active Node
  currentNode: {
    width: 40, // w-10
    height: 40, // h-10
    borderRadius: 20,
    backgroundColor: '#4F46E5', // bg-primary
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  currentNodeRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: '#121212', // ring-4 ring-card
  },
  currentLabel: {
    fontSize: 9, // text-[10px]
    fontWeight: '800',
    fontFamily: 'Lato-Bold',
    color: '#FFFFFF', // text-white
    textTransform: 'uppercase',
    letterSpacing: 1, // tracking-wider
  },
  // Locked Node
  lockedNode: {
    width: 40, // w-10
    height: 40, // h-10
    borderRadius: 20,
    backgroundColor: '#121212', // bg-card
    borderWidth: 1,
    borderColor: '#2A2A2A', // border-border
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  lockedReward: {
    fontSize: 12, // text-xs
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
    color: '#6B7280', // text-gray-500
  },
  lockedLabel: {
    fontSize: 9, // text-[10px]
    fontWeight: '500',
    fontFamily: 'Lato-Regular',
    color: '#4B5563', // text-gray-600
    textTransform: 'uppercase',
    // letterSpacing: 1, 
  },
  footer: {
    backgroundColor: 'rgba(30, 30, 30, 0.5)', // bg-subtle/50
    borderRadius: 12, // rounded-xl
    padding: 12, // p-3
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)', // border-white/5
  },
  footerText: {
    fontSize: 12, // text-xs
    color: '#9CA3AF', // text-gray-400
    fontWeight: '500',
    fontFamily: 'Lato-Regular',
  },
  footerHighlight: {
    color: '#FFFFFF', // text-white
    fontWeight: '800',
    fontFamily: 'Lato-Bold',
    marginHorizontal: 4, // mx-1
  },
  footerTime: {
    color: '#818CF8', // text-primaryLight
    fontWeight: '800',
    fontFamily: 'Lato-Bold',
    letterSpacing: 2, // tracking-widest
    fontSize: 14, // text-sm
    marginLeft: 4, // ml-1
  },
});

export default StreakTracker;

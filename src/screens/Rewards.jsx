import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  StyleSheet,
  AppState,
  Share,
  Linking,
  Alert,
  Platform,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { colors } from '../styles/colors';
import { PointsHero } from '../components/rewards/PointsHero';
import { StreakTracker } from '../components/rewards/StreakTracker';
import { QuestCard } from '../components/rewards/QuestCard';
import { RedeemCard } from '../components/rewards/RedeemCard';
import { QuestCompletedModal } from '../components/rewards/QuestCompletedModal';
import { useRewardsStore } from '../state/useRewardsStore';
import { useNavigation } from '@react-navigation/native';

const IOS_APP_ID = '6753916530';
const ANDROID_PACKAGE_NAME = 'com.yourapp.package'; // TODO
const APP_SHARE_URL = `https://apps.apple.com/app/id${IOS_APP_ID}`;
const DAILY_MODAL_KEY = 'rewards-daily-login-modal-day';

// IMPORTANT: use UTC here to match your Zustand store logic
function toDayKey(date = new Date()) {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isCompletedToday(quest) {
  if (!quest?.completedAt) return false;
  const questDay = toDayKey(new Date(quest.completedAt));
  const today = toDayKey();
  return questDay === today;
}

export default function RewardsScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation();

  const recordActivity = useRewardsStore(s => s.recordActivity);
  const hydrated = useRewardsStore(s => s.hydrated);
  const currentStreak = useRewardsStore(s => s.currentStreak);
  const rewardCoins = useRewardsStore(s => s.points);
  const quests = useRewardsStore(s => s.quests);
  const completeQuest = useRewardsStore(s => s.completeQuest);
  const resetQuestsIfMissing = useRewardsStore(s => s.resetQuestsIfMissing);
  const resetAllQuests = useRewardsStore(s => s.resetAllQuests);
  const markQuestAsNotified = useRewardsStore(s => s.markQuestAsNotified);
  const setPoints = useRewardsStore(s => s.setPoints);

  const [modalReward, setModalReward] = useState(null);
  const dailyModalCheckedRef = useRef(false);
  const questsUpdateRef = useRef(false);

  // 1) Wait for hydration, then reset quests and record activity
  useEffect(() => {
    if (!hydrated) return;

    resetQuestsIfMissing();
    const timer = setTimeout(() => {
      recordActivity();
      questsUpdateRef.current = true;
    }, 100);

    return () => clearTimeout(timer);
  }, [hydrated, recordActivity, resetQuestsIfMissing]);

  // 2) Re-run recordActivity when app comes to foreground (streak)
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') recordActivity();
    });
    return () => sub.remove();
  }, [recordActivity]);

  // 3) Daily login modal once per day
  useEffect(() => {
    if (!hydrated || !questsUpdateRef.current) return;
    if (dailyModalCheckedRef.current) return;

    dailyModalCheckedRef.current = true;

    (async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 200));

        const today = toDayKey();
        const storedDay = await AsyncStorage.getItem(DAILY_MODAL_KEY);

        const dailyQuest = quests.find(
          q => q.id === 'daily-login' && q.status === 'completed'
        );

        if (dailyQuest && isCompletedToday(dailyQuest) && storedDay !== today) {
          setModalReward(dailyQuest);
        }
      } catch (e) {
        // Daily modal check error
      }
    })();
  }, [quests, hydrated]);

  // 4) Auto-popup for other completed quests (once)
  useEffect(() => {
    if (!hydrated || !questsUpdateRef.current) return;
    if (modalReward) return;

    const timer = setTimeout(() => {
      const otherUnnotified = quests.find(
        q =>
          q.id !== 'daily-login' &&
          q.status === 'completed' &&
          isCompletedToday(q) &&
          !q.notified
      );

      if (otherUnnotified) setModalReward(otherUnnotified);
    }, 200);

    return () => clearTimeout(timer);
  }, [quests, modalReward, hydrated]);

  const questBuckets = useMemo(
    () => ({
      available: quests.filter(q => q.status !== 'completed'),
      completed: quests.filter(q => q.status === 'completed'),
    }),
    [quests]
  );

  const streakData = useMemo(() => {
    const total = Math.max(currentStreak || 1, 1);
    const len = 7;
    const days = [];

    const currentWeek = Math.ceil(total / 7);
    const dayInWeek = ((total - 1) % 7) + 1;

    for (let i = 0; i < len; i++) {
      const displayDay = i + 1;
      const actualDayNumber = (currentWeek - 1) * 7 + displayDay;

      let status;
      if (currentWeek === 1) {
        status =
          actualDayNumber < total
            ? 'completed'
            : actualDayNumber === total
            ? 'current'
            : 'locked';
      } else {
        if (displayDay < dayInWeek) status = 'completed';
        else if (displayDay === dayInWeek) status = 'current';
        else status = 'locked';
      }

      const reward = displayDay === 7 ? 500 : 200;
      days.push({
        day: actualDayNumber, // Just pass the number, not the formatted string
        status,
        reward,
        actualDay: actualDayNumber,
        displayDay,
      });
    }

    return days;
  }, [currentStreak]);

  // ---------- SHARE HELPERS ----------
  const shareGeneric = async (customMessage) => {
    const message =
      customMessage ||
      t('rewards.quests.share.genericMessage', { url: APP_SHARE_URL });
    try {
      await Share.share({ message });
    } catch (e) {
      // Share error
    }
  };

  const shareToFacebook = async () => {
    const quote = encodeURIComponent(t('rewards.quests.share.facebookQuote'));
    const url = encodeURIComponent(APP_SHARE_URL);
    const fbWebUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${quote}`;
    try {
      await Linking.openURL(fbWebUrl);
    } catch (e) {
      await shareGeneric();
    }
  };

  const shareToTwitter = async () => {
    const text = encodeURIComponent(t('rewards.quests.share.twitterText'));
    const url = encodeURIComponent(APP_SHARE_URL);

    const appUrl = `twitter://post?message=${text}%20${url}`;
    const webUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;

    try {
      const canOpenApp = await Linking.canOpenURL(appUrl);
      await Linking.openURL(canOpenApp ? appUrl : webUrl);
    } catch (e) {
      await shareGeneric();
    }
  };

  const shareToInstagram = async () => {
    const appUrl = 'instagram://app';
    try {
      const canOpenApp = await Linking.canOpenURL(appUrl);
      if (canOpenApp) await Linking.openURL(appUrl);
      else await shareGeneric(t('rewards.quests.share.instagramMessage', { url: APP_SHARE_URL }));
    } catch (e) {
      await shareGeneric();
    }
  };

  const openAppStoreReview = async () => {
    try {
      if (Platform.OS === 'ios') {
        const url = `itms-apps://itunes.apple.com/app/viewContentsUserReviews/id${IOS_APP_ID}?action=write-review`;
        await Linking.openURL(url);
      } else {
        const url = `market://details?id=${ANDROID_PACKAGE_NAME}`;
        await Linking.openURL(url);
      }
    } catch (e) {
      Alert.alert(t('rewards.quests.store.errorTitle'), t('rewards.quests.store.errorMessage'));
    }
  };

  // ---------- QUEST HANDLER ----------
  const handleQuestPress = async (quest) => {
    if (!quest) return;

    try {
      if (quest.id === 'daily-login') {
        Alert.alert(
          t('rewards.quests.dailyLogin.title'),
          t('rewards.quests.dailyLogin.message')
        );
        return;
      }

      if (quest.id === 'share-facebook') await shareToFacebook();
      else if (quest.id === 'share-twitter') await shareToTwitter();
      else if (quest.id === 'share-instagram') await shareToInstagram();
      else if (quest.id === 'share-experience') await openAppStoreReview();
      else {
        completeQuest(quest.id);
        setModalReward(quest);
        return;
      }

      completeQuest(quest.id);
    } catch (e) {
      // Quest Action Failed
    }
  };

  // ---------- MODAL ----------
  const handleCloseModal = async () => {
    try {
      if (modalReward) {
        if (modalReward.id === 'daily-login') {
          const today = toDayKey();
          await AsyncStorage.setItem(DAILY_MODAL_KEY, today);
        } else {
          markQuestAsNotified(modalReward.id);
        }
      }
    } catch (e) {
      // Modal close persist error
    } finally {
      setModalReward(null);
    }
  };


  return (
    <View style={styles.container}>
      <View style={styles.phoneFrame}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <PointsHero
            points={rewardCoins}
            onSeeRewardsPress={() => navigation.navigate('RewardsList')}
          />

          <StreakTracker currentDay={currentStreak} days={streakData} />

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('rewards.sections.availableQuests')}</Text>
            </View>
            <View style={styles.cardStack}>
              {questBuckets.available.map(quest => (
                <QuestCard key={quest.id} quest={quest} onPress={handleQuestPress} />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('rewards.sections.completedQuests')}</Text>
            </View>
            <View style={styles.cardStack}>
              {questBuckets.completed.map(quest => (
                <Pressable
                  key={quest.id}
                  onPress={() => setModalReward(quest)}
                  style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
                >
                  <RedeemCard
                    reward={{
                      id: quest.id,
                      title: quest.title,
                      subtitle: quest.description,
                      currentPoints: quest.points,
                      requiredPoints: quest.points,
                      icon: quest.icon || 'confirmation_number',
                    }}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      <QuestCompletedModal
        visible={!!modalReward}
        quest={modalReward}
        onClose={handleCloseModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneFrame: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.background,
    flex: 1,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 24,
  },
  section: {
    gap: 12,
    marginHorizontal: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Lato-Bold',
    color: colors.text,
  },
  cardStack: {
    gap: 12,
    paddingHorizontal: 4,
  },
});
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Local-day key to align streak with the user's timezone
function toDayKey(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`; // YYYY-MM-DD (local)
}

function diffInDays(aKey, bKey) {
  if (!aKey || !bKey) return null;
  // Parse as local dates (midnight)
  const a = new Date(aKey + 'T00:00:00');
  const b = new Date(bKey + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / ONE_DAY_MS);
}

// Template for default quests (never mutate this)
const defaultQuestsTemplate = [
  {
    id: 'daily-login',
    title: 'Daily Login',
    description: 'Open the app today to keep your streak',
    points: 200,
    status: 'available',
    completedAt: null,
    notified: false,
  },
  {
    id: 'share-facebook',
    title: 'Share on Facebook',
    description: 'Post about us on Facebook',
    points: 200,
    status: 'available',
    completedAt: null,
    notified: false,
  },
  {
    id: 'share-twitter',
    title: 'Share on Twitter',
    description: 'Tweet your experience',
    points: 200,
    status: 'available',
    completedAt: null,
    notified: false,
  },
  {
    id: 'share-instagram',
    title: 'Share on Instagram',
    description: 'Share a story or post',
    points: 200,
    status: 'available',
    completedAt: null,
    notified: false,
  },
  {
    id: 'share-experience',
    title: 'Share your experience',
    description: 'Tell friends why you like the app',
    points: 400,
    status: 'available',
    completedAt: null,
    notified: false,
  },
];

// Deep clone function for fresh quests
function freshQuests() {
  return defaultQuestsTemplate.map(quest => ({
    ...quest,
    completedAt: null,
    notified: false,
  }));
}

// Get a fresh daily-login quest with updated points
function freshDailyLoginQuest(points = 200) {
  return {
    ...defaultQuestsTemplate[0],
    points,
    status: 'available',
    completedAt: null,
    notified: false,
  };
}

export const useRewardsStore = create(
  persist(
    (set, get) => ({
      currentStreak: 0,
      bestStreak: 0,
      lastActiveDay: null, // YYYY-MM-DD (local)
      points: 0,
      quests: freshQuests(),
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),

      setPoints: (value) => {
        const parsed = typeof value === 'number' ? value : 0;
        set({ points: parsed });
      },

      recordActivity: () => {
        const { hydrated } = get();
        if (!hydrated) {
          return;
        }

        const todayKey = toDayKey();
        const { lastActiveDay, currentStreak, bestStreak, points } = get();
        let { quests } = get();
        const diff = lastActiveDay ? diffInDays(lastActiveDay, todayKey) : null;

        const calculateDailyReward = (streakDay) => {
          return streakDay % 7 === 0 ? 500 : 200;
        };

        const hasDaily = quests.some(q => q.id === 'daily-login');
        if (!hasDaily) {
          const reward = calculateDailyReward(currentStreak || 1);
          quests = [...quests, freshDailyLoginQuest(reward)];
        }

        if (diff === 0) {
          if (currentStreak > 0 && lastActiveDay === todayKey) {
            const dailyQuest = quests.find(q => q.id === 'daily-login');
            const questCompletedToday = dailyQuest?.completedAt 
              ? toDayKey(new Date(dailyQuest.completedAt)) === todayKey
              : false;
            
            if (!dailyQuest || dailyQuest.status !== 'completed' || !questCompletedToday) {
              const reward = calculateDailyReward(currentStreak);
              let updatedQuests;
              
              if (!dailyQuest) {
                updatedQuests = [...quests, { ...freshDailyLoginQuest(reward), status: 'completed', completedAt: new Date().toISOString() }];
              } else {
                updatedQuests = quests.map(q =>
                  q.id === 'daily-login'
                    ? { ...freshDailyLoginQuest(reward), status: 'completed', completedAt: new Date().toISOString() }
                    : q
                );
              }
              set({ quests: updatedQuests });
            }
          }
          return;
        }

        let reward;
        let nextStreak;
        
        if (!lastActiveDay) {
          nextStreak = 1;
          reward = calculateDailyReward(1);
        } else if (diff === 1) {
          nextStreak = currentStreak + 1;
          reward = calculateDailyReward(nextStreak);
        } else {
          nextStreak = 1;
          reward = calculateDailyReward(1);
        }

        const dailyLoginQuest = freshDailyLoginQuest(reward);
        const hasDailyLogin = quests.some(q => q.id === 'daily-login');
        
        if (hasDailyLogin) {
          quests = quests.map(q =>
            q.id === 'daily-login' ? dailyLoginQuest : q
          );
        } else {
          quests = [...quests, dailyLoginQuest];
        }

        quests = completeQuestState(quests, 'daily-login');

        const today = toDayKey();
        quests = quests.map(q => {
          if (q.id.startsWith('share-')) {
            if (q.completedAt) {
              const completedDay = toDayKey(new Date(q.completedAt));
              if (completedDay !== today) {
                const templateQuest = defaultQuestsTemplate.find(tq => tq.id === q.id);
                return {
                  ...q,
                  status: 'available',
                  completedAt: null,
                  notified: false,
                  points: templateQuest?.points || q.points,
                };
              }
            }
          }
          return q;
        });

        set({
          currentStreak: nextStreak,
          bestStreak: Math.max(bestStreak, nextStreak),
          lastActiveDay: todayKey,
          points: points + reward,
          quests,
        });
      },

      completeQuest: (questId) => {
        const { quests, points } = get();
        const before = quests.find(q => q.id === questId);
        const nextQuests = completeQuestState(quests, questId);
        const after = nextQuests.find(q => q.id === questId);

        const earned =
          before && before.status !== 'completed' && after?.status === 'completed'
            ? before.points
            : 0;

        set({
          quests: nextQuests,
          points: points + earned,
        });
      },

      resetQuestsIfMissing: () => {
        const { quests } = get();
        if (!quests || !quests.length) {
          set({ quests: freshQuests() });
        } else {
          const updatedQuests = quests.map(quest => {
            const templateQuest = defaultQuestsTemplate.find(tq => tq.id === quest.id);
            if (templateQuest && quest.points !== templateQuest.points) {
              if (quest.status === 'available') {
                return { ...quest, points: templateQuest.points };
              }
            }
            return quest;
          });
          const hasChanges = updatedQuests.some((q, i) => q.points !== quests[i]?.points);
          if (hasChanges) {
            set({ quests: updatedQuests });
          }
        }
      },

      resetAllQuests: () => {
        set({ quests: freshQuests() });
      },

      markQuestAsNotified: (questId) => {
        const { quests } = get();
        set({
          quests: quests.map(q =>
            q.id === questId ? { ...q, notified: true } : q
          ),
        });
      },
    }),
    {
      name: 'rewards-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentStreak: state.currentStreak,
        bestStreak: state.bestStreak,
        lastActiveDay: state.lastActiveDay,
        points: state.points,
        quests: state.quests,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn('Rewards store rehydration error:', error);
          useRewardsStore.setState({ hydrated: true });
          return;
        }
        useRewardsStore.setState({ hydrated: true });
      },
    }
  )
);

function completeQuestState(quests, questId) {
  const now = new Date().toISOString();
  return quests.map(q => {
    if (q.id !== questId) return q;
    // Idempotent: if already completed, return unchanged
    if (q.status === 'completed') return q;
    return {
      ...q,
      status: 'completed',
      completedAt: now,
      notified: false,
    };
  });
}

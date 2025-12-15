import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// UTC-based day key to avoid timezone bugs
function toDayKey(date = new Date()) {
  const d = new Date(date);
  // Use UTC to avoid timezone issues
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`; // YYYY-MM-DD (UTC)
}

function diffInDays(aKey, bKey) {
  if (!aKey || !bKey) return null;
  // Parse as UTC dates
  const a = new Date(aKey + 'T00:00:00Z');
  const b = new Date(bKey + 'T00:00:00Z');
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
      lastActiveDay: null, // YYYY-MM-DD (UTC)
      points: 0,
      quests: freshQuests(),
      hydrated: false, // Flag to track hydration state

      // Set hydration flag after store is loaded
      setHydrated: () => {
        set({ hydrated: true });
      },

      // Set reward coins (local only, not synced with backend)
      setPoints: (value) => {
        const parsed = typeof value === 'number' ? value : 0;
        set({ points: parsed });
      },

      // Called on app start + when coming to foreground
      recordActivity: () => {
        // Prevent running before hydration to avoid duplicate rewards
        const { hydrated } = get();
        if (!hydrated) {
          return;
        }

        const todayKey = toDayKey();
        const { lastActiveDay, currentStreak, bestStreak, points } = get();
        let { quests } = get();
        const diff = lastActiveDay ? diffInDays(lastActiveDay, todayKey) : null;

        // Calculate reward based on streak day
        // Every 7th day (7, 14, 21, 28...) gets 500 coins, others get 200
        const calculateDailyReward = (streakDay) => {
          // Streak day is 1-indexed (1, 2, 3...)
          return streakDay % 7 === 0 ? 500 : 200;
        };

        // Ensure daily-login quest exists (using fresh clone)
        const hasDaily = quests.some(q => q.id === 'daily-login');
        if (!hasDaily) {
          const reward = calculateDailyReward(currentStreak || 1);
          quests = [...quests, freshDailyLoginQuest(reward)];
        }

        // Same calendar day → no extra points, no streak change
        if (diff === 0) {
          // If streak is already set and lastActiveDay matches today, ensure quest is set up correctly
          if (currentStreak > 0 && lastActiveDay === todayKey) {
            const dailyQuest = quests.find(q => q.id === 'daily-login');
            const questCompletedToday = dailyQuest?.completedAt 
              ? toDayKey(new Date(dailyQuest.completedAt)) === todayKey
              : false;
            
            // Only update if quest is missing or not completed today (without changing streak/points)
            if (!dailyQuest || dailyQuest.status !== 'completed' || !questCompletedToday) {
              const reward = calculateDailyReward(currentStreak);
              let updatedQuests;
              
              if (!dailyQuest) {
                // Add quest if missing
                updatedQuests = [...quests, { ...freshDailyLoginQuest(reward), status: 'completed', completedAt: new Date().toISOString() }];
              } else {
                // Update existing quest
                updatedQuests = quests.map(q =>
                  q.id === 'daily-login'
                    ? { ...freshDailyLoginQuest(reward), status: 'completed', completedAt: new Date().toISOString() }
                    : q
                );
              }
              set({ quests: updatedQuests });
            }
          }
          return; // Same day - no further processing
        }

        // New day (or first time / streak broken)
        // Calculate reward and update quest points BEFORE marking as completed
        let reward;
        let nextStreak;
        
        if (!lastActiveDay) {
          // First ever day - Day 1
          nextStreak = 1;
          reward = calculateDailyReward(1);
        } else if (diff === 1) {
          // Streak continues
          nextStreak = currentStreak + 1;
          reward = calculateDailyReward(nextStreak);
        } else {
          // Streak broken - reset to Day 1
          nextStreak = 1;
          reward = calculateDailyReward(1);
        }

        // Reset daily-login quest with correct points BEFORE completing
        const dailyLoginQuest = freshDailyLoginQuest(reward);
        const hasDailyLogin = quests.some(q => q.id === 'daily-login');
        
        if (hasDailyLogin) {
          // Update existing quest
          quests = quests.map(q =>
            q.id === 'daily-login' ? dailyLoginQuest : q
          );
        } else {
          // Add new quest if missing
          quests = [...quests, dailyLoginQuest];
        }

        // Now mark as completed with correct points
        quests = completeQuestState(quests, 'daily-login');

        // Reset share quests daily (optional - can be removed if not desired)
        const today = toDayKey();
        quests = quests.map(q => {
          if (q.id.startsWith('share-')) {
            // Check if quest was completed on a different day
            if (q.completedAt) {
              const completedDay = toDayKey(new Date(q.completedAt));
              if (completedDay !== today) {
                // Reset share quests for new day and update points from template
                const templateQuest = defaultQuestsTemplate.find(tq => tq.id === q.id);
                return {
                  ...q,
                  status: 'available',
                  completedAt: null,
                  notified: false,
                  points: templateQuest?.points || q.points, // Update points from template
                };
              }
            }
          }
          return q;
        });

        // Update state with new streak and points
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
          // Update quest points to match template (migration for updated rewards)
          const updatedQuests = quests.map(quest => {
            const templateQuest = defaultQuestsTemplate.find(tq => tq.id === quest.id);
            if (templateQuest && quest.points !== templateQuest.points) {
              // Only update points if quest is not completed, or if it's available
              if (quest.status === 'available') {
                return { ...quest, points: templateQuest.points };
              }
            }
            return quest;
          });
          // Only update if there were changes
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
        // Don't persist hydrated flag - always start as false
      }),
      onRehydrateStorage: () => (state, error) => {
        // After rehydration completes, set hydrated flag
        if (!error && state) {
          // Use setTimeout to ensure state is fully hydrated before setting flag
          setTimeout(() => {
            if (state && typeof state.setHydrated === 'function') {
              state.setHydrated();
            }
          }, 0);
        } else if (error) {
          // On error, still mark as hydrated to prevent blocking
          console.warn('Rewards store rehydration error:', error);
        }
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

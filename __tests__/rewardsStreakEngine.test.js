/**
 * Behavioural coverage for the restored retention loop: streak advance,
 * same-day idempotency, gap reset, and the points curve paid on each claim.
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

const { useRewardsStore } = require('../src/state/useRewardsStore');
const {
  isDailyLoginCompletedToday,
} = require('../src/notifications/rewardReminderHelpers');

const dayKey = date => {
  const d = new Date(date);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const daysAgo = n => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dayKey(d);
};

const reset = state => {
  useRewardsStore.setState({
    hydrated: true,
    points: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastActiveDay: null,
    quests: [],
    ...state,
  });
};

describe('streak engine', () => {
  test('ignores activity until the store has hydrated', () => {
    reset({ hydrated: false });
    useRewardsStore.getState().recordActivity();

    // Acting pre-hydration would overwrite persisted streaks with a fresh one.
    expect(useRewardsStore.getState().currentStreak).toBe(0);
    expect(useRewardsStore.getState().points).toBe(0);
  });

  test('first ever launch opens a streak and pays day 1', () => {
    reset();
    useRewardsStore.getState().recordActivity();

    const s = useRewardsStore.getState();
    expect(s.currentStreak).toBe(1);
    expect(s.points).toBe(200);
    expect(s.lastActiveDay).toBe(dayKey(new Date()));
  });

  test('a consecutive day advances the streak and pays the curve', () => {
    reset({ lastActiveDay: daysAgo(1), currentStreak: 6, bestStreak: 6 });
    useRewardsStore.getState().recordActivity();

    const s = useRewardsStore.getState();
    expect(s.currentStreak).toBe(7);
    expect(s.points).toBe(500); // day 7 of the cycle
    expect(s.bestStreak).toBe(7);
  });

  test('a missed day resets the streak but preserves the best', () => {
    reset({ lastActiveDay: daysAgo(3), currentStreak: 9, bestStreak: 9 });
    useRewardsStore.getState().recordActivity();

    const s = useRewardsStore.getState();
    expect(s.currentStreak).toBe(1);
    expect(s.bestStreak).toBe(9);
    expect(s.points).toBe(200);
  });

  test('re-opening the app the same day does not double-pay', () => {
    reset();
    useRewardsStore.getState().recordActivity();
    const afterFirst = useRewardsStore.getState().points;

    useRewardsStore.getState().recordActivity();
    useRewardsStore.getState().recordActivity();

    const s = useRewardsStore.getState();
    expect(s.points).toBe(afterFirst);
    expect(s.currentStreak).toBe(1);
  });

  test('claiming marks the daily-login quest complete for today', () => {
    reset();
    useRewardsStore.getState().recordActivity();

    const { quests } = useRewardsStore.getState();
    const daily = quests.find(q => q.id === 'daily-login');
    expect(daily.status).toBe('completed');

    // App.js relies on this to cancel the evening reminder once claimed.
    expect(isDailyLoginCompletedToday(quests)).toBe(true);
  });

  test('a fresh day leaves the reminder armed until the claim lands', () => {
    reset({ lastActiveDay: daysAgo(1), currentStreak: 2, bestStreak: 2 });
    expect(isDailyLoginCompletedToday(useRewardsStore.getState().quests)).toBe(
      false,
    );

    useRewardsStore.getState().recordActivity();
    expect(isDailyLoginCompletedToday(useRewardsStore.getState().quests)).toBe(
      true,
    );
  });
});

describe('quests', () => {
  test('does not offer or restore the removed review-incentive quest', () => {
    reset();
    useRewardsStore.getState().resetAllQuests();
    expect(
      useRewardsStore.getState().quests.some(q => q.id === 'share-experience'),
    ).toBe(false);

    useRewardsStore.setState(state => ({
      quests: [
        ...state.quests,
        {
          id: 'share-experience',
          points: 400,
          status: 'available',
        },
      ],
    }));
    useRewardsStore.getState().resetQuestsIfMissing();

    expect(
      useRewardsStore.getState().quests.some(q => q.id === 'share-experience'),
    ).toBe(false);
  });

  test('completing a quest credits its points exactly once', () => {
    reset();
    useRewardsStore.getState().resetAllQuests();
    const start = useRewardsStore.getState().points;

    useRewardsStore.getState().completeQuest('share-facebook');
    const afterFirst = useRewardsStore.getState().points;
    expect(afterFirst).toBe(start + 200);

    useRewardsStore.getState().completeQuest('share-facebook');
    expect(useRewardsStore.getState().points).toBe(afterFirst);
  });
});

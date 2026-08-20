const fs = require('fs');
const path = require('path');

const readSource = relativePath =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

/**
 * Load-time smoke test: every restored rewards module must resolve its imports
 * and evaluate without throwing. Catches drift between the restored code and
 * the modules it depends on (renamed exports, moved files, removed helpers).
 */
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Reanimated's own mock is untranspiled TS, so stub the surface we use.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const identity = value => value;
  return {
    __esModule: true,
    default: {
      View,
      Text: View,
      ScrollView: View,
      Image: View,
      createAnimatedComponent: component => component,
    },
    useSharedValue: initial => ({ value: initial }),
    useAnimatedStyle: factory => {
      factory();
      return {};
    },
    withTiming: identity,
    withSpring: identity,
    withRepeat: identity,
    withSequence: identity,
    withDelay: (_delay, value) => value,
    runOnJS: fn => fn,
    Easing: {
      linear: identity,
      ease: identity,
      inOut: identity,
      out: identity,
      in: identity,
      bezier: () => identity,
    },
  };
});

// Pulled in transitively via useImagesStore; touches native modules on import.
jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    CachesDirectoryPath: '/tmp/caches',
    DocumentDirectoryPath: '/tmp/documents',
    exists: jest.fn(() => Promise.resolve(false)),
    mkdir: jest.fn(() => Promise.resolve()),
    unlink: jest.fn(() => Promise.resolve()),
    downloadFile: jest.fn(() => ({ promise: Promise.resolve({ statusCode: 200 }) })),
  },
}));

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn(() => Promise.resolve()),
    getNotificationSettings: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
    createChannel: jest.fn(() => Promise.resolve('daily-reward')),
    getTriggerNotifications: jest.fn(() => Promise.resolve([])),
    createTriggerNotification: jest.fn(() => Promise.resolve()),
    cancelNotification: jest.fn(() => Promise.resolve()),
  },
  TriggerType: { TIMESTAMP: 0 },
  AlarmType: { SET_AND_ALLOW_WHILE_IDLE: 1, SET_EXACT_AND_ALLOW_WHILE_IDLE: 3 },
  AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1 },
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  EventType: { PRESS: 1 },
}));

const modules = [
  ['rewards schedule', '../src/lib/rewardsSchedule'],
  ['rewards supabase client', '../src/lib/rewardsSupabase'],
  ['rewards store', '../src/state/useRewardsStore'],
  ['reminder helpers', '../src/notifications/rewardReminderHelpers'],
  ['daily reward notifications', '../src/notifications/dailyRewardNotifications'],
  ['Rewards screen', '../src/screens/Rewards'],
  ['RewardsStack', '../src/navigation/RewardsStack'],
  ['PointsHero', '../src/components/rewards/PointsHero'],
  ['StreakTracker', '../src/components/rewards/StreakTracker'],
  ['QuestCard', '../src/components/rewards/QuestCard'],
  ['RedeemCard', '../src/components/rewards/RedeemCard'],
  ['RewardsList', '../src/components/rewards/RewardsList'],
  ['SecretBoxModal', '../src/components/rewards/SecretBoxModal'],
  ['RewardSuccessModal', '../src/components/rewards/RewardSuccessModal'],
  ['QuestCompletedModal', '../src/components/rewards/QuestCompletedModal'],
  ['rewards Header', '../src/components/rewards/Header'],
];

describe('restored rewards modules load cleanly', () => {
  test.each(modules)('%s', (_label, request) => {
    expect(() => require(request)).not.toThrow();
  });
});

describe('module contracts the app depends on', () => {
  test('notification scheduler exposes the functions App.js imports', () => {
    const mod = require('../src/notifications/dailyRewardNotifications');
    expect(typeof mod.scheduleDailyRewardReminders).toBe('function');
    expect(typeof mod.cancelTodayDailyRewardReminder).toBe('function');
    expect(typeof mod.cancelAllDailyRewardReminders).toBe('function');
  });

  test('redeem path is exported for the rewards list', () => {
    expect(typeof require('../src/lib/rewardsSupabase').redeemReward).toBe(
      'function',
    );
  });

  test('Android reward sharing uses the production Play listing', () => {
    const source = readSource('src/screens/Rewards.jsx');
    expect(source).toContain('com.aicloudsolutions.cloud');
    expect(source).toContain('https://play.google.com/store/apps/details?id=');
    expect(source).not.toContain('com.yourapp.package');
  });

  test('malformed redemptions fail before the local balance is deducted', () => {
    const source = readSource('src/components/rewards/RewardsList.jsx');
    const validationIndex = source.indexOf('if (!res || res.ok !== true)');
    const deductionIndex = source.indexOf(
      'useRewardsStore.getState().setPoints(newBalance)',
    );

    expect(validationIndex).toBeGreaterThan(-1);
    expect(source.slice(validationIndex, deductionIndex)).toContain(
      'throw new Error',
    );
    expect(deductionIndex).toBeGreaterThan(validationIndex);
  });

  test('screens and stack export renderable components', () => {
    for (const request of [
      '../src/screens/Rewards',
      '../src/navigation/RewardsStack',
    ]) {
      const exported = require(request).default;
      expect(['function', 'object']).toContain(typeof exported);
      expect(exported).toBeTruthy();
    }
  });
});

/**
 * Runtime verification: the Rewards screen actually renders real content, and
 * the notification scheduler produces the triggers the retention loop needs.
 * Module-load tests prove imports resolve; these prove the code executes.
 */
const React = require('react');
const renderer = require('react-test-renderer');

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    CachesDirectoryPath: '/tmp/caches',
    DocumentDirectoryPath: '/tmp/documents',
    exists: jest.fn(() => Promise.resolve(false)),
    mkdir: jest.fn(() => Promise.resolve()),
    unlink: jest.fn(() => Promise.resolve()),
  },
}));

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
    withDelay: (_d, v) => v,
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

const createdTriggers = [];
const cancelled = [];

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
    getNotificationSettings: jest.fn(() => Promise.resolve({ authorizationStatus: 1 })),
    createChannel: jest.fn(() => Promise.resolve('daily-reward')),
    getTriggerNotifications: jest.fn(() => Promise.resolve([])),
    createTriggerNotification: jest.fn((notification, trigger) => {
      createdTriggers.push({ notification, trigger });
      return Promise.resolve();
    }),
    cancelNotification: jest.fn(id => {
      cancelled.push(id);
      return Promise.resolve();
    }),
  },
  TriggerType: { TIMESTAMP: 0 },
  AlarmType: { SET_AND_ALLOW_WHILE_IDLE: 1, SET_EXACT_AND_ALLOW_WHILE_IDLE: 3 },
  AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1 },
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  EventType: { PRESS: 1 },
}));

jest.mock('react-native-localize', () => ({
  getLocales: () => [
    { languageTag: 'en-US', languageCode: 'en', countryCode: 'US', isRTL: false },
  ],
  getTimeZone: () => 'UTC',
  getNumberFormatSettings: () => ({
    decimalSeparator: '.',
    groupingSeparator: ',',
  }),
  uses24HourClock: () => true,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
  useIsFocused: () => true,
}));

require('../src/i18n');

const { useRewardsStore } = require('../src/state/useRewardsStore');

const collectText = tree => {
  const out = [];
  const walk = node => {
    if (node == null) return;
    if (typeof node === 'string' || typeof node === 'number') {
      out.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node.children) node.children.forEach(walk);
  };
  walk(tree);
  return out.join(' ');
};

describe('Rewards screen renders', () => {
  beforeEach(() => {
    useRewardsStore.setState({
      hydrated: true,
      points: 0,
      currentStreak: 0,
      bestStreak: 0,
      lastActiveDay: null,
      quests: [],
    });
    useRewardsStore.getState().resetAllQuests();
  });

  test('mounts without throwing and paints quest content', () => {
    const Rewards = require('../src/screens/Rewards').default;

    let tree;
    renderer.act(() => {
      tree = renderer.create(React.createElement(Rewards));
    });

    expect(tree).toBeTruthy();
    const text = collectText(tree.toJSON());

    // Real strings resolved through i18n, not just a mounted empty shell.
    expect(text.length).toBeGreaterThan(0);
    expect(text).toMatch(/Daily Login|Quest|Reward/i);

    renderer.act(() => tree.unmount());
  });

  test('reflects earned points after a claim', () => {
    useRewardsStore.getState().recordActivity();
    const earned = useRewardsStore.getState().points;
    expect(earned).toBe(200);

    const Rewards = require('../src/screens/Rewards').default;
    let tree;
    renderer.act(() => {
      tree = renderer.create(React.createElement(Rewards));
    });

    expect(collectText(tree.toJSON())).toContain(String(earned));
    renderer.act(() => tree.unmount());
  });
});

describe('reminder scheduling produces real triggers', () => {
  beforeEach(() => {
    createdTriggers.length = 0;
    cancelled.length = 0;
  });

  test('schedules a 22:00 local trigger per upcoming day, routed to Rewards', async () => {
    const {
      scheduleDailyRewardReminders,
    } = require('../src/notifications/dailyRewardNotifications');

    await scheduleDailyRewardReminders({
      daysAhead: 7,
      hour: 22,
      minute: 0,
      title: 'Daily reward',
      body: 'Claim before midnight.',
      lang: 'en',
      timeZone: 'UTC',
      force: true,
      route: 'Rewards',
    });

    expect(createdTriggers.length).toBeGreaterThan(0);
    expect(createdTriggers.length).toBeLessThanOrEqual(7);

    for (const { notification, trigger } of createdTriggers) {
      // Tapping the reminder must land on the restored route.
      expect(notification.data.route).toBe('Rewards');
      expect(notification.id).toMatch(/^daily_reward_\d{8}$/);

      // Every trigger fires at 22:00 local, in the future.
      const when = new Date(trigger.timestamp);
      expect(when.getHours()).toBe(22);
      expect(when.getMinutes()).toBe(0);
      expect(trigger.timestamp).toBeGreaterThan(Date.now());
    }

    // IDs are unique per day, so re-running cannot double-schedule.
    const ids = createdTriggers.map(t => t.notification.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('schedules nothing when the user declined notifications', async () => {
    const notifee = require('@notifee/react-native').default;
    notifee.getNotificationSettings.mockResolvedValueOnce({ authorizationStatus: 0 });

    const {
      scheduleDailyRewardReminders,
    } = require('../src/notifications/dailyRewardNotifications');

    const result = await scheduleDailyRewardReminders({
      daysAhead: 7,
      title: 'Daily reward',
      body: 'Claim before midnight.',
      force: true,
    });

    // Queuing triggers that can never display wastes a WorkManager slot on
    // every launch and hides the fact that reminders are off.
    expect(result).toEqual({ scheduled: false, reason: 'permission_denied' });
    expect(createdTriggers).toHaveLength(0);
  });

  test('never triggers the system prompt itself', async () => {
    const notifee = require('@notifee/react-native').default;
    notifee.requestPermission.mockClear();

    const {
      scheduleDailyRewardReminders,
    } = require('../src/notifications/dailyRewardNotifications');

    await scheduleDailyRewardReminders({
      daysAhead: 3,
      title: 'Daily reward',
      body: 'Claim before midnight.',
      force: true,
    });

    // Android allows one notification prompt ever. The priming modal owns it;
    // if the scheduler also requests, tapping "Not now" still shows the system
    // dialog and the priming screen becomes pointless.
    expect(notifee.requestPermission).not.toHaveBeenCalled();
  });

  test('requests delivery that survives Doze', async () => {
    const {
      scheduleDailyRewardReminders,
    } = require('../src/notifications/dailyRewardNotifications');

    await scheduleDailyRewardReminders({
      daysAhead: 3,
      title: 'Daily reward',
      body: 'Claim before midnight.',
      force: true,
    });

    expect(createdTriggers.length).toBeGreaterThan(0);
    for (const { trigger } of createdTriggers) {
      // SET_AND_ALLOW_WHILE_IDLE fires through Doze without needing the
      // Play-restricted SCHEDULE_EXACT_ALARM permission.
      expect(trigger.alarmManager).toEqual({ type: 1 });
    }
  });

  test("cancels today's reminder once the daily login is claimed", async () => {
    const {
      cancelTodayDailyRewardReminder,
    } = require('../src/notifications/dailyRewardNotifications');

    await cancelTodayDailyRewardReminder();

    const now = new Date();
    const compact = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
      2,
      '0',
    )}${String(now.getDate()).padStart(2, '0')}`;
    expect(cancelled).toContain(`daily_reward_${compact}`);
  });
});

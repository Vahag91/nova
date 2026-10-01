const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

const {
  getDailyLoginRewardForStreakDay,
} = require('../src/lib/rewardsSchedule');

describe('daily rewards schedule', () => {
  test('pays the 7-day cycle curve', () => {
    // Days 1-4 pay 200, days 5-6 pay 300, day 7 pays 500.
    expect([1, 2, 3, 4].map(getDailyLoginRewardForStreakDay)).toEqual([
      200, 200, 200, 200,
    ]);
    expect([5, 6].map(getDailyLoginRewardForStreakDay)).toEqual([300, 300]);
    expect(getDailyLoginRewardForStreakDay(7)).toBe(500);
  });

  test('repeats the cycle past day 7', () => {
    expect(getDailyLoginRewardForStreakDay(8)).toBe(200);
    expect(getDailyLoginRewardForStreakDay(14)).toBe(500);
    expect(getDailyLoginRewardForStreakDay(15)).toBe(200);
  });

  test('clamps invalid streak days to day 1', () => {
    expect(getDailyLoginRewardForStreakDay(0)).toBe(200);
    expect(getDailyLoginRewardForStreakDay(-3)).toBe(200);
    expect(getDailyLoginRewardForStreakDay(undefined)).toBe(200);
  });
});

describe('rewards feature wiring', () => {
  test('ships every module the rewards flow needs', () => {
    const required = [
      'src/lib/rewardsSchedule.js',
      'src/lib/rewardsSupabase.js',
      'src/state/useRewardsStore.js',
      'src/navigation/RewardsStack.js',
      'src/screens/Rewards.jsx',
      'src/notifications/dailyRewardNotifications.js',
      'src/notifications/rewardReminderHelpers.js',
    ];

    for (const rel of required) {
      expect(fs.existsSync(path.join(repoRoot, rel))).toBe(true);
    }
  });

  test('App.js no longer carries the removal tombstones', () => {
    const appSource = read('App.js');

    // These constants cancelled daily_reward_* triggers and swallowed reward
    // notification taps. Leaving them in place silently disables the feature.
    expect(appSource).not.toContain('REMOVED_REWARDS_ROUTE_NAMES');
    expect(appSource).not.toContain('REMOVED_DAILY_REWARD_NOTIFICATION_PREFIX');
    expect(appSource).not.toContain('isRemovedRewardsRoute');
  });

  test('App.js schedules the daily reminders', () => {
    const appSource = read('App.js');
    expect(appSource).toContain('scheduleDailyRewardReminders');
    expect(appSource).toContain('isDailyLoginCompletedToday');
  });

  test('declares POST_NOTIFICATIONS so reminders can actually display', () => {
    // targetSdk is 33+, so without the manifest entry the runtime request is a
    // no-op and every scheduled daily reward reminder is silently dropped.
    expect(read('android/app/src/main/AndroidManifest.xml')).toContain(
      'android.permission.POST_NOTIFICATIONS',
    );
  });

  test('rewards header opens the custom sidebar, not the empty drawer', () => {
    const header = read('src/components/rewards/Header.jsx');

    // react-navigation's drawer renders `drawerContent={() => null}`, so
    // toggleDrawer() slides out a blank panel and shoves the screen aside.
    expect(header).not.toMatch(/navigation.toggleDrawer/);
    expect(header).toContain('openMenu');
  });

  test('the daily check-in modal owns the claim', () => {
    const appSource = read('App.js');

    expect(appSource).toContain('DailyCheckInModal');
    expect(appSource).toContain('CHECK_IN_SHOWN_KEY');

    // The reminder-scheduling effect must not claim silently, or the modal's
    // button would be granting something the user already received on launch.
    const syncStart = appSource.indexOf('const sync = async');
    const syncEnd = appSource.indexOf('scheduleDailyRewardReminders', syncStart);
    expect(syncStart).toBeGreaterThan(-1);
    expect(appSource.slice(syncStart, syncEnd)).not.toContain(
      'recordRewardActivity()',
    );
  });

  test("claiming today's reward immediately cancels today's reminder", () => {
    const appSource = read('App.js');
    const rewardsSource = read('src/screens/Rewards.jsx');

    const checkInStart = appSource.indexOf('const handleCheckIn = useCallback');
    const checkInEnd = appSource.indexOf('const handleCheckInClose', checkInStart);
    expect(checkInStart).toBeGreaterThan(-1);
    expect(appSource.slice(checkInStart, checkInEnd)).toContain(
      'cancelTodayDailyRewardReminder()',
    );

    const questClaimStart = rewardsSource.indexOf(
      "if (quest.id === 'daily-login')",
    );
    const questClaimEnd = rewardsSource.indexOf(
      "if (quest.id === 'share-facebook')",
      questClaimStart,
    );
    const questClaimSource = rewardsSource.slice(
      questClaimStart,
      questClaimEnd,
    );

    expect(questClaimStart).toBeGreaterThan(-1);
    expect(questClaimSource).toContain('recordActivity()');
    expect(questClaimSource).toContain('cancelTodayDailyRewardReminder()');
    expect(questClaimSource.indexOf('recordActivity()')).toBeLessThan(
      questClaimSource.indexOf('cancelTodayDailyRewardReminder()'),
    );
  });

  test('daily check-in closes only after its claim animation completes', () => {
    const modalSource = read('src/components/rewards/DailyCheckInModal.jsx');

    expect(modalSource).toContain(
      'const CLAIM_AUTO_CLOSE_MS = CLAIM_SPIN_MS + CLAIM_HOLD_MS',
    );
    expect(modalSource).toContain('if (!visible || !claimed) return undefined');
    expect(modalSource).toContain('() => onClose?.()');
    expect(modalSource).not.toContain("t('common.close'");
  });

  test('Rewards is reachable from navigation', () => {
    expect(read('src/navigation/DrawerNavigator.js')).toContain('name="Rewards"');
    expect(read('src/navigation/AndroidNavigationMenu.jsx')).toContain(
      "handleMenuItemPress('Rewards')",
    );
  });
});

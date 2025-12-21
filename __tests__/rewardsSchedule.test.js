import { getDailyLoginRewardForStreakDay } from '../src/lib/rewardsSchedule';

describe('getDailyLoginRewardForStreakDay', () => {
  test('uses 200 for days 1-4', () => {
    expect(getDailyLoginRewardForStreakDay(1)).toBe(200);
    expect(getDailyLoginRewardForStreakDay(2)).toBe(200);
    expect(getDailyLoginRewardForStreakDay(3)).toBe(200);
    expect(getDailyLoginRewardForStreakDay(4)).toBe(200);
  });

  test('uses 300 for days 5-6', () => {
    expect(getDailyLoginRewardForStreakDay(5)).toBe(300);
    expect(getDailyLoginRewardForStreakDay(6)).toBe(300);
  });

  test('uses 500 for day 7', () => {
    expect(getDailyLoginRewardForStreakDay(7)).toBe(500);
  });

  test('repeats every 7 days', () => {
    expect(getDailyLoginRewardForStreakDay(8)).toBe(200);
    expect(getDailyLoginRewardForStreakDay(9)).toBe(200);
    expect(getDailyLoginRewardForStreakDay(10)).toBe(200);
    expect(getDailyLoginRewardForStreakDay(11)).toBe(200);
    expect(getDailyLoginRewardForStreakDay(12)).toBe(300);
    expect(getDailyLoginRewardForStreakDay(13)).toBe(300);
    expect(getDailyLoginRewardForStreakDay(14)).toBe(500);
  });

  test('handles invalid input', () => {
    expect(getDailyLoginRewardForStreakDay(0)).toBe(200);
    expect(getDailyLoginRewardForStreakDay(-3)).toBe(200);
    expect(getDailyLoginRewardForStreakDay(null)).toBe(200);
    expect(getDailyLoginRewardForStreakDay(undefined)).toBe(200);
    expect(getDailyLoginRewardForStreakDay(NaN)).toBe(200);
  });
});


export function getDailyLoginRewardForStreakDay(streakDay) {
  const day = Math.max(1, Number(streakDay) || 1);
  const dayInCycle = ((day - 1) % 7) + 1;

  if (dayInCycle <= 4) return 200;
  if (dayInCycle <= 6) return 300;
  return 500;
}


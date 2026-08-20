// src/notifications/rewardReminderHelpers.js
function toDayKeyLocal(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isDailyLoginCompletedToday(quests) {
  const q = quests?.find(x => x.id === 'daily-login');
  if (!q?.completedAt) return false;
  return toDayKeyLocal(new Date(q.completedAt)) === toDayKeyLocal(new Date());
}

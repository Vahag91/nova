// src/notifications/dailyRewardNotifications.js
import notifee, {
  TriggerType,
  AndroidImportance,
  AlarmType,
  AuthorizationStatus,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ANDROID_CHANNEL_ID = 'daily-reward';

// bump this if you change title/body format later
const TEMPLATE_VERSION = 1;

const SCHEDULE_CACHE_KEY = 'notifee_daily_reward_schedule_v2';
const ID_PREFIX = 'daily_reward_';

// ---- Local day helpers (LOCAL time) ----
function toDayKeyLocal(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`; // YYYY-MM-DD (LOCAL)
}

function toCompactDayKeyLocal(date = new Date()) {
  return toDayKeyLocal(date).replace(/-/g, ''); // YYYYMMDD
}

function addDaysLocal(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getLocalTriggerDate({ baseDate, hour, minute }) {
  const d = new Date(baseDate);
  d.setHours(hour, minute, 0, 0); // LOCAL time
  return d;
}

function makeIdForDate(date) {
  return `${ID_PREFIX}${toCompactDayKeyLocal(date)}`;
}

function isOurId(id) {
  return typeof id === 'string' && id.startsWith(ID_PREFIX);
}

async function ensureAndroidChannel() {
  try {
    await notifee.createChannel({
      id: ANDROID_CHANNEL_ID,
      name: 'Daily rewards',
      importance: AndroidImportance.HIGH,
    });
  } catch {}
}

async function readCache() {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function writeCache(obj) {
  try {
    await AsyncStorage.setItem(SCHEDULE_CACHE_KEY, JSON.stringify(obj));
  } catch {}
}

// Cancel all our scheduled notifications (only our prefix)
export async function cancelAllDailyRewardReminders() {
  try {
    const list = await notifee.getTriggerNotifications();
    const ours = list
      .map(x => x?.notification?.id)
      .filter(id => isOurId(id));

    await Promise.all(ours.map(id => notifee.cancelNotification(id)));
  } catch {}

  try {
    await AsyncStorage.removeItem(SCHEDULE_CACHE_KEY);
  } catch {}
}

// Cancel today only
export async function cancelTodayDailyRewardReminder() {
  const id = makeIdForDate(new Date());
  try {
    await notifee.cancelNotification(id);
  } catch {}
}

// Main scheduler (smart)
export async function scheduleDailyRewardReminders({
  daysAhead = 30,
  hour = 22,
  minute = 0,
  title,
  body,
  lang = 'unknown',
  timeZone = 'unknown',
  force = false,
  route = 'Rewards', // the screen you want to open on tap
} = {}) {
  // 1) Permission - check only, never prompt. The priming modal owns the
  //    request so the one system prompt Android allows is spent deliberately.
  //    Scheduling while denied would queue triggers that can never display.
  const settings = await notifee.getNotificationSettings();
  if (settings?.authorizationStatus !== AuthorizationStatus.AUTHORIZED) {
    await cancelAllDailyRewardReminders();
    await AsyncStorage.removeItem(SCHEDULE_CACHE_KEY);
    return { scheduled: false, reason: 'permission_denied' };
  }

  // 2) Channel
  await ensureAndroidChannel();

  const todayKey = toDayKeyLocal();
  const cache = await readCache();

  const cacheMatches =
    cache?.dayKey === todayKey &&
    cache?.hour === hour &&
    cache?.minute === minute &&
    cache?.daysAhead === daysAhead &&
    cache?.lang === lang &&
    cache?.timeZone === timeZone &&
    cache?.templateVersion === TEMPLATE_VERSION;

  const needsFullReschedule = force || !cacheMatches;

  // If language/timezone/template changed => safest is clear + re-create
  if (needsFullReschedule) {
    await cancelAllDailyRewardReminders();
  }

  // 3) Get what exists now (after optional clear)
  let existingIds = new Set();
  try {
    const list = await notifee.getTriggerNotifications();
    for (const x of list) {
      const id = x?.notification?.id;
      if (isOurId(id)) existingIds.add(id);
    }
  } catch {}

  // 4) Schedule missing ones
  const now = new Date();
  for (let i = 0; i < daysAhead; i++) {
    const dayDate = addDaysLocal(now, i);
    const triggerDate = getLocalTriggerDate({ baseDate: dayDate, hour, minute });

    // if time already passed today, skip it
    if (triggerDate.getTime() <= Date.now()) continue;

    const id = makeIdForDate(triggerDate);
    if (existingIds.has(id)) continue;

    await notifee.createTriggerNotification(
      {
        id,
        title,
        body,
        data: {
          type: 'daily_reward',
          route, // used by Step 3 nav handler
        },
        android: {
          channelId: ANDROID_CHANNEL_ID,
          pressAction: { id: 'default' },
        },
        ios: {
          sound: 'default',
          foregroundPresentationOptions: {
            badge: true,
            sound: true,
            banner: true,
            list: true,
          },
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: triggerDate.getTime(),
        // Without this the trigger runs on WorkManager, which Doze defers -
        // exactly what happens at 22:00 on an idle phone. SET_AND_ALLOW_WHILE_IDLE
        // fires through Doze and, unlike the EXACT variants, needs no
        // SCHEDULE_EXACT_ALARM permission (Play restricts that to alarm/clock apps).
        alarmManager: { type: AlarmType.SET_AND_ALLOW_WHILE_IDLE },
      }
    );
  }

  // 5) Save cache
  await writeCache({
    dayKey: todayKey,
    hour,
    minute,
    daysAhead,
    lang,
    timeZone,
    templateVersion: TEMPLATE_VERSION,
  });

  return { scheduled: true };
}

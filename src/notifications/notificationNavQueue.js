import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'pending_notification_nav_v1';

// ignore very old pending taps (prevents weird “navigate later” cases)
const MAX_AGE_MS = 60 * 1000; // 60s (you can change)

export async function setPendingNotificationNav(payload) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(payload));
  } catch {}
}

export async function consumePendingNotificationNav() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;

    await AsyncStorage.removeItem(KEY);

    const parsed = JSON.parse(raw);

    // ✅ stale guard
    if (!parsed?.route) return null;
    if (typeof parsed?.ts === 'number' && Date.now() - parsed.ts > MAX_AGE_MS) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
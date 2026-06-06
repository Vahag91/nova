import { Alert } from 'react-native';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';

export function promptOpenSettings(title, message) {
  Alert.alert(
    title,
    message,
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => openSettings().catch(() => {}) },
    ],
    { cancelable: true },
  );
}

export async function ensureMicAndSpeech() {
  try {
    let st = await check(PERMISSIONS.ANDROID.RECORD_AUDIO);
    if (st === RESULTS.DENIED || st === RESULTS.NOT_DETERMINED) {
      st = await request(PERMISSIONS.ANDROID.RECORD_AUDIO);
    }
    if (st === RESULTS.BLOCKED) return { ok: false, blocked: true };
    return { ok: st === RESULTS.GRANTED };
  } catch {
    return { ok: false };
  }
}

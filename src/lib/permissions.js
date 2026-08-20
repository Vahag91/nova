import { Alert } from 'react-native';
import { check, request, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';
import i18n from '../i18n';

export function promptOpenSettings(title, message) {
  Alert.alert(
    title,
    message,
    [
      { text: i18n.t('common.notNow'), style: 'cancel' },
      {
        text: i18n.t('common.openSettings'),
        onPress: () => openSettings().catch(() => {}),
      },
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

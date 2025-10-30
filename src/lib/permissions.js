// src/lib/permissions.ts
import { Platform, Alert } from 'react-native';
import { check, request, requestMultiple, PERMISSIONS, RESULTS, openSettings } from 'react-native-permissions';

const isAndroid13Plus = Platform.OS === 'android' && Number(Platform.Version) >= 33;

export function promptOpenSettings(title, message) {
  Alert.alert(title, message, [
    { text: 'Not now', style: 'cancel' },
    { text: 'Open Settings', onPress: () => openSettings().catch(() => {}) },
  ], { cancelable: true });
}

export async function ensurePhotoLibraryAccess({ write = false } = {}) {
  try {
    if (Platform.OS === 'ios') {
      let read = await check(PERMISSIONS.IOS.PHOTO_LIBRARY);
      if (read === RESULTS.DENIED || read === RESULTS.NOT_DETERMINED) {
        read = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
      }
      if (read === RESULTS.BLOCKED) return { ok: false, blocked: true };

      const readOk = read === RESULTS.GRANTED || read === RESULTS.LIMITED;
      if (!readOk) return { ok: false };

      if (write) {
        let w = await check(PERMISSIONS.IOS.PHOTO_LIBRARY_ADD_ONLY);
        if (w === RESULTS.DENIED || w === RESULTS.NOT_DETERMINED) {
          w = await request(PERMISSIONS.IOS.PHOTO_LIBRARY_ADD_ONLY);
        }
        if (w === RESULTS.BLOCKED) return { ok: false, blocked: true };
        if (w !== RESULTS.GRANTED) return { ok: false };
      }
      return { ok: true };
    } else {
      const perm = isAndroid13Plus ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE;
      let st = await check(perm);
      if (st === RESULTS.DENIED || st === RESULTS.NOT_DETERMINED) st = await request(perm);
      if (st === RESULTS.BLOCKED) return { ok: false, blocked: true };
      return { ok: st === RESULTS.GRANTED };
    }
  } catch {
    return { ok: false };
  }
}

export async function ensureMicAndSpeech() {
  try {
    if (Platform.OS === 'ios') {
      let mic = await check(PERMISSIONS.IOS.MICROPHONE);
      let speech = await check(PERMISSIONS.IOS.SPEECH_RECOGNITION);
      try { if (__DEV__) console.log('[Perm] ios pre-check', { mic, speech }); } catch {}
      if (mic === RESULTS.BLOCKED || speech === RESULTS.BLOCKED) return { ok: false, blocked: true };

      const toReq = [];
      if (mic !== RESULTS.GRANTED) toReq.push(PERMISSIONS.IOS.MICROPHONE);
      if (speech !== RESULTS.GRANTED) toReq.push(PERMISSIONS.IOS.SPEECH_RECOGNITION);
      if (toReq.length) {
        const res = await requestMultiple(toReq);
        mic = res[PERMISSIONS.IOS.MICROPHONE] || mic;
        speech = res[PERMISSIONS.IOS.SPEECH_RECOGNITION] || speech;
        try { if (__DEV__) console.log('[Perm] ios requested', res); } catch {}
      }
      const ok = mic === RESULTS.GRANTED && speech === RESULTS.GRANTED;
      try { if (__DEV__) console.log('[Perm] ios final', { mic, speech, ok }); } catch {}
      return { ok, blocked: !ok && (mic === RESULTS.BLOCKED || speech === RESULTS.BLOCKED) };
    } else {
      let st = await check(PERMISSIONS.ANDROID.RECORD_AUDIO);
      try { if (__DEV__) console.log('[Perm] android pre-check', st); } catch {}
      if (st === RESULTS.DENIED || st === RESULTS.NOT_DETERMINED) st = await request(PERMISSIONS.ANDROID.RECORD_AUDIO);
      try { if (__DEV__) console.log('[Perm] android requested', st); } catch {}
      if (st === RESULTS.BLOCKED) return { ok: false, blocked: true };
      return { ok: st === RESULTS.GRANTED };
    }
  } catch {
    try { if (__DEV__) console.log('[Perm] ensureMicAndSpeech error'); } catch {}
    return { ok: false };
  }
}

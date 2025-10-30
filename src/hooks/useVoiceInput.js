// app/src/hooks/useVoiceInput.js (using @ascendtis/react-native-voice-to-text)
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import {
  addEventListener,
  startListening,
  stopListening,
  setRecognitionLanguage,
} from '@ascendtis/react-native-voice-to-text';

export function useVoiceInput({
  locale,
  onPartialText,
  onFinalText,
  onErrorText,
} = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [volume, setVolume] = useState(0);


  const partialCbRef = useRef(onPartialText);
  const finalCbRef = useRef(onFinalText);
  const errCbRef = useRef(onErrorText);

  useEffect(() => { partialCbRef.current = onPartialText; }, [onPartialText]);
  useEffect(() => { finalCbRef.current = onFinalText; }, [onFinalText]);
  useEffect(() => { errCbRef.current = onErrorText; }, [onErrorText]);

  useEffect(() => {
    // Bind new library events
    const subs = [];
    subs.push(addEventListener('onSpeechStart', () => setIsRecording(true)));
    subs.push(addEventListener('onSpeechEnd', () => setIsRecording(false)));
    subs.push(addEventListener('onSpeechResults', (e) => {
      const val = e?.value;
      const text = Array.isArray(val) ? (val[0] || '') : (typeof val === 'string' ? val : '');
      if (text) finalCbRef.current?.(text);
    }));
    subs.push(addEventListener('onSpeechPartialResults', (e) => {
      const val = e?.value;
      const text = Array.isArray(val) ? (val[0] || '') : (typeof val === 'string' ? val : '');
      partialCbRef.current?.(text || '');
    }));
    subs.push(addEventListener('onSpeechError', (e) => {
      const msg = e?.message || e?.error || 'Speech error';
      errCbRef.current?.(typeof msg === 'string' ? msg : 'Speech error');
      setIsRecording(false);
    }));

    // Android mic permission
    if (Platform.OS === 'android') {
      (async () => {
        try {
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            {
              title: 'Microphone Permission',
              message: 'This app needs access to your microphone to recognize speech',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );
        } catch {}
      })();
    }

    return () => {
      // Unsubscribe listeners
      subs.forEach(s => s && typeof s.remove === 'function' && s.remove());
      setIsRecording(false);
      setVolume(0);
      try { const maybe = stopListening(); if (maybe && typeof maybe.then === 'function') maybe.catch(() => {}); } catch {}
    };
  }, []);

  const start = useCallback(async () => {
    try {
      if (typeof setRecognitionLanguage === 'function' && locale) {
        try { await setRecognitionLanguage(locale); } catch {}
      }
      await startListening();
      setIsRecording(true);
      setVolume(0);
      return true;
    } catch (error) {
      errCbRef.current?.(error?.message || String(error));
      return false;
    }
  }, [locale]);

  const stop = useCallback(async () => {
    try { await stopListening(); } catch {}
    setIsRecording(false);
    setVolume(0);
  }, []);

  const cancel = useCallback(async () => {
    try { await stopListening(); } catch {}
    setIsRecording(false);
    setVolume(0);
  }, []);

  return { isRecording, volume, start, stop, cancel };
}

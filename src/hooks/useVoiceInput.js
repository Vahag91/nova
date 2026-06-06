// app/src/hooks/useVoiceInput.js (using @ascendtis/react-native-voice-to-text)
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addEventListener,
  destroy,
  isRecognitionAvailable,
  setRecognitionLanguage,
  startListening,
  stopListening,
} from '@ascendtis/react-native-voice-to-text';

const START_TIMEOUT_MS = 4000;

function normalizeVolume(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, (value + 2) / 12));
}

export function useVoiceInput({
  locale,
  onPartialText,
  onFinalText,
  onErrorText,
} = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [volume, setVolume] = useState(0);

  const isRecordingRef = useRef(false);
  const partialCbRef = useRef(onPartialText);
  const finalCbRef = useRef(onFinalText);
  const errCbRef = useRef(onErrorText);
  const pendingStartRef = useRef(null);
  const startInFlightRef = useRef(false);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    partialCbRef.current = onPartialText;
  }, [onPartialText]);

  useEffect(() => {
    finalCbRef.current = onFinalText;
  }, [onFinalText]);

  useEffect(() => {
    errCbRef.current = onErrorText;
  }, [onErrorText]);

  const settlePendingStart = useCallback(started => {
    const pending = pendingStartRef.current;
    if (!pending) {
      return false;
    }

    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    pendingStartRef.current = null;
    startInFlightRef.current = false;
    pending.resolve(!!started);
    return true;
  }, []);

  const failStartAttempt = useCallback((message, shouldNotify = true) => {
    settlePendingStart(false);
    startInFlightRef.current = false;
    setIsRecording(false);
    setVolume(0);

    if (shouldNotify && message) {
      errCbRef.current?.(message);
    }
  }, [settlePendingStart]);

  useEffect(() => {
    const handleSpeechStarted = () => {
      setIsRecording(true);
      settlePendingStart(true);
    };

    const handleSpeechEnded = () => {
      setIsRecording(false);
      setVolume(0);
      settlePendingStart(false);
    };

    const handleSpeechResults = e => {
      const val = e?.value;
      const text = Array.isArray(val)
        ? (val[0] || '')
        : (typeof val === 'string' ? val : '');

      if (text) {
        settlePendingStart(true);
        finalCbRef.current?.(text);
      }
    };

    const handleSpeechPartialResults = e => {
      const val = e?.value;
      const text = Array.isArray(val)
        ? (val[0] || '')
        : (typeof val === 'string' ? val : '');

      if (text) {
        settlePendingStart(true);
      }
      partialCbRef.current?.(text || '');
    };

    const handleSpeechError = e => {
      const message = e?.message || e?.error || 'Speech error';
      failStartAttempt(typeof message === 'string' ? message : 'Speech error');
    };

    const handleSpeechVolumeChanged = e => {
      setVolume(normalizeVolume(e?.value));
    };

    const subs = [
      addEventListener('onSpeechStart', handleSpeechStarted),
      addEventListener('onSpeechBegin', handleSpeechStarted),
      addEventListener('onSpeechEnd', handleSpeechEnded),
      addEventListener('onSpeechResults', handleSpeechResults),
      addEventListener('onSpeechPartialResults', handleSpeechPartialResults),
      addEventListener('onSpeechError', handleSpeechError),
      addEventListener('onSpeechVolumeChanged', handleSpeechVolumeChanged),
    ];

    return () => {
      subs.forEach(sub => {
        if (sub && typeof sub.remove === 'function') {
          sub.remove();
        }
      });

      settlePendingStart(false);
      setIsRecording(false);
      setVolume(0);

      try {
        const maybe = stopListening();
        if (maybe && typeof maybe.then === 'function') {
          maybe.catch(() => {});
        }
      } catch {}

      try {
        const maybeDestroy = destroy?.();
        if (maybeDestroy && typeof maybeDestroy.then === 'function') {
          maybeDestroy.catch(() => {});
        }
      } catch {}
    };
  }, [failStartAttempt, settlePendingStart]);

  const activate = useCallback(() => {}, []);

  const start = useCallback(async () => {
    if (startInFlightRef.current || isRecordingRef.current) {
      return false;
    }

    try {
      if (typeof isRecognitionAvailable === 'function') {
        try {
          const available = await isRecognitionAvailable();
          if (available === false) {
            failStartAttempt('Speech recognition is not available on this device.');
            return false;
          }
        } catch {}
      }

      if (typeof setRecognitionLanguage === 'function' && locale) {
        try {
          await setRecognitionLanguage(locale);
        } catch {}
      }

      const startResult = new Promise(resolve => {
        const timeoutId = setTimeout(() => {
          pendingStartRef.current = null;
          startInFlightRef.current = false;
          setIsRecording(false);
          setVolume(0);
          errCbRef.current?.('Voice recognition did not start. Please try again.');
          try {
            const maybe = stopListening();
            if (maybe && typeof maybe.then === 'function') {
              maybe.catch(() => {});
            }
          } catch {}
          resolve(false);
        }, START_TIMEOUT_MS);

        pendingStartRef.current = { resolve, timeoutId };
      });

      startInFlightRef.current = true;
      await startListening();
      const started = await startResult;
      if (!started) {
        return false;
      }

      setVolume(0);
      return true;
    } catch (error) {
      failStartAttempt(error?.message || String(error));
      return false;
    }
  }, [failStartAttempt, locale]);

  const stop = useCallback(async () => {
    settlePendingStart(false);
    try {
      await stopListening();
    } catch {}
    setIsRecording(false);
    setVolume(0);
  }, [settlePendingStart]);

  const cancel = useCallback(async () => {
    settlePendingStart(false);
    try {
      await stopListening();
    } catch {}
    setIsRecording(false);
    setVolume(0);
  }, [settlePendingStart]);

  return { isRecording, volume, start, stop, cancel, activate };
}

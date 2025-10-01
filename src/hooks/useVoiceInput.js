// app/src/hooks/useVoiceInput.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import Voice from '@react-native-voice/voice';

/**
 * Manual-stop continuous dictation:
 * - start(): sets "wantRef" = true and starts recognition
 * - OS may auto-end; we auto-restart while wantRef is true
 * - We buffer all finalized segments
 * - stop(): sets wantRef = false, stops engine, then emits one final transcript
 */
export function useVoiceInput({
  locale,              // e.g. 'en-US' | 'ar-SA'; falsy -> device default
  onPartialText,       // (text: string) => void   -- fires on interim updates
  onFinalText,         // (text: string) => void   -- fired when engine yields final text
  onErrorText,         // (msg: string) => void
} = {}) {
  const [isRecording, setIsRecording] = useState(false);

  const wantRef = useRef(false);          // user wants to keep recording
  const bufferRef = useRef('');           // finalized + concatenated text
  const restartingRef = useRef(false);    // throttle restarts
  const partialRef = useRef('');          // latest partial transcript
  const isRecordingRef = useRef(false);
  const isStoppingRef = useRef(false);    // suppress errors during manual stop/cancel
  const partialCbRef = useRef(onPartialText);
  const finalCbRef = useRef(onFinalText);
  const errCbRef = useRef(onErrorText);

  const log = (...args) => console.log('[voice-input]', ...args);

  useEffect(() => { partialCbRef.current = onPartialText; }, [onPartialText]);
  useEffect(() => { finalCbRef.current = onFinalText; }, [onFinalText]);
  useEffect(() => { errCbRef.current = onErrorText; }, [onErrorText]);

  const resetBuffers = () => {
    log('resetBuffers() called', { buffer: bufferRef.current, partial: partialRef.current });
    bufferRef.current = '';
    partialRef.current = '';
    partialCbRef.current?.('');
  };

  const appendFinal = (t) => {
    const s = (t || '').trim();
    log('appendFinal()', { incoming: t, trimmed: s, beforeBuffer: bufferRef.current });
    if (!s) return;
    bufferRef.current = bufferRef.current ? bufferRef.current + ' ' + s : s;
    log('appendFinal() updated buffer', bufferRef.current);
  };

  const emitFinal = (overrideText) => {
    const candidate = typeof overrideText === 'string'
      ? overrideText
      : (bufferRef.current || partialRef.current);
    const finalText = (candidate || '').trim();
    log('emitFinal()', { overrideText, candidate, finalText });
    resetBuffers();
    if (finalText) finalCbRef.current?.(finalText);
    else log('emitFinal() nothing to emit');
  };

  const askAndroidPerm = async () => {
    if (Platform.OS !== 'android') return true;
    log('askAndroidPerm() requesting RECORD_AUDIO');
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );
    log('askAndroidPerm() result', granted);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const safeStart = useCallback(async () => {
    try {
      log('safeStart() Voice.start invoked', { locale });
      await Voice.start(locale || undefined); // supported signature
      setIsRecording(true);
      isRecordingRef.current = true;
      resetBuffers();
      log('safeStart() success');
    } catch (e) {
      const msg = e?.message || String(e);
      log('safeStart() error', msg, e);
      if (/already started/i.test(msg)) {
        log('safeStart() detected existing session, marking recording active');
        setIsRecording(true);
        isRecordingRef.current = true;
        return;
      }
      errCbRef.current?.(msg);
    }
  }, [locale]);

  const scheduleRestart = () => {
    if (!wantRef.current) {
      log('scheduleRestart() skipped because wantRef is false');
      return;
    }
    if (restartingRef.current) {
      log('scheduleRestart() already scheduled, skipping');
      return;
    }
    if (isRecording) {
      log('scheduleRestart() skipped because engine already recording');
      return;
    }
    log('scheduleRestart() scheduling restart');
    restartingRef.current = true;
    setTimeout(async () => {
      log('scheduleRestart() timeout fired', { want: wantRef.current, isRecording });
      restartingRef.current = false;
      if (wantRef.current && !isRecording) {
        await safeStart();
      }
    }, 150);
  };

  const start = useCallback(async () => {
    log('start() requested');
    if (!(await askAndroidPerm())) {
      errCbRef.current?.('Microphone permission denied');
      log('start() permission denied');
      return;
    }
    resetBuffers();
    wantRef.current = true;
    log('start() calling safeStart');
    await safeStart();
  }, [safeStart]);

  const stop = useCallback(async () => {
    log('stop() requested');
    wantRef.current = false;
    isStoppingRef.current = true;
    try { await Voice.stop(); log('stop() Voice.stop success'); } catch (err) { log('stop() Voice.stop error', err); }
    setIsRecording(false);
    isRecordingRef.current = false;
    // if OS doesn't deliver a final result after stop, emit whatever we have
    setTimeout(() => { isStoppingRef.current = false; emitFinal(); }, 200);
  }, []);

  const cancel = useCallback(async () => {
    log('cancel() requested');
    wantRef.current = false;
    isStoppingRef.current = true;
    try { await Voice.cancel(); log('cancel() Voice.cancel success'); } catch (err) { log('cancel() Voice.cancel error', err); }
    setIsRecording(false);
    isRecordingRef.current = false;
    resetBuffers();
    setTimeout(() => { isStoppingRef.current = false; }, 150);
  }, []);

  // Bind events ONCE
  useEffect(() => {
    log('hook useEffect binding Voice listeners');
    Voice.onSpeechStart = () => {
      log('Voice.onSpeechStart fired');
      setIsRecording(true);
      isRecordingRef.current = true;
      resetBuffers();
    };
    Voice.onSpeechEnd = () => {
      log('Voice.onSpeechEnd fired');
      setIsRecording(false);
      isRecordingRef.current = false;
      // iOS frequently ends on short silence; keep going while user wants it
      if (wantRef.current) scheduleRestart();
    };
    Voice.onSpeechPartialResults = (e) => {
      const t = (e?.value && e.value[0]) || '';
      log('Voice.onSpeechPartialResults', t, e?.value);
      partialRef.current = t;
      partialCbRef.current?.(t);
    };
    Voice.onSpeechResults = (e) => {
      const t = (e?.value && e.value[0]) || '';
      log('Voice.onSpeechResults', t, e?.value);
      appendFinal(t);
      const aggregated = bufferRef.current;
      emitFinal(aggregated);
      setIsRecording(false);
      isRecordingRef.current = false;
      if (wantRef.current) scheduleRestart();
    };
    Voice.onSpeechError = (e) => {
      const msg = e?.error?.message || 'Speech error';
      log('Voice.onSpeechError', msg, e);
      const already = /already started/i.test(msg);
      const noMatch = /no match/i.test(msg);
      if (isStoppingRef.current) {
        log('onSpeechError: suppressing because manual stop/cancel in progress');
        return;
      }
      if (already) {
        log('onSpeechError: already started -> mark recording and return');
        setIsRecording(true);
        isRecordingRef.current = true;
        return;
      }
      // Swallow harmless no-match and attempt a single restart if user still wants it
      if (noMatch) {
        if (wantRef.current && !isRecordingRef.current) scheduleRestart();
        return;
      }
      setIsRecording(false);
      isRecordingRef.current = false;
      if (wantRef.current) {
        scheduleRestart();
      } else {
        emitFinal();
        errCbRef.current?.(msg);
      }
    };

    return () => {
      log('cleanup removing Voice listeners');
      try { Voice.stop(); } catch {}
      try { Voice.destroy(); } catch {}
      Voice.removeAllListeners();
    };
  }, []);

  log('hook ready', { locale });
  return { isRecording, partial: partialRef.current, start, stop, cancel };
}

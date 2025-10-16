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
  
  // Debug refs
  const debugStartTime = useRef(0);
  const debugEventCount = useRef(0);

  useEffect(() => { partialCbRef.current = onPartialText; }, [onPartialText]);
  useEffect(() => { finalCbRef.current = onFinalText; }, [onFinalText]);
  useEffect(() => { errCbRef.current = onErrorText; }, [onErrorText]);

  const resetBuffers = () => {
    bufferRef.current = '';
    partialRef.current = '';
    partialCbRef.current?.('');
  };

  const appendFinal = (t) => {
    const s = (t || '').trim();
    if (!s) return;
    const next = bufferRef.current ? bufferRef.current + ' ' + s : s;
    bufferRef.current = next.length > 8000 ? next.slice(-8000) : next;
  };

  const emitFinal = (overrideText) => {
    const candidate = typeof overrideText === 'string'
      ? overrideText
      : (bufferRef.current || partialRef.current);
    const finalText = (candidate || '').trim();
    resetBuffers();
    if (finalText) finalCbRef.current?.(finalText);
  };

  const safeStart = useCallback(async () => {
    try {
      await Voice.start(locale || undefined);
      setIsRecording(true);
      isRecordingRef.current = true;
      resetBuffers();
      return true;
    } catch (e) {
      const msg = e?.message || String(e);
      if (/already started/i.test(msg)) {
        setIsRecording(true);
        isRecordingRef.current = true;
        return true;
      }
      errCbRef.current?.(msg);
      return false;
    }
  }, [locale]);

  const scheduleRestart = () => {
    if (!wantRef.current || restartingRef.current || isRecordingRef.current) {
      return;
    }
    
    restartingRef.current = true;
    setTimeout(async () => {
      restartingRef.current = false;
      if (wantRef.current && !isRecordingRef.current) {
        await safeStart();
      }
    }, 150);
  };

  const start = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          errCbRef.current?.('Microphone permission denied');
          return false;
        }
      } catch {
        errCbRef.current?.('Microphone permission denied');
        return false;
      }
    }

    resetBuffers();
    wantRef.current = true;
    return await safeStart();
  }, [safeStart]);

  const stop = useCallback(async () => {
    wantRef.current = false;
    isStoppingRef.current = true;
    
    try { 
      await Voice.stop(); 
    } catch (err) {
      // Ignore stop errors
    }
    
    setIsRecording(false);
    isRecordingRef.current = false;
    
    setTimeout(() => { 
      isStoppingRef.current = false; 
      emitFinal(); 
    }, 200);
  }, []);

  const cancel = useCallback(async () => {
    wantRef.current = false;
    isStoppingRef.current = true;
    
    try { 
      await Voice.cancel(); 
    } catch (err) {
      // Ignore cancel errors
    }
    
    setIsRecording(false);
    isRecordingRef.current = false;
    resetBuffers();
    
    setTimeout(() => { 
      isStoppingRef.current = false; 
    }, 150);
  }, []);

  // Bind events ONCE
  useEffect(() => {
    Voice.onSpeechStart = () => {
      debugEventCount.current++;
      setIsRecording(true);
      isRecordingRef.current = true;
      resetBuffers();
    };
    
    Voice.onSpeechEnd = () => {
      debugEventCount.current++;
      setIsRecording(false);
      isRecordingRef.current = false;
      if (wantRef.current) scheduleRestart();
    };
    
    Voice.onSpeechPartialResults = (e) => {
      debugEventCount.current++;
      const t = (e?.value && e.value[0]) || '';
      partialRef.current = t;
      partialCbRef.current?.(t);
    };
    
    Voice.onSpeechResults = (e) => {
      debugEventCount.current++;
      const t = (e?.value && e.value[0]) || '';
      appendFinal(t);
      const aggregated = bufferRef.current;
      emitFinal(aggregated);
      setIsRecording(false);
      isRecordingRef.current = false;
      if (wantRef.current) scheduleRestart();
    };
    
    Voice.onSpeechError = (e) => {
      debugEventCount.current++;
      const msg = e?.error?.message || 'Speech error';
      const already = /already started/i.test(msg);
      const noMatch = /no match/i.test(msg);
      
      if (isStoppingRef.current) {
        return;
      }
      
      if (already) {
        setIsRecording(true);
        isRecordingRef.current = true;
        return;
      }
      
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
      try { Voice.stop(); } catch {}
      try { Voice.removeAllListeners?.(); } catch {}
      try { Voice.destroy?.(); } catch {}
    };
  }, []);

  return { isRecording, partial: partialRef.current, start, stop, cancel };
}

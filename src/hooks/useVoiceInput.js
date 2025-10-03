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
    console.log('🎤 useVoiceInput: Resetting buffers', { 
      bufferLength: bufferRef.current.length, 
      partialLength: partialRef.current.length,
      timestamp: Date.now()
    });
    bufferRef.current = '';
    partialRef.current = '';
    partialCbRef.current?.('');
  };

  const appendFinal = (t) => {
    const s = (t || '').trim();
    if (!s) return;
    console.log('🎤 useVoiceInput: Appending final text', { 
      newText: s, 
      bufferBefore: bufferRef.current,
      bufferAfter: bufferRef.current ? bufferRef.current + ' ' + s : s,
      timestamp: Date.now()
    });
    bufferRef.current = bufferRef.current ? bufferRef.current + ' ' + s : s;
  };

  const emitFinal = (overrideText) => {
    const candidate = typeof overrideText === 'string'
      ? overrideText
      : (bufferRef.current || partialRef.current);
    const finalText = (candidate || '').trim();
    console.log('🎤 useVoiceInput: Emitting final text', { 
      finalText, 
      overrideText, 
      bufferLength: bufferRef.current.length,
      partialLength: partialRef.current.length,
      timestamp: Date.now()
    });
    resetBuffers();
    if (finalText) finalCbRef.current?.(finalText);
  };

  const askAndroidPerm = async () => {
    if (Platform.OS !== 'android') return true;
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  };

  const safeStart = useCallback(async () => {
    const startTime = performance.now();
    console.log('🎤 useVoiceInput: Starting voice recognition', { locale, timestamp: Date.now() });
    
    try {
      await Voice.start(locale || undefined);
      const duration = performance.now() - startTime;
      console.log('🎤 useVoiceInput: Voice.start() completed', { duration: duration.toFixed(2) + 'ms' });
      
      setIsRecording(true);
      isRecordingRef.current = true;
      resetBuffers();
    } catch (e) {
      const duration = performance.now() - startTime;
      const msg = e?.message || String(e);
      console.log('🎤 useVoiceInput: Voice.start() failed', { 
        error: msg, 
        duration: duration.toFixed(2) + 'ms',
        timestamp: Date.now()
      });
      
      if (/already started/i.test(msg)) {
        console.log('🎤 useVoiceInput: Voice already started, setting recording state');
        setIsRecording(true);
        isRecordingRef.current = true;
        return;
      }
      errCbRef.current?.(msg);
    }
  }, [locale]);

  const scheduleRestart = () => {
    console.log('🎤 useVoiceInput: scheduleRestart called', {
      wantRecording: wantRef.current,
      isRestarting: restartingRef.current,
      isRecording,
      timestamp: Date.now()
    });
    
    if (!wantRef.current || restartingRef.current || isRecording) {
      console.log('🎤 useVoiceInput: Restart skipped', {
        reason: !wantRef.current ? 'not wanted' : restartingRef.current ? 'already restarting' : 'still recording'
      });
      return;
    }
    
    restartingRef.current = true;
    console.log('🎤 useVoiceInput: Scheduling restart in 150ms');
    setTimeout(async () => {
      restartingRef.current = false;
      if (wantRef.current && !isRecording) {
        console.log('🎤 useVoiceInput: Executing scheduled restart');
        await safeStart();
      } else {
        console.log('🎤 useVoiceInput: Scheduled restart cancelled', {
          wantRecording: wantRef.current,
          isRecording
        });
      }
    }, 150);
  };

  const start = useCallback(async () => {
    const startTime = performance.now();
    console.log('🎤 useVoiceInput: start() called', { timestamp: Date.now() });
    
    if (!(await askAndroidPerm())) {
      console.log('🎤 useVoiceInput: Android permission denied');
      errCbRef.current?.('Microphone permission denied');
      return;
    }
    
    resetBuffers();
    wantRef.current = true;
    await safeStart();
    
    const duration = performance.now() - startTime;
    console.log('🎤 useVoiceInput: start() completed', { duration: duration.toFixed(2) + 'ms' });
  }, [safeStart]);

  const stop = useCallback(async () => {
    const startTime = performance.now();
    console.log('🎤 useVoiceInput: stop() called', { timestamp: Date.now() });
    
    wantRef.current = false;
    isStoppingRef.current = true;
    
    try { 
      await Voice.stop(); 
      const duration = performance.now() - startTime;
      console.log('🎤 useVoiceInput: Voice.stop() completed', { duration: duration.toFixed(2) + 'ms' });
    } catch (err) {
      console.log('🎤 useVoiceInput: Voice.stop() failed', { error: err.message });
    }
    
    setIsRecording(false);
    isRecordingRef.current = false;
    
    console.log('🎤 useVoiceInput: Scheduling final emit in 200ms');
    setTimeout(() => { 
      isStoppingRef.current = false; 
      emitFinal(); 
    }, 200);
  }, []);

  const cancel = useCallback(async () => {
    const startTime = performance.now();
    console.log('🎤 useVoiceInput: cancel() called', { timestamp: Date.now() });
    
    wantRef.current = false;
    isStoppingRef.current = true;
    
    try { 
      await Voice.cancel(); 
      const duration = performance.now() - startTime;
      console.log('🎤 useVoiceInput: Voice.cancel() completed', { duration: duration.toFixed(2) + 'ms' });
    } catch (err) {
      console.log('🎤 useVoiceInput: Voice.cancel() failed', { error: err.message });
    }
    
    setIsRecording(false);
    isRecordingRef.current = false;
    resetBuffers();
    
    console.log('🎤 useVoiceInput: Scheduling cleanup in 150ms');
    setTimeout(() => { 
      isStoppingRef.current = false; 
    }, 150);
  }, []);

  // Bind events ONCE
  useEffect(() => {
    Voice.onSpeechStart = () => {
      debugEventCount.current++;
      console.log('🎤 useVoiceInput: onSpeechStart event', { 
        eventCount: debugEventCount.current,
        timestamp: Date.now() 
      });
      setIsRecording(true);
      isRecordingRef.current = true;
      resetBuffers();
    };
    
    Voice.onSpeechEnd = () => {
      debugEventCount.current++;
      console.log('🎤 useVoiceInput: onSpeechEnd event', { 
        eventCount: debugEventCount.current,
        wantRecording: wantRef.current,
        timestamp: Date.now() 
      });
      setIsRecording(false);
      isRecordingRef.current = false;
      if (wantRef.current) scheduleRestart();
    };
    
    Voice.onSpeechPartialResults = (e) => {
      debugEventCount.current++;
      const t = (e?.value && e.value[0]) || '';
      console.log('🎤 useVoiceInput: onSpeechPartialResults event', { 
        eventCount: debugEventCount.current,
        partialText: t,
        textLength: t.length,
        timestamp: Date.now() 
      });
      partialRef.current = t;
      partialCbRef.current?.(t);
    };
    
    Voice.onSpeechResults = (e) => {
      debugEventCount.current++;
      const t = (e?.value && e.value[0]) || '';
      console.log('🎤 useVoiceInput: onSpeechResults event', { 
        eventCount: debugEventCount.current,
        finalText: t,
        textLength: t.length,
        wantRecording: wantRef.current,
        timestamp: Date.now() 
      });
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
      
      console.log('🎤 useVoiceInput: onSpeechError event', { 
        eventCount: debugEventCount.current,
        error: msg,
        isStopping: isStoppingRef.current,
        alreadyStarted: already,
        noMatch: noMatch,
        wantRecording: wantRef.current,
        timestamp: Date.now() 
      });
      
      if (isStoppingRef.current) {
        console.log('🎤 useVoiceInput: Ignoring error during stop');
        return;
      }
      
      if (already) {
        console.log('🎤 useVoiceInput: Voice already started, setting recording state');
        setIsRecording(true);
        isRecordingRef.current = true;
        return;
      }
      
      if (noMatch) {
        console.log('🎤 useVoiceInput: No match error, scheduling restart if needed');
        if (wantRef.current && !isRecordingRef.current) scheduleRestart();
        return;
      }
      
      console.log('🎤 useVoiceInput: Handling speech error');
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
      try { Voice.destroy(); } catch {}
      Voice.removeAllListeners();
    };
  }, []);

  return { isRecording, partial: partialRef.current, start, stop, cancel };
}
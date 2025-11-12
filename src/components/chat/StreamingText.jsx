// StreamingText.js - Throttled character-by-character reveal for smooth streaming
import React, { useEffect, useMemo, useState, memo, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import MarkdownContent from './MarkdownContent';
import { subscribeStream, getStream } from '../../lib/streamingBuffer';

const CHARS_PER_FRAME = 10;  // Reveal 10 characters per frame (faster)
const FRAME_DELAY = 20;      // 20ms between frames = 50 FPS (smoother)
const MARKDOWN_UPDATE_THRESHOLD = 30;  // Only update MarkdownContent when content changes by 30+ chars
const MARKDOWN_UPDATE_INTERVAL = 100;  // Or every 100ms, whichever comes first

function StreamingText({ messageId, base = '', streaming = false, activityText }) {
  const [buffered, setBuffered] = useState('');      // What we've received from server
  const [displayed, setDisplayed] = useState('');    // What we're showing to user
  const [debouncedDisplayed, setDebouncedDisplayed] = useState('');  // Debounced version for MarkdownContent
  const displayTimerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const targetLengthRef = useRef(0);
  const lastMarkdownUpdateRef = useRef(0);
  const lastMarkdownLengthRef = useRef(0);
  const skeletonPulse = useRef(new Animated.Value(0.3)).current;
  


  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (displayTimerRef.current) {
        clearInterval(displayTimerRef.current);
        displayTimerRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []);

  // Subscribe to buffer - this receives content from server
  useEffect(() => {
    if (!streaming || !messageId) {
      setBuffered('');
      setDisplayed('');
      targetLengthRef.current = 0;
      if (displayTimerRef.current) {
        clearInterval(displayTimerRef.current);
        displayTimerRef.current = null;
      }
      return;
    }

    const initialContent = getStream(messageId);
    setBuffered(initialContent);
    targetLengthRef.current = initialContent.length;

    return subscribeStream(
      messageId,
      () => {
        const newContent = getStream(messageId);
        setBuffered(newContent);
        targetLengthRef.current = newContent.length;
      },
      { throttleMs: 50 }
    );
  }, [messageId, streaming]);

  // Gradually reveal buffered content character-by-character
  useEffect(() => {
    if (!streaming || !messageId) {
      if (displayTimerRef.current) {
        clearInterval(displayTimerRef.current);
        displayTimerRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      return;
    }

    // Start the reveal timer once
    displayTimerRef.current = setInterval(() => {
      const updateStart = performance.now();
      setDisplayed(prev => {
        const currentLength = prev.length;
        const targetLength = targetLengthRef.current;

        if (currentLength >= targetLength) {
          // Fully caught up, keep showing same content
          return prev;
        }

        // Reveal next batch of characters
        const nextLength = Math.min(currentLength + CHARS_PER_FRAME, targetLength);
        const bufferedNow = getStream(messageId) || '';
        const nextText = bufferedNow.substring(0, nextLength);
        return nextText;
      });
    }, FRAME_DELAY);
    return () => {
      if (displayTimerRef.current) {
        clearInterval(displayTimerRef.current);
        displayTimerRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [streaming, messageId]);

  // Debounce/throttle MarkdownContent updates during streaming
  useEffect(() => {
    if (!streaming || !messageId) {
      // When streaming stops, immediately sync debounced version
      const currentDisplayed = displayed;
      setDebouncedDisplayed(prev => {
        if (prev !== currentDisplayed) {
          return currentDisplayed;
        }
        return prev;
      });
      return;
    }

    const now = performance.now();
    const lengthDiff = Math.abs(displayed.length - lastMarkdownLengthRef.current);
    const timeSinceLastUpdate = now - lastMarkdownUpdateRef.current;
    
    // Update MarkdownContent if:
    // 1. Content changed significantly (30+ chars)
    // 2. Or enough time has passed (100ms)
    const shouldUpdate = lengthDiff >= MARKDOWN_UPDATE_THRESHOLD || timeSinceLastUpdate >= MARKDOWN_UPDATE_INTERVAL;

    if (shouldUpdate) {
      // Clear any pending debounce
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      
      lastMarkdownUpdateRef.current = now;
      lastMarkdownLengthRef.current = displayed.length;
      setDebouncedDisplayed(displayed);
    } else {
      // Schedule a debounced update
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      debounceTimerRef.current = setTimeout(() => {
        lastMarkdownUpdateRef.current = performance.now();
        lastMarkdownLengthRef.current = displayed.length;
        setDebouncedDisplayed(displayed);
      }, MARKDOWN_UPDATE_INTERVAL);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [displayed, streaming, messageId]);

  const fullText = useMemo(() => {
    return (base || '') + displayed;
  }, [base, displayed]);

  // Use debounced version for MarkdownContent during streaming
  const markdownText = useMemo(() => {
    if (streaming) {
      // During streaming: base is empty/partial, add displayed content
      return (base || '') + debouncedDisplayed;
    }
    // When streaming completes: base already contains the full final content
    // Don't add displayed to avoid duplication
    return base || '';
  }, [base, displayed, debouncedDisplayed, streaming]);

  // pure-image guard (memoized regex check for performance)
  const isPureImageMessage = useMemo(() => {
    const trimmed = fullText.trim();
    if (!trimmed) return false;
    const regex = /^!\[[^\]]*\]\([^)]+\)(\s*!\[[^\]]*\]\([^)]+\))*\s*$/;
    return regex.test(trimmed);
  }, [fullText]);
  if (isPureImageMessage) {
    return <MarkdownContent text={base || ''} isUser={false} animateOnMount={false} streaming={false} />;
  }

  // Before first token while streaming → show skeleton placeholder
  const hasFirstToken = fullText.trim().length > 0;

  useEffect(() => {
    if (streaming && !hasFirstToken) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonPulse, { toValue: 0.6, duration: 400, useNativeDriver: true }),
          Animated.timing(skeletonPulse, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [streaming, hasFirstToken, skeletonPulse]);

  if (streaming && !hasFirstToken) {
    return (
      <View style={styles.skeletonWrap}>
        {!!activityText && (
          <Animated.Text style={[styles.activityText, { opacity: skeletonPulse }]}>
            {activityText}
          </Animated.Text>
        )}
        {!activityText && (
          <>
            <Animated.View style={[styles.skelLine, { opacity: skeletonPulse, width: 240 }]} />
            <Animated.View style={[styles.skelLine, { opacity: skeletonPulse, width: 180 }]} />
            <Animated.View style={[styles.skelLine, { opacity: skeletonPulse, width: 220 }]} />
          </>
        )}
      </View>
    );
  }

  // Render with debounced MarkdownContent updates during streaming
  return <MarkdownContent text={markdownText} isUser={false} animateOnMount={!streaming} streaming={streaming} />;
}

export default memo(StreamingText);

const styles = StyleSheet.create({
  skeletonWrap: { gap: 8, paddingRight: 8, paddingTop: 2, minWidth: 120 },
  skelLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2a2a2a',
  },
  activityText: {
    color: '#a0a0a0',
    fontSize: 15,
    fontFamily: 'Lato-Regular',
  },
});

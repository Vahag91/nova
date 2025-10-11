// StreamingText.js - Throttled character-by-character reveal for smooth streaming
import React, { useEffect, useMemo, useState, memo, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import MarkdownContent from './MarkdownContent';
import { subscribeStream, getStream } from '../../lib/streamingBuffer';

const CHARS_PER_FRAME = 10;  // Reveal 10 characters per frame (faster)
const FRAME_DELAY = 20;      // 20ms between frames = 50 FPS (smoother)

function StreamingText({ messageId, base = '', streaming = false, activityText }) {
  const [buffered, setBuffered] = useState('');      // What we've received from server
  const [displayed, setDisplayed] = useState('');    // What we're showing to user
  const displayTimerRef = useRef(null);
  const targetLengthRef = useRef(0);
  const skeletonPulse = useRef(new Animated.Value(0.3)).current;


  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (displayTimerRef.current) {
        clearInterval(displayTimerRef.current);
        displayTimerRef.current = null;
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
      return;
    }

    // Start the reveal timer once
    displayTimerRef.current = setInterval(() => {
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
    };
  }, [streaming, messageId]);

  const fullText = useMemo(() => (base || '') + displayed, [base, displayed]);

  // pure-image guard (non-global regex)
  const isPureImageMessage = /^!\[[^\]]*\]\([^)]+\)(\s*!\[[^\]]*\]\([^)]+\))*\s*$/.test(fullText.trim());
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

  // Render with smooth character-by-character reveal
  return <MarkdownContent text={fullText} isUser={false} animateOnMount={!streaming} streaming={false} />;
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

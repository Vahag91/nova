import React, { useEffect, useState, memo, useRef, useCallback } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import MarkdownContent from './MarkdownContent';
import { subscribeStream, getStream } from '../../lib/streamingBuffer';
import { colors } from '../../styles/colors';

const CURSOR_CHAR = ' ▋';
// Markdown parsing/layout is much heavier than moving a native animation.
const TEXT_UPDATE_INTERVAL_MS = 50; 

function StreamingText({
  messageId,
  base = '',
  streaming = false,
  activityText,
  selectable = false,
  selectionResetToken,
}) {
  // The text currently visible on screen
  const [displayedText, setDisplayedText] = useState(base || '');
  const pulseAnim = useRef(new Animated.Value(0)).current;
  
  // Refs to hold state without causing re-renders
  const targetTextRef = useRef(base || '');
  const displayLengthRef = useRef((base || '').length);
  const loopRef = useRef(null);
  const cursorVisibleRef = useRef(true);
  const streamingRef = useRef(streaming);
  const messageIdRef = useRef(messageId);
  const lastFrameRef = useRef(Date.now());
  const cursorTimerRef = useRef(0);
  const accumulatedTimeRef = useRef(0);

  useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  useEffect(() => {
    messageIdRef.current = messageId;
  }, [messageId]);

  const stopLoop = useCallback((reason) => {
    if (!loopRef.current) return;
    clearTimeout(loopRef.current);
    loopRef.current = null;
    accumulatedTimeRef.current = 0;
    cursorTimerRef.current = 0;
  }, []);

  const tick = useCallback(() => {
    const now = Date.now();
    const delta = now - lastFrameRef.current;
    lastFrameRef.current = now;
    accumulatedTimeRef.current += delta;
    cursorTimerRef.current += delta;

    if (cursorTimerRef.current > 500) {
      cursorVisibleRef.current = !cursorVisibleRef.current;
      cursorTimerRef.current = 0;
    }

    const target = targetTextRef.current || '';
    const targetLen = target.length;
    let currentLen = displayLengthRef.current;
    if (currentLen > targetLen) {
      currentLen = targetLen;
      displayLengthRef.current = targetLen;
    }

    const isNetworkStreaming = streamingRef.current;
    const MS_PER_CHAR = isNetworkStreaming ? 15 : 4;

    if (currentLen < targetLen && accumulatedTimeRef.current >= MS_PER_CHAR) {
      let charsToAdd = Math.floor(accumulatedTimeRef.current / MS_PER_CHAR);
      const distance = targetLen - currentLen;

      if (isNetworkStreaming) {
        if (distance > 800) charsToAdd = Math.max(charsToAdd, 8);
        else if (distance > 400) charsToAdd = Math.max(charsToAdd, 6);
        else if (distance > 100) charsToAdd = Math.max(charsToAdd, 3);
        else charsToAdd = Math.max(charsToAdd, 1);
      } else {
        if (distance > 1200) charsToAdd = Math.max(charsToAdd, 32);
        else if (distance > 600) charsToAdd = Math.max(charsToAdd, 24);
        else if (distance > 300) charsToAdd = Math.max(charsToAdd, 16);
        else if (distance > 150) charsToAdd = Math.max(charsToAdd, 10);
        else if (distance > 60) charsToAdd = Math.max(charsToAdd, 6);
        else charsToAdd = Math.max(charsToAdd, 2);
      }

      accumulatedTimeRef.current = accumulatedTimeRef.current % MS_PER_CHAR;
      const nextLen = Math.min(currentLen + charsToAdd, targetLen);
      displayLengthRef.current = nextLen;

      const nextSlice = target.substring(0, nextLen);
      const shouldShowCursor = isNetworkStreaming || nextLen < targetLen;
      const textWithCursor = shouldShowCursor
        ? (cursorVisibleRef.current ? nextSlice + CURSOR_CHAR : nextSlice + '  ')
        : nextSlice;
      setDisplayedText(textWithCursor);
    } else if (currentLen === targetLen) {
      if (isNetworkStreaming) {
        const textWithCursor = cursorVisibleRef.current ? target + CURSOR_CHAR : target + '  ';
        setDisplayedText(prev => (prev !== textWithCursor ? textWithCursor : prev));
      } else {
        setDisplayedText(target);
        stopLoop('done');
        return;
      }
    }

    loopRef.current = setTimeout(tick, TEXT_UPDATE_INTERVAL_MS);
  }, [stopLoop]);

  const startLoop = useCallback((reason) => {
    if (loopRef.current) return;
    lastFrameRef.current = Date.now();
    accumulatedTimeRef.current = 0;
    cursorTimerRef.current = 0;
    loopRef.current = setTimeout(tick, TEXT_UPDATE_INTERVAL_MS);
  }, [tick]);

  // Reset internal state when message changes.
  useEffect(() => {
    stopLoop('messageChange');
    targetTextRef.current = base || '';
    displayLengthRef.current = (base || '').length;
    cursorVisibleRef.current = true;
    setDisplayedText(base || '');
    return () => stopLoop('unmount');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId]);

  // 1) Network listener: keep targetTextRef in sync with streaming buffer.
  useEffect(() => {
    if (!messageId || !streaming) return;

    const current = getStream(messageId) || base || '';
    if (current.length >= (targetTextRef.current || '').length) {
      targetTextRef.current = current;
    }

    startLoop('streaming');

    return subscribeStream(messageId, () => {
      const next = getStream(messageId) || '';
      if (next.length >= (targetTextRef.current || '').length) {
        targetTextRef.current = next;
      }

      startLoop('netUpdate');
    });
  }, [messageId, streaming, base, startLoop]);

  // 2) When network streaming ends, keep typing until we fully "drain" to the final text.
  useEffect(() => {
    if (!messageId || streaming) return;

    const fromBuf = getStream(messageId) || '';
    const baseText = base || '';
    const existing = targetTextRef.current || '';
    const final =
      baseText.length >= fromBuf.length && baseText.length >= existing.length
        ? baseText
        : (fromBuf.length >= existing.length ? fromBuf : existing);

    if (final.length >= existing.length) targetTextRef.current = final;

    if (displayLengthRef.current < final.length) {
      startLoop('drain');
    } else {
      setDisplayedText(final);
    }
  }, [messageId, streaming, base, startLoop]);

  // 3. Skeleton State (Thinking)
  const showSkeleton = streaming && displayLengthRef.current === 0;
  useEffect(() => {
    if (!showSkeleton) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true, isInteraction: false }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 800, useNativeDriver: true, isInteraction: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [showSkeleton, pulseAnim]);

  const pulseStyle = {
    opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
  };

  if (showSkeleton) {
    return (
      <View style={styles.skeletonContainer}>
        <Animated.Text style={[styles.activityText, pulseStyle]}>
          {activityText || 'Thinking...'}
        </Animated.Text>
      </View>
    );
  }

  // 4. Render
  return (
    <View>
      <MarkdownContent 
        text={displayedText} 
        isUser={false} 
        animateOnMount={false} 
        streaming={streaming} 
        selectable={selectable}
        selectionResetToken={selectionResetToken}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonContainer: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  activityText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default memo(StreamingText);

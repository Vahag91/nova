import React, { useEffect, useState, memo, useRef } from 'react';
import { View, StyleSheet, Text, Animated } from 'react-native';
import MarkdownContent from './MarkdownContent';
import { subscribeStream, getStream } from '../../lib/streamingBuffer';
import { colors } from '../../styles/colors';

const CURSOR_CHAR = ' ▋'; 

function StreamingText({ messageId, base = '', streaming = false, activityText }) {
  // The text currently visible on screen
  const [displayedText, setDisplayedText] = useState(base || '');
  const pulseAnim = useRef(new Animated.Value(0)).current;
  
  // Refs to hold state without causing re-renders
  const fullContentRef = useRef(base || '');
  const displayLengthRef = useRef((base || '').length);
  const loopRef = useRef(null);
  const cursorVisibleRef = useRef(true);

  // 1. Network Listener: Instantly captures data from the global buffer
  useEffect(() => {
      if (!streaming || !messageId) {
        const final = getStream(messageId) || base;
        fullContentRef.current = final;
        setDisplayedText(final);
        return;
      }

    // Initialize with current buffer
    const current = getStream(messageId) || base;
    fullContentRef.current = current;

    // Subscribe to future updates (updates ref only, no render)
    return subscribeStream(messageId, () => {
      fullContentRef.current = getStream(messageId);
    });
  }, [messageId, streaming, base]);

  // 2. The "Liquid" Physics Loop: Controls rendering speed (30-60 FPS)
  useEffect(() => {
    if (!streaming) return;

    let lastFrame = Date.now();
    let cursorTimer = 0;
    let accumulatedTime = 0;

    // CONFIGURATION: Controls smoothness. 
    // 15ms = ~66 chars/second (Very smooth)
    const MS_PER_CHAR = 15; 

    const tick = () => {
      const now = Date.now();
      const delta = now - lastFrame;
      lastFrame = now;
      accumulatedTime += delta;

      // --- Cursor Blinking ---
      cursorTimer += delta;
      if (cursorTimer > 500) { // Blink every 500ms
        cursorVisibleRef.current = !cursorVisibleRef.current;
        cursorTimer = 0;
      }

      const fullContent = fullContentRef.current;
      const currentLen = displayLengthRef.current;
      const targetLen = fullContent.length;
      
      // --- Typing Logic ---
      if (accumulatedTime >= MS_PER_CHAR && currentLen < targetLen) {
        
        // Determine how many characters to add this frame
        let charsToAdd = Math.floor(accumulatedTime / MS_PER_CHAR);
        const distance = targetLen - currentLen;
        
        // Adaptive Velocity:
        // If falling behind (>100 chars), speed up slightly (max 3 chars/frame).
        // Otherwise, stick to 1 char/frame for maximum smoothness.
        if (distance > 100) charsToAdd = Math.max(charsToAdd, 3);
        else charsToAdd = 1; 

        // Deduct time used
        accumulatedTime = accumulatedTime % MS_PER_CHAR;

        const nextLen = Math.min(currentLen + charsToAdd, targetLen);
        const nextSlice = fullContent.substring(0, nextLen);
        
        displayLengthRef.current = nextLen;

        // Add cursor to the end of the string
        const textWithCursor = cursorVisibleRef.current 
          ? nextSlice + CURSOR_CHAR 
          : nextSlice + '  ';

        setDisplayedText(textWithCursor);
      } 
      // If waiting for network, just animate the cursor
      else if (currentLen === targetLen) {
         const slice = fullContent.substring(0, currentLen);
         const textWithCursor = cursorVisibleRef.current 
          ? slice + CURSOR_CHAR 
          : slice + '  ';
         
         // Only update state if cursor changed to prevent useless renders
         setDisplayedText(prev => prev !== textWithCursor ? textWithCursor : prev);
      }

      loopRef.current = requestAnimationFrame(tick);
    };

    loopRef.current = requestAnimationFrame(tick);

    return () => {
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
    };
  }, [streaming]);

  // 3. Skeleton State (Thinking)
  const showSkeleton = streaming && displayLengthRef.current === 0;
  useEffect(() => {
    if (!showSkeleton) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
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
    fontFamily: 'Lato-Regular',
    fontWeight: '600',
  },
});

export default memo(StreamingText);

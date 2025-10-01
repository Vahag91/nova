import React, {
  useMemo, useRef, useCallback, memo, useEffect, useState,
  forwardRef, useImperativeHandle
} from 'react';
import { View, StyleSheet, FlatList, Platform, TouchableOpacity } from 'react-native';
import Reanimated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import MessageBubble from './MessageBubble';
import DaySeparator from './DaySeparator';
import { colors } from '../../styles/colors';

const BOTTOM_GAP = 16; // small, consistent
const NEAR_BOTTOM_PAD_RATIO = 0.12; // 12% viewport

function toDayKey(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = `${dt.getMonth() + 1}`.padStart(2, '0');
  const day = `${dt.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function interleaveDaySeparators(messages) {
  const out = [];
  let lastKey = null;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const key = toDayKey(msg.createdAt || Date.now());
    if (key !== lastKey) {
      out.push({ type: 'day', id: `day-${key}`, key, date: msg.createdAt });
      lastKey = key;
    }
    out.push(msg);
  }
  return out;
}

const MessageListCore = function MessageList({
  messages,
  streaming,
  streamingMessageId,
  onRetryFromHere,
  threadKey,
}, ref) {
  const listRef = useRef(null);

  const [showJump, setShowJump] = useState(false);

  // Track “am I near bottom?” and user drag state
  const isAtBottomRef = useRef(true);
  const userDraggingRef = useRef(false);
  const autoPinRef = useRef(true); // when true and near bottom, we will autoscroll on content changes
  const manualScrollRequestRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  // Compute streaming tail (assistant placeholder)
  const streamingTail = useMemo(() => {
    if (!streaming) return null;
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant' && last?.id === streamingMessageId) return last;
    // fallback scan
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m?.role === 'assistant' && m?.id === streamingMessageId) return m;
    }
    return null;
  }, [messages, streaming, streamingMessageId]);

  // Merge tail into the main data so it lays out naturally
  const data = useMemo(() => {
    const base = streamingTail
      ? messages.filter(m => m?.id !== streamingTail.id).concat([streamingTail])
      : messages;
    return interleaveDaySeparators(base);
  }, [messages, streamingTail?.id]);

  const keyExtractor = useCallback((it) => it.id, []);

  // Footer grouping: determine if the streaming item starts a new group
  const lastRenderable = data.length ? data[data.length - 1] : null;
  const footerFirstInGroup =
    !lastRenderable ||
    lastRenderable.type === 'day' ||
    lastRenderable.role !== (streamingTail?.role || 'assistant');

  const scrollToBottom = useCallback((animated = true) => {
    listRef.current?.scrollToEnd({ animated });
  }, []);

  const scrollToBottomIfNeeded = useCallback((animated = false) => {
    if (scrollTimeoutRef.current) return;
    const shouldScroll =
      manualScrollRequestRef.current ||
      (autoPinRef.current && isAtBottomRef.current && !userDraggingRef.current);
    if (shouldScroll) {
      scrollTimeoutRef.current = setTimeout(() => {
        listRef.current?.scrollToEnd({ animated });
        scrollTimeoutRef.current = null;
        manualScrollRequestRef.current = false;
      }, animated ? 16 : 0);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    scrollToBottom: (animated = true) => scrollToBottom(animated),
    scrollToBottomIfNeeded: () => scrollToBottomIfNeeded(true),
  }), [scrollToBottom, scrollToBottomIfNeeded]);

  // Basic near-bottom detection & Jump button logic
  const handleScroll = useCallback((e) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const pad = layoutMeasurement.height * NEAR_BOTTOM_PAD_RATIO;
    const isAtBottom = contentOffset.y >= contentSize.height - layoutMeasurement.height - pad;
    isAtBottomRef.current = isAtBottom;
    if (!userDraggingRef.current && isAtBottom) {
      autoPinRef.current = true;
    }
    // Show jump only when user is away from bottom
    setShowJump(!isAtBottom);
  }, []);

  const onScrollBeginDrag = useCallback(() => {
    userDraggingRef.current = true;
    autoPinRef.current = false;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  }, []);

  const onScrollEndDrag = useCallback(() => {
    userDraggingRef.current = false;
  }, []);

  const onMomentumScrollEnd = useCallback((e) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const pad = layoutMeasurement.height * NEAR_BOTTOM_PAD_RATIO;
    const isAtBottom = contentOffset.y >= contentSize.height - layoutMeasurement.height - pad;
    isAtBottomRef.current = isAtBottom;
    autoPinRef.current = isAtBottom;
    setShowJump(!isAtBottom);
  }, []);

  // Auto-pin to bottom when content grows *and* we are near bottom
  const onContentSizeChange = useCallback(() => {
    scrollToBottomIfNeeded(false);
  }, [scrollToBottomIfNeeded]);

  // Reset on thread change
  useEffect(() => {
    isAtBottomRef.current = true;
    autoPinRef.current = true;
    userDraggingRef.current = false;
    manualScrollRequestRef.current = false;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
    // Optionally jump to bottom when switching threads
    requestAnimationFrame(() => scrollToBottom(false));
  }, [threadKey, scrollToBottom]);

  const renderItem = ({ item, index }) => {
    if (item?.type === 'day') return <DaySeparator date={item.date} />;
    if (item.role === 'system') return <DaySeparator system text={item.content} />;

    // Compute grouping inline against `data`
    const role = item.role;
    // find prev/next non-day
    let j = index - 1; let prevMsg = null;
    while (j >= 0) { if (!data[j]?.type) { prevMsg = data[j]; break; } j--; }
    j = index + 1; let nextMsg = null;
    while (j < data.length) { if (!data[j]?.type) { nextMsg = data[j]; break; } j++; }

    const isFirstInGroup = !prevMsg || prevMsg.role !== role;
    const isLastInGroup  = !nextMsg || nextMsg.role !== role;

    // If this is the streaming tail, pass streaming props so MessageBubble can show its StreamingText
    const isStreamingItem = streamingTail && item.id === streamingTail.id;

    return (
      <MessageBubble
        message={item}
        isUser={role === 'user'}
        isFirstInGroup={isFirstInGroup}
        isLastInGroup={isLastInGroup}
        onRetryFromHere={onRetryFromHere}
        showMeta={isLastInGroup}
        streaming={!!isStreamingItem}
        streamingMessageId={isStreamingItem ? streamingMessageId : undefined}
      />
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.container}>
        <FlatList
          ref={listRef}
          style={styles.list}
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={onScrollEndDrag}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onContentSizeChange={onContentSizeChange}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={12}
          windowSize={9}
          maxToRenderPerBatch={12}
          updateCellsBatchingPeriod={50}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={!userDraggingRef.current}
          ListFooterComponent={<View style={{ height: BOTTOM_GAP }} />}
        />

        {showJump && (
          <Reanimated.View
            entering={FadeInDown.duration(180)}
            exiting={FadeOutDown.duration(160)}
            style={styles.jumpWrap}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.jumpButton}
              onPress={() => {
                manualScrollRequestRef.current = true;
                listRef.current?.scrollToEnd({ animated: true });
                isAtBottomRef.current = true;
                autoPinRef.current = true;
                setShowJump(false);
              }}
              accessibilityLabel="Scroll to latest message"
            >
              <Svg width={20} height={20} viewBox="0 -960 960 960" style={styles.arrowIcon}>
                <Path
                  d="M440-800v487L216-537l-56 57 320 320 320-320-56-57-224 224v-487h-80Z"
                  fill="#FFFFFF"
                />
              </Svg>
            </TouchableOpacity>
          </Reanimated.View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  list: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: '#000000',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  listContent: {
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 0,
  },
  jumpWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: 'center',
  },
  jumpButton: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  arrowIcon: {
    alignSelf: 'center',
  },
});

const MessageList = memo(forwardRef(MessageListCore), (prev, next) => {
  if (prev.messages.length !== next.messages.length) return false;
  if (prev.streaming !== next.streaming) return false;
  if (prev.streamingMessageId !== next.streamingMessageId) return false;
  if (prev.onRetryFromHere !== next.onRetryFromHere) return false;
  if (prev.threadKey !== next.threadKey) return false;

  const pLast = prev.messages[prev.messages.length - 1]?.id;
  const nLast = next.messages[next.messages.length - 1]?.id;
  if (pLast !== nLast) return false;

  for (let i = 0; i < prev.messages.length; i++) {
    if (prev.messages[i]?.id !== next.messages[i]?.id ||
        prev.messages[i]?.content !== next.messages[i]?.content) {
      return false;
    }
  }
  return true;
});

export default MessageList;

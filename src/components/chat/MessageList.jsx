import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Text, Keyboard, FlatList } from 'react-native';
import MessageBubble from './MessageBubble';
import DaySeparator from './DaySeparator';
import { colors } from '../../styles/colors';

function annotateGroups(messages) {
  return messages.map((m, i, arr) => {
    const prev = arr[i - 1];
    const next = arr[i + 1];
    const isFirstInGroup = !prev || prev.role !== m.role;
    const isLastInGroup = !next || next.role !== m.role;
    return { ...m, _isFirstInGroup: isFirstInGroup, _isLastInGroup: isLastInGroup };
  });
}

function toDayKey(d) {
  const dt = new Date(d);
  // Use YYYY-MM-DD stable key (locale independent)
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
    out.push({ type: 'message', ...msg });
  }
  return out;
}

export default function MessageList({ messages, streaming, onRetryFromHere }) {
  const listRef = useRef(null);
  const [autoStick, setAutoStick] = useState(true);

  const data = useMemo(() => {
    const grouped = annotateGroups(messages);
    const withSeparators = interleaveDaySeparators(grouped);
    // Reverse the data for inverted list so messages appear in correct order
    return withSeparators.reverse();
  }, [messages]);

  // For inverted lists, the "bottom" is offset 0
  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  useEffect(() => {
    if (!listRef.current || !autoStick) return;
    const t = setTimeout(scrollToBottom, 80);
    return () => clearTimeout(t);
  }, [data, streaming, autoStick, scrollToBottom]);

  const onScroll = useCallback((e) => {
    // Inverted list: y=0 means we're at the visual bottom (latest messages)
    const y = e.nativeEvent.contentOffset.y;
    setAutoStick(y <= 80);
  }, []);


  const renderItem = ({ item }) => {
    if (item.type === 'day') {
      return <DaySeparator date={item.date} />;
    }
    // system-style messages centered
    if (item.role === 'system') {
      return <DaySeparator system text={item.content} />;
    }
    return (
      <MessageBubble
        message={item}
        isUser={item.role === 'user'}
        isFirstInGroup={item._isFirstInGroup}
        isLastInGroup={item._isLastInGroup}
        onRetryFromHere={onRetryFromHere}
        showMeta={item._isLastInGroup}
        streaming={streaming}
      />
    );
  };

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        style={styles.list}
        data={data}
        keyExtractor={(it) => it.id || it.key}
        renderItem={renderItem}
        inverted
        // Keeps the view pinned near the bottom when new items arrive
        maintainVisibleContentPosition={{ minIndexForVisible: 1, autoscrollToTopThreshold: 80 }}
        ListFooterComponent={null}
        onScroll={onScroll}
        onContentSizeChange={() => { if (autoStick) setTimeout(scrollToBottom, 50); }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={true}
        initialNumToRender={16}
        windowSize={9}
        maxToRenderPerBatch={16}
        updateCellsBatchingPeriod={50}
      />

      {/* Scroll-to-bottom FAB */}
      {!autoStick && (
        <Pressable style={styles.fab} hitSlop={8} onPress={scrollToBottom} accessibilityLabel="Scroll to latest message">
          <Text style={styles.fabText}>↓</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1 },
  container: { paddingVertical: 8 },
  fab: { position: 'absolute', right: 10, bottom: 10, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  fabText: { fontSize: 16, color: colors.text },
});

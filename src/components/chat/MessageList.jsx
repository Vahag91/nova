import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
import MessageBubble from './MessageBubble';
import TypingDots from './TypingDots';
import { colors } from '../../styles/colors';

function groupMessages(messages) {
  // annotate with grouping flags by consecutive role
  return messages.map((m, i, arr) => {
    const prev = arr[i-1], next = arr[i+1];
    const isFirstInGroup = !prev || prev.role !== m.role;
    const isLastInGroup  = !next || next.role !== m.role;
    return { ...m, _isFirstInGroup: isFirstInGroup, _isLastInGroup: isLastInGroup };
  });
}

export default function MessageList({ messages, streaming, onRetryFromHere }) {
  const listRef = useRef(null);
  const [autoStick, setAutoStick] = useState(true);

  const data = useMemo(() => groupMessages(messages), [messages]);

  useEffect(() => {
    if (!listRef.current || !autoStick) return;
    // Use a small delay to ensure the content has been rendered
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [data, streaming, autoStick]);

  const onScroll = useCallback((e) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    setAutoStick(distanceFromBottom < 80);
  }, []);

  return (
    <FlatList
      ref={listRef}
      style={styles.list}
      data={data}
      keyExtractor={(m) => m.id}
      renderItem={({ item }) => (
        <MessageBubble
          message={item}
          isUser={item.role === 'user'}
          isFirstInGroup={item._isFirstInGroup}
          isLastInGroup={item._isLastInGroup}
          onRetryFromHere={onRetryFromHere}
          showMeta={item._isLastInGroup}
        />
      )}
      ListFooterComponent={
        streaming ? (
          <View style={styles.typingWrap}>
            <View style={[styles.typingBubble]}>
              <TypingDots />
            </View>
          </View>
        ) : null
      }
      onScroll={onScroll}
      onContentSizeChange={() => { 
        if (autoStick) {
          setTimeout(() => {
            listRef.current?.scrollToEnd({ animated: true });
          }, 50);
        }
      }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      // Performance optimizations for large threads
      removeClippedSubviews={true}
      initialNumToRender={12}
      windowSize={7}
      maxToRenderPerBatch={12}
      updateCellsBatchingPeriod={50}
    />
  );
}

const styles = StyleSheet.create({
  list:{ flex:1, backgroundColor: colors.background },
  container:{ paddingVertical:10 },
  typingWrap:{ paddingHorizontal:16, marginVertical:6, alignItems:'flex-start', marginRight:60 },
  typingBubble:{ backgroundColor: colors.assistantBubble, borderColor: colors.border, borderWidth:1, borderRadius:16, paddingVertical:10, paddingHorizontal:12 },
});

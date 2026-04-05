import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { RectButton } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import Haptic from 'react-native-haptic-feedback';
import { useThreadsStore } from '../state/useThreadsStore';
import { colors } from '../styles/colors';
import SvgIcon from '../components/SvgIcon';
import { useAndroidNavigationMenu } from '../navigation/AndroidNavigationMenuContext';
import { useTranslation } from 'react-i18next';
import { perfLog } from '../lib/perfTrace';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// Date formatting helpers (locale-aware)
function formatMonthYear(ts, locale, lang) {
  const d = new Date(ts || Date.now());
  // Explicit Japanese format to avoid missing ICU data
  if (lang === 'ja') return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  try {
    return d.toLocaleDateString(locale || undefined, { year: 'numeric', month: 'long' });
  } catch {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}
function formatRowDate(ts, locale, lang) {
  const d = new Date(ts || Date.now());
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (lang === 'ja') return `${d.getMonth() + 1}月${d.getDate()}日・${hh}:${mm}`;
  try {
    const datePart = d.toLocaleDateString(locale || undefined, { month: 'short', day: 'numeric' });
    const timePart = d.toLocaleTimeString(locale || undefined, { hour: '2-digit', minute: '2-digit' });
    return `${datePart} • ${timePart}`;
  } catch {
    return `${d.getMonth() + 1}/${d.getDate()} • ${hh}:${mm}`;
  }
}

export default function HistorySimple({ navigation }) {
  const { t, i18n } = useTranslation();
  const isFocused = useIsFocused();
  const { reportScreenReady } = useAndroidNavigationMenu();
  const lang = (i18n?.language || 'en').split('-')[0];
  const locale = lang === 'ja' ? 'ja-JP' : 'en-US';
  const frozenThreadIndexRef = useRef([]);
  const threadIndex = useThreadsStore(
    React.useCallback(
      state => (isFocused ? state.threadIndex : frozenThreadIndexRef.current),
      [isFocused]
    )
  );
  const createThread = useThreadsStore(s => s.createThread);
  const setActiveThread = useThreadsStore(s => s.setActiveThread);
  const renameThread = useThreadsStore(s => s.renameThread);
  const deleteThread = useThreadsStore(s => s.deleteThread);

  const [busyId, setBusyId] = useState(null);
  const [q, setQ] = useState('');
  const rootLayoutLoggedRef = useRef(false);
  const rootLayoutSeenRef = useRef(false);
  const screenReadyReportedRef = useRef(false);
  const contentSizeLoggedRef = useRef(false);

  useEffect(() => {
    perfLog('history.screen.mounted');
    return () => {
      perfLog('history.screen.unmounted');
    };
  }, []);

  useEffect(() => {
    perfLog('history.screen.focus', {
      isFocused,
    });
    if (isFocused) {
      frozenThreadIndexRef.current = threadIndex;
      rootLayoutLoggedRef.current = false;
      contentSizeLoggedRef.current = false;
      screenReadyReportedRef.current = false;
      if (rootLayoutSeenRef.current) {
        requestAnimationFrame(() => {
          if (!screenReadyReportedRef.current) {
            reportScreenReady('History');
            screenReadyReportedRef.current = true;
          }
        });
      }
    }
  }, [isFocused, reportScreenReady, threadIndex]);

  // Swipe row refs
  const rowRefs = useRef(new Map());
  const closeRow = (id) => { const r = rowRefs.current.get(id); r?.close?.(); };
  const closeAllExcept = (id) => rowRefs.current.forEach((r, k) => { if (k !== id) r?.close?.(); });

  // Sort: recent first (no pinning)
  const sorted = useMemo(() => {
    const arr = threadIndex.filter(thread => thread?.hasMessages);
    arr.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return arr;
  }, [threadIndex]);

  // Filter by search using precomputed thread previews.
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter(thread => {
      const preview = String(thread?.preview || '').toLowerCase();
      const title = String(thread?.title || '').toLowerCase();
      return preview.includes(needle) || title.includes(needle);
    });
  }, [sorted, q]);

  // Build sections by Month Year (descending)
  const sections = useMemo(() => {
    const map = new Map(); // key "YYYY-MM" -> array
    for (const t of filtered) {
      const ts = t.updatedAt || t.createdAt || 0;
      const d = new Date(ts);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(t);
    }
    const keys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    return keys.map(k => {
      const items = map.get(k) || [];
      items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      const sampleTs = items[0]?.updatedAt || Date.now();
      return {
        title: formatMonthYear(sampleTs, locale, lang),
        key: `section-${k}`,
        data: items,
      };
    });
  }, [filtered, locale, lang]);

  useEffect(() => {
    if (!isFocused) return;
    perfLog('history.data.snapshot', {
      indexedThreads: threadIndex.length,
      sortedThreads: sorted.length,
      filteredThreads: filtered.length,
      sections: sections.length,
      queryLength: q.length,
    });
  }, [filtered.length, isFocused, q.length, sections.length, sorted.length, threadIndex.length]);

function openThread(thread) {
    perfLog('history.thread.open', {
      threadId: thread?.id,
    });
    Haptic.trigger('impactLight');
  setActiveThread(thread.id);
    navigation?.navigate?.('Chat');
  }

  function onNew() {
    perfLog('history.new_chat');
    Haptic.trigger('impactLight');
    const th = createThread({ title: t('history.newChat') });
    setActiveThread(th.id);
    navigation?.navigate?.('Chat');
  }

  // iOS prompt; simple fallback elsewhere
function onRename(thread) {
    Haptic.trigger('selection');
    if (typeof Alert.prompt === 'function') {
      Alert.prompt(
        t('history.renameChat'),
        t('history.enterNewTitle'),
        [
          { text: t('common.cancel'), style: 'cancel', onPress: () => closeRow(thread.id) },
          { text: t('common.save'), onPress: (val) => { if (val?.trim()) renameThread(thread.id, val.trim()); closeRow(thread.id); } },
        ],
        'plain-text',
      thread.title,
      );
    } else {
    renameThread(thread.id, (thread.title || t('navigation.chat')) + ' *');
    closeRow(thread.id);
    }
  }

  // immediate delete (no modal)
  function deleteNow(t) {
    if (busyId === t.id) return;
    Haptic.trigger('impactHeavy');
    setBusyId(t.id);
    try {
      deleteThread(t.id);
    } finally {
      setBusyId(null);
      closeRow(t.id);
    }
  }

  // Right actions: Delete (only)
  const renderRightActions = (thread /* , progress, dragX */) => (
    <Animated.View
      entering={FadeIn.duration(120).springify().damping(18)}
      style={styles.rightActions}
    >
      <RectButton
        style={styles.deleteBtn}
        onPress={() => deleteNow(thread)}
        enabled={busyId !== thread.id}
      >
        <View style={styles.actionContentCol}>
          {busyId === thread.id ? (
            <Text style={styles.deleteBtnText}>...</Text>
          ) : (
            <SvgIcon name="trash" size={25} color="#FFFFFF" />
          )}
        </View>
      </RectButton>
    </Animated.View>
  );

const renderItem = ({ item: thread }) => {
  const preview = thread.preview || t('history.newChat');
    return (
      <Swipeable
      ref={(ref) => { ref ? rowRefs.current.set(thread.id, ref) : rowRefs.current.delete(thread.id); }}
        friction={1.1}
        rightThreshold={56}
        overshootRight
        overshootFriction={6}
        enableTrackpadTwoFingerGesture
      onSwipeableWillOpen={() => closeAllExcept(thread.id)}
        // full left swipe → RIGHT actions → delete
      onSwipeableOpen={(dir) => { if (dir === 'right') deleteNow(thread); }}
      renderRightActions={(progress, dragX) => renderRightActions(thread, progress, dragX)}
      >
        <TouchableOpacity
        onPress={() => openThread(thread)}
        onLongPress={() => onRename(thread)}
          activeOpacity={0.85}
          style={styles.row}
        >
          <View style={styles.rowCard}>
            <View style={styles.rowContent}>
              <View style={styles.rowMain}>
              <Text style={styles.topic} numberOfLines={2}>{preview || t('history.newChat')}</Text>
              </View>
              <View style={styles.rowRight}>
              <Text style={styles.time}>{formatRowDate(thread.updatedAt, locale, lang)}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  return (
    <View
      style={styles.container}
      onLayout={() => {
        if (rootLayoutLoggedRef.current) return;
        rootLayoutLoggedRef.current = true;
        rootLayoutSeenRef.current = true;
        perfLog('history.root.layout');
        if (isFocused && !screenReadyReportedRef.current) {
          reportScreenReady('History');
          screenReadyReportedRef.current = true;
        }
      }}
    >
      <View style={styles.searchWrap}>
        <SvgIcon name="search" size={18} color="#888888" style={styles.searchIcon} />
        <TextInput
          value={q}
          onChangeText={(text) => {
            perfLog('history.search.change', {
              length: text?.length || 0,
            });
            setQ(text);
          }}
          placeholder={t('history.search')}
          placeholderTextColor="#666666"
          style={styles.search}
        />
        {q?.length > 0 && (
          <TouchableOpacity onPress={() => setQ('')} accessibilityLabel={t('history.clearSearch')} style={{ paddingLeft: 8 }}>
            <SvgIcon name="clear" size={18} color="#888888" />
          </TouchableOpacity>
        )}
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        removeClippedSubviews
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        onContentSizeChange={(_, height) => {
          if (contentSizeLoggedRef.current) return;
          contentSizeLoggedRef.current = true;
          perfLog('history.list.content_size', {
            height,
            sections: sections.length,
            items: filtered.length,
          });
        }}
        style={{ backgroundColor: '#000000' }}
        contentContainerStyle={sections.length ? { paddingBottom: 100 } : styles.emptyWrap}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {t('history.noResults', { defaultValue: 'No chats yet' })}
            </Text>
            <TouchableOpacity onPress={onNew} style={styles.startBtn}>
              <Text style={styles.startBtnText}>
                {t('history.startNewChat', { defaultValue: 'Start a new chat' })}
              </Text>
            </TouchableOpacity>
          </View>
        }
      />
      {/* Fixed New Chat Button at Bottom */}
      <View style={styles.newChatButtonContainer}>
        <AnimatedTouchable 
          onPress={onNew} 
          style={styles.newChatButton}
          activeOpacity={0.8}
        >
          <Svg width={18} height={18} viewBox="0 0 440 440">
            <Path
              d="M226 0C248.091 3.54343e-07 266 17.9086 266 40V173H400C422.091 173 440 190.909 440 213V226C440 248.091 422.091 266 400 266H266V400C266 422.091 248.091 440 226 440H213C190.909 440 173 422.091 173 400V266H40C17.9086 266 3.54389e-07 248.091 0 226V213C3.54389e-07 190.909 17.9086 173 40 173H173V40C173 17.9086 190.909 3.54389e-07 213 0H226Z"
              fill="#FFFFFF"
            />
          </Svg>
          {/* <Text style={styles.newChatButtonText}>{t('history.newChat')}</Text> */}
        </AnimatedTouchable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor: '#000000' },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: { marginRight: 8 },
  search:{ flex: 1, fontSize: 16, color: colors.text, padding: 0 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: '#000000',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  row:{ 
    paddingHorizontal: 16, 
    paddingVertical: 4, 
    backgroundColor: '#000000',
  },
  rowCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowMain:{ flex: 1, marginRight: 16 },
  topic:{ fontSize: 17, fontWeight: '500', color: colors.text, lineHeight: 22 },

  rowRight: { alignItems: 'flex-end', minWidth: 80 },
  time:{ fontSize: 13, color: colors.textMuted },

  emptyWrap:{ flexGrow:1, justifyContent:'center', alignItems:'center', padding:24 },
  empty:{ alignItems:'center' },
  emptyTitle:{ fontSize:18, fontWeight:'700', color: colors.text },
  startBtn:{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, marginTop: 16 },
  startBtnText:{ color: colors.buttonText, fontWeight:'600', fontSize: 16 },

  // Right actions (Delete)
  rightActions: {
    height: '100%',
    width: 96,
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingRight: 16,
    paddingVertical: 4, // match row vertical padding so the red action matches card height
  },
  deleteBtn: {
    height: '100%',
    width: '100%',
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12, // match rowCard radius
  },
  actionContentCol: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  deleteBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 12, marginTop: 2 },

  // Fixed New Chat Button
  newChatButtonContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    // backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  newChatButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 54,
    gap: 10,
    alignSelf: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  newChatButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Lato-Bold',
  },
});

import React, { useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity, TextInput, Alert,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { RectButton } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import Haptic from 'react-native-haptic-feedback';
import { useThreadsStore } from '../state/useThreadsStore';
import { betterPreview } from '../lib/format';
import { colors } from '../styles/colors';
import SvgIcon from '../components/SvgIcon';

// --- month/year helpers ---
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function formatMonthYear(ts) {
  const d = new Date(ts || Date.now());
  return `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
}
function formatRowDate(ts) {
  const d = new Date(ts || Date.now());
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${MONTHS[d.getMonth()]} ${d.getDate()} • ${hh}:${mm}`;
}

// Extract clean preview text from summary
function cleanPreview(summary) {
  if (!summary) return '';
  
  // Split by bullets and get first meaningful line
  const lines = summary
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('•'))
    .map(line => line.replace(/^•\s*/, ''));
  
  if (lines.length === 0) return summary.trim();
  
  // Get first line and remove common prefixes
  let text = lines[0]
    .replace(/^Topic:\s*/i, '')
    .replace(/^Image noted:\s*/i, '')
    .replace(/^Key figure:\s*/i, '')
    .replace(/^Constraint:\s*/i, '')
    .replace(/^Decision\/Next:\s*/i, '')
    .replace(/^Identity:\s*/i, '')
    .replace(/^Safety:\s*/i, '')
    .trim();
  
  // Remove "(refer back with...)" type suffixes
  text = text.replace(/\s*\(refer back.*?\)\.?$/i, '');
  
  return text || 'New chat';
}

export default function HistorySimple({ navigation }) {
  const threads = useThreadsStore(s => s.threads);
  const createThread = useThreadsStore(s => s.createThread);
  const setActiveThread = useThreadsStore(s => s.setActiveThread);
  const renameThread = useThreadsStore(s => s.renameThread);
  const deleteThread = useThreadsStore(s => s.deleteThread);

  const [busyId, setBusyId] = useState(null);
  const [q, setQ] = useState('');

  // Swipe row refs
  const rowRefs = useRef(new Map());
  const closeRow = (id) => { const r = rowRefs.current.get(id); r?.close?.(); };
  const closeAllExcept = (id) => rowRefs.current.forEach((r, k) => { if (k !== id) r?.close?.(); });

  // Sort: recent first (no pinning)
  const sorted = useMemo(() => {
    const arr = [...threads];
    arr.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return arr;
  }, [threads]);

  // Filter by search (topic/preview only) and hide empty threads
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const nonEmpty = sorted.filter(t => Array.isArray(t?.messages) && t.messages.some(m => m.role === 'user' || m.role === 'assistant'));
    if (!needle) return nonEmpty;
    return nonEmpty.filter(t => {
      const rawPreview = t.summary?.trim() || betterPreview(t.messages);
      const preview = (t.summary ? cleanPreview(rawPreview) : rawPreview).toLowerCase();
      return preview.includes(needle);
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
        title: formatMonthYear(sampleTs),
        key: `section-${k}`,
        data: items,
      };
    });
  }, [filtered]);

  function openThread(t) {
    Haptic.trigger('impactLight');
    setActiveThread(t.id);
    navigation?.navigate?.('Chat');
  }

  function onNew() {
    Haptic.trigger('impactLight');
    const t = createThread({ title: 'New chat' });
    setActiveThread(t.id);
    navigation?.navigate?.('Chat');
  }

  // iOS prompt; simple fallback elsewhere
  function onRename(t) {
    Haptic.trigger('selection');
    if (typeof Alert.prompt === 'function') {
      Alert.prompt(
        'Rename chat',
        'Enter a new title',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => closeRow(t.id) },
          { text: 'Save', onPress: (val) => { if (val?.trim()) renameThread(t.id, val.trim()); closeRow(t.id); } },
        ],
        'plain-text',
        t.title,
      );
    } else {
      renameThread(t.id, (t.title || 'Chat') + ' *');
      closeRow(t.id);
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
  const renderRightActions = (t /* , progress, dragX */) => (
    <Animated.View
      entering={FadeIn.duration(120).springify().damping(18)}
      style={styles.rightActions}
    >
      <RectButton
        style={styles.deleteBtn}
        onPress={() => deleteNow(t)}
        enabled={busyId !== t.id}
      >
        <View style={styles.actionContentCol}>
          {busyId === t.id ? (
            <Text style={styles.deleteBtnText}>...</Text>
          ) : (
            <>
              <SvgIcon name="trash" size={18} color="#FFFFFF" />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </>
          )}
        </View>
      </RectButton>
    </Animated.View>
  );

  const renderItem = ({ item: t }) => {
    const rawPreview = t.summary?.trim() || betterPreview(t.messages);
    const preview = t.summary ? cleanPreview(rawPreview) : rawPreview;
    return (
      <Swipeable
        ref={(ref) => { ref ? rowRefs.current.set(t.id, ref) : rowRefs.current.delete(t.id); }}
        friction={1.1}
        rightThreshold={56}
        overshootRight
        overshootFriction={6}
        enableTrackpadTwoFingerGesture
        onSwipeableWillOpen={() => closeAllExcept(t.id)}
        // full left swipe → RIGHT actions → delete
        onSwipeableOpen={(dir) => { if (dir === 'right') deleteNow(t); }}
        renderRightActions={(progress, dragX) => renderRightActions(t, progress, dragX)}
      >
        <TouchableOpacity
          onPress={() => openThread(t)}
          onLongPress={() => onRename(t)}
          activeOpacity={0.85}
          style={styles.row}
        >
          <View style={styles.rowCard}>
            <View style={styles.rowContent}>
              <View style={styles.rowMain}>
                <Text style={styles.topic} numberOfLines={2}>{preview || 'New chat'}</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.time}>{formatRowDate(t.updatedAt)}</Text>
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
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <SvgIcon name="search" size={18} color="#888888" style={styles.searchIcon} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search"
          placeholderTextColor="#666666"
          style={styles.search}
        />
        {q?.length > 0 && (
          <TouchableOpacity onPress={() => setQ('')} accessibilityLabel="Clear search" style={{ paddingLeft: 8 }}>
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
        style={{ backgroundColor: '#000000' }}
        contentContainerStyle={sections.length ? undefined : styles.emptyWrap}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No results found</Text>
            <TouchableOpacity onPress={onNew} style={styles.startBtn}>
              <Text style={styles.startBtnText}>Start a new chat</Text>
            </TouchableOpacity>
          </View>
        }
      />
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
    paddingVertical: 8, 
    backgroundColor: '#000000',
  },
  rowCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowMain:{ flex: 1, marginRight: 16 },
  topic:{ fontSize: 14, fontWeight: '500', color: colors.text, lineHeight: 20 },

  rowRight: { alignItems: 'flex-end', minWidth: 80 },
  time:{ fontSize: 12, color: colors.textMuted },

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
    paddingVertical: 8, // match row vertical padding so the red action matches card height
  },
  deleteBtn: {
    height: '100%',
    width: '100%',
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10, // match rowCard radius
  },
  actionContentCol: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  deleteBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 12, marginTop: 2 },
});

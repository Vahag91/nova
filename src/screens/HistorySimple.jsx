import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput,
} from 'react-native';
import Haptic from 'react-native-haptic-feedback';
import { useThreadsStore } from '../state/useThreadsStore';
import { betterPreview, formatRelative } from '../lib/format';
import { colors } from '../styles/colors';

export default function HistorySimple({ navigation }) {
  console.log('HistorySimple rendering...');
  
  const threads = useThreadsStore(s => s.threads);
  const activeThreadId = useThreadsStore(s => s.activeThreadId);
  const createThread = useThreadsStore(s => s.createThread);
  const setActiveThread = useThreadsStore(s => s.setActiveThread);
  const renameThread = useThreadsStore(s => s.renameThread);
  const deleteThread = useThreadsStore(s => s.deleteThread);
  const pinThread = useThreadsStore(s => s.pinThread);

  const [busyId, setBusyId] = useState(null);
  const [q, setQ] = useState('');

  // Sort: pinned first, then recent
  const sorted = useMemo(() => {
    const arr = [...threads];
    arr.sort((a,b) => {
      const pa = a.pinned ? 1 : 0, pb = b.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa; // pinned first
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    return arr;
  }, [threads]);

  // Filter by search
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter(t => {
      const title = (t.title || '').toLowerCase();
      const preview = betterPreview(t.messages).toLowerCase();
      return title.includes(needle) || preview.includes(needle);
    });
  }, [sorted, q]);

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

  function onRename(t) {
    Haptic.trigger('selection');
    if (typeof Alert.prompt === 'function') {
      Alert.prompt(
        'Rename chat',
        'Enter a new title',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save', onPress: (val) => { if (val?.trim()) renameThread(t.id, val.trim()); } },
        ],
        'plain-text',
        t.title,
      );
    } else {
      renameThread(t.id, (t.title || 'Chat') + ' *');
    }
  }

  function onDelete(t) {
    Haptic.trigger('impactMedium');
    Alert.alert(
      'Delete chat?',
      `"${t.title || 'Untitled'}" will be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              setBusyId(t.id);
              deleteThread(t.id);
            } finally {
              setBusyId(null);
            }
          }
        },
      ]
    );
  }

  const renderItem = ({ item: t }) => {
    const isActive = t.id === activeThreadId;

    return (
      <TouchableOpacity
        onPress={() => openThread(t)}
        onLongPress={() => onRename(t)}
        style={[styles.row, isActive && styles.active]}
      >
        <View style={styles.rowMain}>
          <Text style={styles.title} numberOfLines={1}>{t.title || 'Untitled'}</Text>
          <Text style={styles.preview} numberOfLines={1}>{betterPreview(t.messages)}</Text>
        </View>
        <View style={styles.rowMeta}>
          <Text style={styles.time}>{formatRelative(t.updatedAt || Date.now())}</Text>
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => {
              Haptic.trigger('selection');
              pinThread(t.id, !t.pinned);
              if (!t.title?.startsWith('📌') && !t.pinned) {
                renameThread(t.id, `📌 ${t.title || 'Chat'}`);
              } else if (t.title?.startsWith('📌')) {
                renameThread(t.id, t.title.replace(/^📌\s*/, ''));
              }
            }} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Text style={styles.action}>{t.pinned ? '📌' : '📍'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onRename(t)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Text style={styles.action}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete(t)} disabled={busyId === t.id} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Text style={[styles.action, styles.trash]}>{busyId === t.id ? '…' : '🗑️'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerWrap}>
        <Text style={styles.header}>History</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search chats…"
          placeholderTextColor="#9CA3AF"
          style={styles.search}
        />
        <TouchableOpacity onPress={onNew} style={styles.newBtn}>
          <Text style={styles.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={filtered.length ? null : styles.emptyWrap}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No chats yet</Text>
            <Text style={styles.emptyText}>Start your first conversation.</Text>
            <TouchableOpacity onPress={onNew} style={[styles.newBtn, { marginTop: 12 }]}>
              <Text style={styles.newBtnText}>Start chat</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor: colors.background },
  headerWrap:{
    flexDirection:'row', alignItems:'center', gap:8,
    paddingHorizontal:12, paddingTop:14, paddingBottom:8,
    backgroundColor: colors.surface, borderBottomWidth:1, borderBottomColor: colors.border
  },
  header:{ fontSize:22, fontWeight:'700', color: colors.text },
  search:{
    flex:1, marginLeft:8, borderWidth:1, borderColor: colors.border,
    backgroundColor: colors.inputBackground, borderRadius:10, paddingHorizontal:10, paddingVertical:6,
    fontSize:14, color: colors.inputText
  },
  newBtn:{ backgroundColor: colors.primary, paddingHorizontal:12, paddingVertical:8, borderRadius:10 },
  newBtnText:{ color: colors.buttonText, fontWeight:'600' },

  row:{ paddingHorizontal:16, paddingVertical:12, backgroundColor: colors.surface },
  active:{ backgroundColor: colors.primary + '20' },
  rowMain:{ marginBottom:6 },
  title:{ fontSize:16, fontWeight:'600', color: colors.text },
  preview:{ fontSize:13, color: colors.textSecondary, marginTop:2 },

  rowMeta:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  time:{ fontSize:12, color: colors.textMuted },
  actions:{ flexDirection:'row', gap:10 },
  action:{ fontSize:16, color: colors.textMuted },
  trash:{ color: colors.error },

  sep:{ height:1, backgroundColor: colors.border },

  emptyWrap:{ flexGrow:1, justifyContent:'center', alignItems:'center', padding:24 },
  empty:{ alignItems:'center' },
  emptyTitle:{ fontSize:18, fontWeight:'700', color: colors.text },
  emptyText:{ fontSize:14, color: colors.textSecondary, marginTop:4 },
});

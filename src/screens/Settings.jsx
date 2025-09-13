import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, Platform, FlatList,
} from 'react-native';
import Slider from '@react-native-community/slider';
import Haptic from 'react-native-haptic-feedback';

import { fetchModels } from '../api/models';
import DEFAULT_MODELS from '../config/models';
import { groupModels } from '../lib/models';
import { useSettingsStore } from '../state/useSettingsStore';
import { useThreadsStore } from '../state/useThreadsStore';
import { APP_VERSION } from '../config/appInfo';
import { colors } from '../styles/colors';

function ModelRow({ item, active, onPress }) {
  const caps = item.caps || {};
  return (
    <TouchableOpacity onPress={onPress} style={[styles.modelRow, active && styles.modelRowActive]} activeOpacity={0.9}>
      <View style={{ flex: 1 }}>
        <Text style={styles.modelName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.modelKey} numberOfLines={1}>{item.key}</Text>
      </View>
      <View style={styles.badges}>
        {caps.text && <Text style={styles.badge}>TXT</Text>}
        {caps.image && <Text style={[styles.badge, styles.badgeUnsupported]}>IMG</Text>}
        {caps.audio && <Text style={[styles.badge, styles.badgeUnsupported]}>AUD</Text>}
        {caps.video && <Text style={styles.badge}>VID</Text>}
      </View>
      <Text style={[styles.radio, active && styles.radioActive]}>{active ? '●' : '○'}</Text>
    </TouchableOpacity>
  );
}

export default function Settings() {
  const model = useSettingsStore(s => s.model);
  const setModel = useSettingsStore(s => s.setModel);
  const temperature = useSettingsStore(s => s.temperature);           // global default (fallback)
  const perModelTemp = useSettingsStore(s => s.perModelTemp);
  const setModelTemp = useSettingsStore(s => s.setModelTemp);
  const clearModelTemp = useSettingsStore(s => s.clearModelTemp);
  const setTemperature = useSettingsStore(s => s.setTemperature);
  const getEffectiveTemp = useSettingsStore(s => s.getEffectiveTemp);
  const models = useSettingsStore(s => s.models);
  const setModels = useSettingsStore(s => s.setModels);

  const effectiveTemp = getEffectiveTemp(model);
  const hasCustom = perModelTemp?.[model] != null;

  const clearThreads = useThreadsStore(s => s.reset);
  const [filter, setFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');

  // Fetch once; guard redundant updates
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const incoming = await fetchModels({ signal: ac.signal });
        
        if (incoming && typeof incoming === 'object' && Object.keys(incoming).length > 0) {
          const current = useSettingsStore.getState().models;
          const same =
            Object.keys(incoming).length === Object.keys(current || {}).length &&
            JSON.stringify(incoming) === JSON.stringify(current || {});
          if (!same) {
            setModels(incoming);
          }
        } else {
          // Ensure we have default models if fetch fails
          const current = useSettingsStore.getState().models;
          if (!current || Object.keys(current).length === 0) {
            setModels(DEFAULT_MODELS);
          }
        }
      } catch (error) {
        console.error('Settings - error fetching models:', error);
        // Fallback to defaults on error
        const current = useSettingsStore.getState().models;
        if (!current || Object.keys(current).length === 0) {
          setModels(DEFAULT_MODELS);
        }
      }
    })();
    return () => ac.abort();
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilter(filter);
    }, 150);

    return () => clearTimeout(timer);
  }, [filter]);

  // Group and flatten into a single list (headers + models)
  const flatRows = useMemo(() => {
    try {
      // Early return if no models
      if (!models || Object.keys(models).length === 0) {
        return [];
      }

      const grouped = groupModels(models);
      const needle = debouncedFilter.trim().toLowerCase();
      const rows = [];

      Object.entries(grouped).forEach(([provider, items]) => {
        const filtered = needle
          ? items.filter(i =>
              i.name.toLowerCase().includes(needle) || i.key.toLowerCase().includes(needle)
            )
          : items;
        if (!filtered.length) return;
        rows.push({ type: 'header', id: `h-${provider}`, title: provider });
        filtered.forEach(i => rows.push({ type: 'model', id: i.key, ...i }));
      });

      return rows;
    } catch (error) {
      console.error('Settings - error computing flatRows:', error);
      return [];
    }
  }, [models, debouncedFilter]);

  function onPick(mKey) {
    Haptic.trigger('selection');
    setModel(mKey);
  }

  async function onClearAll() {
    Alert.alert(
      'Clear all data?',
      'This removes all chats and local settings (keeps device id).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearThreads?.();
              await useSettingsStore.getState().reset();
            } catch {}
          }
        }
      ]
    );
  }

  // ---- List header and footer (static content) ----
  const ListHeader = (
    <>
      <View style={styles.header}><Text style={styles.headerText}>Settings</Text></View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Model</Text>
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder="Search models…"
          placeholderTextColor="#9CA3AF"
          style={styles.search}
        />
      </View>
    </>
  );

  const ListFooter = (
    <>
      {/* Temperature for the CURRENT model */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Temperature for current model</Text>
        <Text style={styles.helper}>
          {hasCustom ? `Custom for ${model}` : `Using default ${temperature.toFixed(2)}`}
        </Text>

        <View style={{ paddingHorizontal: 6, paddingTop: 6 }}>
          <Slider
            value={effectiveTemp}
            onValueChange={(v) => setModelTemp(model, Math.round(v * 100) / 100)}
            minimumValue={0}
            maximumValue={1}
            step={0.01}
            minimumTrackTintColor="#0A66FF"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor={Platform.OS === 'ios' ? '#fff' : '#0A66FF'}
            style={{ height: 40 }}
          />
        </View>

        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:16}}>
          <Text style={styles.value}>{effectiveTemp.toFixed(2)}</Text>
          {hasCustom && (
            <TouchableOpacity onPress={() => clearModelTemp(model)} style={styles.linkBtn}>
              <Text style={styles.linkBtnText}>Reset to default</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* (Optional) Global default fallback */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Default temperature (fallback)</Text>
        <Text style={styles.helper}>Used by models without a custom override</Text>

        <View style={{ paddingHorizontal: 6, paddingTop: 6 }}>
          <Slider
            value={temperature}
            onValueChange={(v) => setTemperature(Math.round(v * 100) / 100)}
            minimumValue={0}
            maximumValue={1}
            step={0.01}
            minimumTrackTintColor="#0A66FF"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor={Platform.OS === 'ios' ? '#fff' : '#0A66FF'}
            style={{ height: 40 }}
          />
        </View>
        <Text style={styles.value}>{temperature.toFixed(2)}</Text>
      </View>

      {/* Danger zone */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Danger zone</Text>
        <TouchableOpacity onPress={onClearAll} style={styles.clearBtn}>
          <Text style={styles.clearBtnText}>Clear all chats & settings</Text>
        </TouchableOpacity>
      </View>

      {/* About */}
      <View style={styles.block}>
        <Text style={styles.blockTitle}>About</Text>
        <Text style={styles.about}>Version {APP_VERSION}</Text>
        <Text style={styles.aboutLink}>Privacy Policy</Text>
      </View>
    </>
  );

  const renderItem = ({ item }) => {
    if (item.type === 'header') {
      return <Text style={styles.sectionHeader}>{item.title}</Text>;
    }
    return (
      <ModelRow
        item={item}
        active={model === item.key}
        onPress={() => onPick(item.key)}
      />
    );
  };

  const getItemLayout = (data, index) => {
    const item = data?.[index];
    const height = item?.type === 'header' ? 32 : 60; // header: 32px, model row: 60px
    return {
      length: height,
      offset: height * index,
      index,
    };
  };

  return (
    <FlatList
      data={flatRows}
      keyExtractor={(row) => row.id}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      ListHeaderComponent={ListHeader}
      ListFooterComponent={ListFooter}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 12, backgroundColor: colors.background }}
      // IMPORTANT: no sticky headers, no nested lists, no extra ScrollView
    />
  );
}

const styles = StyleSheet.create({
  header:{ paddingHorizontal:16, paddingTop:16, paddingBottom:8, backgroundColor: colors.surface, borderBottomWidth:1, borderBottomColor: colors.border },
  headerText:{ fontSize:22, fontWeight:'700', color: colors.text },

  block:{ backgroundColor: colors.surface, paddingBottom:8, borderTopWidth:1, borderBottomWidth:1, borderColor: colors.border },
  blockTitle:{ fontSize:14, fontWeight:'700', color: colors.textMuted, paddingHorizontal:16, paddingTop:10, textTransform:'uppercase' },
  helper:{ fontSize:12, color: colors.textMuted, paddingHorizontal:16, marginTop:4 },
  value:{ fontSize:12, color: colors.text, paddingHorizontal:16, marginTop:2 },

  search:{ margin:12, borderWidth:1, borderColor: colors.border, backgroundColor: colors.inputBackground, borderRadius:10, paddingHorizontal:12, paddingVertical:8, fontSize:14, color: colors.inputText },
  sectionHeader:{ fontSize:12, color: colors.textMuted, paddingHorizontal:16, paddingVertical:6, backgroundColor: colors.surfaceElevated, borderTopWidth:1, borderColor: colors.border },

  modelRow:{ flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:12, backgroundColor: colors.surface, borderTopWidth:1, borderColor: colors.border },
  modelRowActive:{ backgroundColor: colors.primary + '20' },
  modelName:{ fontSize:15, fontWeight:'600', color: colors.text },
  modelKey:{ fontSize:12, color: colors.textSecondary },
  badges:{ flexDirection:'row', gap:6, marginLeft:8, marginRight:12 },
  badge:{ fontSize:10, color: colors.text, backgroundColor: colors.surfaceElevated, paddingHorizontal:6, paddingVertical:2, borderRadius:6 },
  badgeUnsupported:{ color: colors.textMuted, backgroundColor: colors.surfaceElevated },
  radio:{ fontSize:18, color: colors.textMuted },
  radioActive:{ color: colors.primary },

  clearBtn:{ marginHorizontal:16, marginTop:10, backgroundColor: colors.error + '20', paddingVertical:10, borderRadius:10, borderWidth:1, borderColor: colors.error, alignItems:'center' },
  clearBtnText:{ color: colors.error, fontWeight:'700' },

  about:{ fontSize:14, color: colors.text, paddingHorizontal:16, paddingTop:6, backgroundColor: colors.surface },
  aboutLink:{ fontSize:14, color: colors.primary, paddingHorizontal:16, paddingTop:4, paddingBottom:10, backgroundColor: colors.surface },
  linkBtn:{ paddingVertical:6, paddingHorizontal:10, borderRadius:8, backgroundColor: colors.primary + '20' },
  linkBtnText:{ color: colors.primary, fontWeight:'600' },
});

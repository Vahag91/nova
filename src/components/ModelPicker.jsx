import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList } from 'react-native';
import { useSettingsStore } from '../state/useSettingsStore';

function groupByProvider(modelsObj) {
  const groups = {};
  Object.entries(modelsObj).forEach(([key, m]) => {
    const group = m?.display?.group || m?.provider || 'Other';
    if (!groups[group]) groups[group] = [];
    groups[group].push({ key, ...m });
  });
  // sort within groups by display name
  Object.values(groups).forEach(arr => arr.sort((a,b) => (a.display?.name || a.key).localeCompare(b.display?.name || b.key)));
  return groups;
}

export default function ModelPicker({ onSelected }) {
  const models = useSettingsStore(s => s.models);
  const currentModel = useSettingsStore(s => s.model);
  const setModel = useSettingsStore(s => s.setModel);

  const [q, setQ] = useState('');
  const grouped = useMemo(() => groupByProvider(models), [models]);

  const providers = Object.keys(grouped).sort();
  const filterFn = (m) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return (
      (m.display?.name || '').toLowerCase().includes(needle) ||
      (m.key || '').toLowerCase().includes(needle) ||
      (m.provider || '').toLowerCase().includes(needle)
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select a model</Text>
      <TextInput
        style={styles.search}
        placeholder="Search models…"
        value={q}
        onChangeText={setQ}
        autoCorrect={false}
        autoCapitalize="none"
      />

      <FlatList
        data={providers}
        keyExtractor={(p) => p}
        renderItem={({ item: provider }) => {
          const items = grouped[provider].filter(filterFn);
          if (!items.length) return null;
          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{provider}</Text>
              {items.map((m) => {
                const isActive = m.key === currentModel;
                return (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.row, isActive && styles.active]}
                    onPress={() => {
                      setModel(m.key);
                      onSelected?.(m.key);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modelName}>{m.display?.name || m.key}</Text>
                      <View style={styles.badges}>
                        {m.caps?.text    ? <Text style={styles.badge}>text</Text> : null}
                        {m.caps?.image   ? <Text style={styles.badge}>image</Text> : null}
                        {m.caps?.audio   ? <Text style={styles.badge}>audio</Text> : null}
                        {m.caps?.video   ? <Text style={styles.badge}>video</Text> : null}
                      </View>
                    </View>
                    <Text style={styles.providerTag}>{m.provider}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, padding:16 },
  title:{ fontSize:20, fontWeight:'600', marginBottom:10 },
  search:{ borderWidth:1, borderColor:'#ddd', borderRadius:10, paddingHorizontal:12, paddingVertical:8, marginBottom:12 },
  section:{ marginBottom:18 },
  sectionTitle:{ fontSize:14, fontWeight:'600', color:'#666', marginBottom:8 },
  row:{ flexDirection:'row', alignItems:'center', padding:12, borderRadius:12, borderWidth:1, borderColor:'#eee', marginBottom:8 },
  active:{ borderColor:'#333', backgroundColor:'#f6f6f6' },
  modelName:{ fontSize:16, fontWeight:'500' },
  badges:{ flexDirection:'row', gap:8, marginTop:4 },
  badge:{ fontSize:12, backgroundColor:'#eee', paddingHorizontal:6, paddingVertical:2, borderRadius:6, overflow:'hidden' },
  providerTag:{ color:'#888', marginLeft:12 },
});

import React, { useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useSettingsStore } from '../../state/useSettingsStore';

export default function AssistantDetailsModal({ visible, preset, onClose, onUse }) {
  const { models, model: current, setModel } = useSettingsStore(s => ({
    models: s.models, model: s.model, setModel: s.setModel,
  }));
  const [picked, setPicked] = useState(preset?.suggestedModel || current);

  const grouped = useMemo(() => {
    const out = {};
    Object.entries(models || {}).forEach(([key, m]) => {
      const g = m.display?.group || m.provider || 'Other';
      if (!out[g]) out[g] = [];
      out[g].push({ key, name: m.display?.name || key });
    });
    Object.values(out).forEach(list => list.sort((a,b)=>a.name.localeCompare(b.name)));
    return out;
  }, [models]);

  if (!preset) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.title}>{preset.emoji} {preset.name}</Text>
        <TouchableOpacity onPress={onClose}><Text style={styles.close}>Close</Text></TouchableOpacity>
      </View>

      <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding:16 }}>
        <Text style={styles.sectionLabel}>Description</Text>
        <Text style={styles.body}>{preset.description}</Text>

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>System Prompt</Text>
        <View style={styles.promptBox}>
          <Text style={styles.prompt}>{preset.system}</Text>
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Choose Model</Text>
        {Object.entries(grouped).map(([provider, list]) => (
          <View key={provider} style={{ marginBottom: 8 }}>
            <Text style={styles.provider}>{provider}</Text>
            <View style={styles.modelRow}>
              {list.map(m => {
                const active = picked === m.key;
                return (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() => setPicked(m.key)}
                    style={[styles.modelChip, active && styles.modelChipActive]}
                  >
                    <Text style={[styles.modelChipText, active && styles.modelChipTextActive]} numberOfLines={1}>
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity onPress={onClose} style={[styles.btn, styles.secondary]}>
          <Text style={styles.btnTextSecondary}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { onUse(preset, picked); }}
          style={[styles.btn, styles.primary]}
        >
          <Text style={styles.btnTextPrimary}>Use Assistant</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingTop:16, paddingBottom:8, borderBottomWidth:1, borderBottomColor:'#E6E8EB', backgroundColor:'#fff' },
  title:{ fontSize:18, fontWeight:'700' },
  close:{ fontSize:16, color:'#0A66FF', fontWeight:'600' },
  sectionLabel:{ fontSize:12, fontWeight:'700', color:'#6B7280', textTransform:'uppercase' },
  body:{ fontSize:14, color:'#111827', marginTop:4 },
  promptBox:{ backgroundColor:'#F3F4F6', borderRadius:10, padding:12, marginTop:4, borderWidth:1, borderColor:'#E5E7EB' },
  prompt:{ fontSize:13, color:'#111827' },
  provider:{ fontSize:12, fontWeight:'700', color:'#6B7280', marginBottom:6 },
  modelRow:{ flexDirection:'row', flexWrap:'wrap', gap:8 },
  modelChip:{ borderWidth:1, borderColor:'#E5E7EB', backgroundColor:'#fff', paddingHorizontal:10, paddingVertical:6, borderRadius:999, maxWidth:'100%' },
  modelChipActive:{ backgroundColor:'#0A66FF', borderColor:'#0A66FF' },
  modelChipText:{ fontSize:12, color:'#111827' },
  modelChipTextActive:{ color:'#fff', fontWeight:'700' },

  footer:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:16, borderTopWidth:1, borderTopColor:'#E6E8EB', backgroundColor:'#fff' },
  btn:{ paddingHorizontal:14, paddingVertical:10, borderRadius:10 },
  primary:{ backgroundColor:'#0A66FF' },
  secondary:{ backgroundColor:'#F3F4F6' },
  btnTextPrimary:{ color:'#fff', fontWeight:'700' },
  btnTextSecondary:{ color:'#111827', fontWeight:'600' },
});

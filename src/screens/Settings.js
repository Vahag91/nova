import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { useSettingsStore } from '../state/useSettingsStore';
import ModelPicker from '../components/ModelPicker';

export default function Settings() {
  const model = useSettingsStore(s => s.model);
  const models = useSettingsStore(s => s.models);
  const temperature = useSettingsStore(s => s.temperature);
  const setTemperature = useSettingsStore(s => s.setTemperature);
  const [showPicker, setShowPicker] = useState(false);

  const modelName = models?.[model]?.display?.name || model;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Model</Text>
        <TouchableOpacity onPress={() => setShowPicker(true)}>
          <Text style={styles.value}>{modelName}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Temperature</Text>
        <Text style={styles.value}>{temperature}</Text>
        {/* You can add a slider later; keeping simple for now */}
      </View>

      <Modal visible={showPicker} animationType="slide">
        <View style={{ flex:1 }}>
          <View style={{ padding:12, flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
            <Text style={{ fontSize:18, fontWeight:'600' }}>Select model</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)}><Text style={{ fontSize:16 }}>Close</Text></TouchableOpacity>
          </View>
          <ModelPicker onSelected={() => setShowPicker(false)} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, padding:16 },
  title:{ fontSize:22, fontWeight:'700', marginBottom:12 },
  card:{ paddingVertical:10, borderBottomWidth:1, borderBottomColor:'#eee', marginBottom:8 },
  label:{ fontSize:14, color:'#777' },
  value:{ fontSize:16, fontWeight:'500', marginTop:4 },
});

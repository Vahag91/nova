import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import Haptic from 'react-native-haptic-feedback';
import { PRESETS } from '../data/presets';
import { useThreadsStore } from '../state/useThreadsStore';
import { useSettingsStore } from '../state/useSettingsStore';
import { colors } from '../styles/colors';

// system message shape (matches your message schema)
function newSystemMessage(text) {
  return {
    id: uuidv4(),
    role: 'system',
    type: 'text',
    content: text,
    attachments: [],
    meta: {},
    createdAt: Date.now(),
    job: null,
  };
}

export default function Assistants({ navigation }) {
  const createThread = useThreadsStore(s => s.createThread);
  const setActiveThread = useThreadsStore(s => s.setActiveThread);
  const addMessage = useThreadsStore(s => s.addMessage);
  const currentModel = useSettingsStore(s => s.model);

  console.log('Assistants: Rendering with', PRESETS.length, 'presets');

  async function usePreset(preset) {
    try {
      Haptic.trigger('impactLight');
      console.log('usePreset called with:', preset.name);
      
      // choose model: preset.suggestedModel -> current
      const model = preset.suggestedModel || currentModel;
      console.log('Using model:', model);

      // createThread should return the new thread
      const t = createThread({ title: preset.name, model });
      console.log('Created thread:', t.id);

      addMessage(t.id, newSystemMessage(preset.system));
      console.log('Added system message');
      
      setActiveThread(t.id);
      console.log('Set active thread');
      
      navigation?.navigate?.('Chat');
      console.log('Navigating to Chat');
    } catch (e) {
      console.log('usePreset error', e);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Assistants</Text>
      <Text style={styles.info}>Found {PRESETS.length} presets</Text>
      
      <ScrollView style={[styles.scroll, { backgroundColor: colors.background }]}>
        {PRESETS.map((preset) => (
          <TouchableOpacity 
            key={preset.id} 
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => usePreset(preset)}
          >
            <Text style={styles.emoji}>{preset.emoji}</Text>
            <Text style={styles.name}>{preset.name}</Text>
            <Text style={styles.desc}>{preset.description}</Text>
            <Text style={styles.category}>{preset.category}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background,
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    textAlign: 'center', 
    marginBottom: 10,
    color: colors.text,
  },
  info: { 
    fontSize: 16, 
    textAlign: 'center', 
    marginBottom: 20, 
    color: colors.textSecondary 
  },
  scroll: {
    flex: 1,
  },
  card: { 
    backgroundColor: colors.surface, 
    marginBottom: 12, 
    padding: 16, 
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emoji: { fontSize: 24, marginBottom: 8 },
  name: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: colors.text },
  desc: { fontSize: 14, color: colors.textSecondary, marginBottom: 8 },
  category: { fontSize: 12, color: colors.textMuted, fontStyle: 'italic' },
});
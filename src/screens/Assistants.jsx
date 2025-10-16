import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import SvgIcon from '../components/SvgIcon';
import { v4 as uuidv4 } from 'uuid';
import Haptic from 'react-native-haptic-feedback';
import { PRESETS } from '../data/presets';
import { useThreadsStore } from '../state/useThreadsStore';
import { useSettingsStore } from '../state/useSettingsStore';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const createThread = useThreadsStore(s => s.createThread);
  const setActiveThread = useThreadsStore(s => s.setActiveThread);
  const addMessage = useThreadsStore(s => s.addMessage);
  const currentModel = useSettingsStore(s => s.model);

  async function usePreset(preset) {
    try {
      // haptics can throw on some devices; make non-fatal
      try { Haptic.trigger('impactLight'); } catch {}

      const model = preset?.suggestedModel || currentModel;
      const title = preset?.name || 'Assistant';
      const sys = typeof preset?.system === 'string' ? preset.system : '';

      const tNew = createThread({ title, model });
      if (sys) addMessage(tNew.id, newSystemMessage(sys));

      setActiveThread(tNew.id);
      navigation?.navigate?.('Chat');
    } catch (e) {
      console.warn('usePreset failed', e);
      Alert.alert(
        t('assistants.errorTitle') || 'Something went wrong',
        t('assistants.errorMessage') || 'Could not start this assistant.'
      );
    }
  }

  const iconGradients = useMemo(() => [
    { from: '#6366F1', to: '#7C3AED' }, // indigo → purple
    { from: '#0EA5E9', to: '#06B6D4' }, // sky → cyan
    { from: '#10B981', to: '#16A34A' }, // emerald → green
    { from: '#F43F5E', to: '#DB2777' }, // rose → pink
    { from: '#F59E0B', to: '#EA580C' }, // amber → orange
  ], []);

  const IconGradient = ({ index }) => {
    const g = iconGradients[index % iconGradients.length];
    const gid = `assist_icon_${index}`;
    return (
      <Svg width={52} height={52} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={g.from} />
            <Stop offset="1" stopColor={g.to} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={52} height={52} rx={18} fill={`url(#${gid})`} />
      </Svg>
    );
  };

  function getTagColors(category) {
    switch (category) {
      case 'Everyday':
        return { fg: '#FFFFFF', bg: '#0EA5E9', border: 'rgba(56,189,248,0.4)' };
      case 'Life':
        return { fg: '#FFFFFF', bg: '#D946EF', border: 'rgba(232,121,249,0.4)' };
      case 'Health':
        return { fg: '#FFFFFF', bg: '#10B981', border: 'rgba(52,211,153,0.4)' };
      case 'School & Work':
        return { fg: '#000000', bg: '#F59E0B', border: 'rgba(251,191,36,0.4)' };
      case 'Coding':
        return { fg: '#FFFFFF', bg: '#6366F1', border: 'rgba(129,140,248,0.4)' };
      case 'Creative':
        return { fg: '#FFFFFF', bg: '#8B5CF6', border: 'rgba(167,139,250,0.4)' };
      default:
        return { fg: '#FFFFFF', bg: '#64748B', border: 'rgba(148,163,184,0.4)' };
    }
  }

  const categories = useMemo(() => {
    const set = new Set((PRESETS || []).map(p => p.category || 'General'));
    return ['All', ...Array.from(set)];
  }, []);

  const categoryKeyOf = (name) => {
    switch (name) {
      case 'Everyday': return 'everyday';
      case 'Life': return 'life';
      case 'Health': return 'health';
      case 'School & Work': return 'schoolWork';
      case 'Coding': return 'coding';
      case 'Creative': return 'creative';
      case 'General': return 'general';
      case 'All': return 'all';
      default: return String(name || '').toLowerCase();
    }
  };
  const labelForCategory = (name) => {
    if (name === 'All') return t('assistants.categoryAll');
    const key = categoryKeyOf(name);
    return t(`assistants.categories.${key}`, { defaultValue: name });
  };

  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredPresets = useMemo(() => {
    if (selectedCategory === 'All') return PRESETS;
    return PRESETS.filter(p => (p.category || 'General') === selectedCategory);
  }, [selectedCategory]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingVertical: 12 }}>
        <View style={styles.headerIntro}>
          <Svg pointerEvents="none" style={styles.headerIntroGlow}>
            <Defs>
              <LinearGradient id="assist_intro" x1="0" y1="1" x2="1" y2="0">
                <Stop offset="0" stopColor="rgba(37,99,235,0.45)" />
                <Stop offset="1" stopColor="rgba(124,58,237,0.38)" />
              </LinearGradient>
            </Defs>
            <Rect x={-24} y={-24} width="130%" height="150%" rx={28} fill="url(#assist_intro)" />
          </Svg>
          <Text style={styles.headerTitle}>{t('assistants.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('assistants.subtitle')}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryBar}
        >
          {categories.map(cat => {
            const isActive = cat === selectedCategory;
            const colors = cat !== 'All' ? getTagColors(cat) : null;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip, 
                  isActive && colors && {
                    backgroundColor: colors.bg,
                    borderColor: colors.border,
                  },
                  isActive && !colors && styles.categoryChipActive
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[
                  styles.categoryChipText, 
                  isActive && colors && { color: colors.fg },
                  isActive && !colors && styles.categoryChipTextActive
                ]} numberOfLines={1}>{labelForCategory(cat)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {filteredPresets.map((preset, idx) => (
          <TouchableOpacity 
            key={preset?.id || preset?.name || String(idx)}
            style={styles.card}
            activeOpacity={0.9}
            onPress={() => usePreset(preset)}
          >
            <View style={styles.cardRow}>
              <View style={styles.iconWrap}>
                <IconGradient index={idx} />
                <View style={styles.iconContent}>
                  {preset.icon ? (
                    <SvgIcon name={preset.icon} size={24} color="#FFFFFF" />
                  ) : (
                    <Text style={styles.iconEmoji}>{preset.emoji || '✨'}</Text>
                  )}
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{t(`assistants.presets.${preset.id}.name`, { defaultValue: preset.name })}</Text>
                <Text style={styles.cardDesc}>{t(`assistants.presets.${preset.id}.description`, { defaultValue: preset.description })}</Text>
              </View>
              {preset?.category ? (() => {
                const tag = getTagColors(preset.category);
                return (
                  <View style={[styles.tag, { 
                    backgroundColor: tag.bg,
                    borderColor: tag.border,
                  }]}> 
                    <Text style={[styles.tagText, { color: tag.fg }]}>{labelForCategory(preset.category)}</Text>
                  </View>
                );
              })() : null}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', paddingHorizontal: 16 },
  scroll: { flex: 1 },
  headerIntro: {
    marginBottom: 18,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
  },
  headerIntroGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#F9FAFB', fontFamily: 'Lato-Bold' },
  headerSubtitle: { fontSize: 14, color: 'white', marginTop: 6, lineHeight: 20, fontFamily: 'Lato-Regular' },
  categoryBar: { paddingVertical: 12, paddingHorizontal: 4, gap: 8, alignItems: 'center' },
  categoryChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: '#2B2F40', marginRight: 8, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  categoryChipActive: { backgroundColor: '#1F2937', borderColor: '#3B82F6' },
  categoryChipText: { color: '#9CA3AF', fontSize: 13, fontWeight: '700', textAlign: 'center', fontFamily: 'Lato-Bold', letterSpacing: 0.3 },
  categoryChipTextActive: { color: '#F9FAFB' },
  card: {
    backgroundColor: '#12141D', borderWidth: 1, borderColor: '#2B2F40', borderRadius: 18,
    paddingVertical: 22, paddingHorizontal: 18, marginBottom: 14, minHeight: 100,
    shadowColor: 'rgba(0,0,0,0.6)', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.35, shadowRadius: 22,
    elevation: 8, overflow: 'hidden', position: 'relative',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 18, position: 'relative', shadowColor: 'rgba(99,102,241,0.6)', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  iconContent: { justifyContent: 'center', alignItems: 'center' },
  iconEmoji: { fontSize: 20, color: '#FFFFFF' },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: 'rgba(249,250,251,0.95)', fontFamily: 'Lato-Bold' },
  cardDesc: { fontSize: 13, color: '#9CA3AF', marginTop: 6, fontFamily: 'Lato-Regular' },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, alignSelf: 'flex-start', borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  tagText: { fontSize: 9, fontWeight: '800', fontFamily: 'Lato-Bold', letterSpacing: 0.4, textTransform: 'uppercase' },
});

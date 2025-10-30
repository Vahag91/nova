import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import Haptic from 'react-native-haptic-feedback';
import { PRESETS } from '../data/presets';
import { useThreadsStore } from '../state/useThreadsStore';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import HeroVideo from '../components/navigation/HeroVideo';

const HEADER_VIDEOS = [
  require('../../assets/video/fitness.mp4'),
  require('../../assets/video/meels.mp4'),
];

export default function Assistants({ navigation }) {
  const { t } = useTranslation();
  const createThread = useThreadsStore(s => s.createThread);
  const updateThread = useThreadsStore(s => s.updateThread);
  const setActiveThread = useThreadsStore(s => s.setActiveThread);
  const isFocused = useIsFocused();
  const [headerRestartKey, setHeaderRestartKey] = useState(0);

  useEffect(() => {
    if (isFocused) setHeaderRestartKey(k => k + 1);
  }, [isFocused]);

  async function handleUsePreset(preset) {
    try {
      // haptics can throw on some devices; make non-fatal
      try { Haptic.trigger('impactLight'); } catch {}

      // App policy: assistants always use GPT-5 nano
      const model = 'gpt-5-nano';
      const title = preset?.name || 'Assistant';
      const sys = typeof preset?.system === 'string' ? preset.system : '';

      const tNew = createThread({ title, model, system: sys });
      // Pin model and persist stable metadata
      try {
        updateThread(tNew.id, {
          meta: {
            ...(tNew.meta || {}),
            pinnedModel: true,
            presetId: preset?.id || null,
            assistantName: title,
          }
        });
      } catch {}
      
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
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerIntro}>
          <HeroVideo
            style={styles.headerVideo}
            sources={HEADER_VIDEOS}
            restartKey={headerRestartKey}
            enforceAspectRatio={false}
            placeholderColor="#10121C"
          />
          <View style={styles.headerOverlay} />
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{t('assistants.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('assistants.subtitle')}</Text>
          </View>
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
            onPress={() => handleUsePreset(preset)}
          >
            <View style={styles.cardRow}>
              <View style={styles.iconWrap}>
                <Image
                  source={preset.avatar}
                  style={styles.iconPhoto}
                />
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
  scrollContent: { paddingVertical: 12 },
  headerIntro: {
    marginBottom: 20,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: '#10121C',
    position: 'relative',
    minHeight: 190,
  },
  headerVideo: { ...StyleSheet.absoluteFillObject },
  headerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12,14,26,0.54)' },
  headerContent: { paddingHorizontal: 24, paddingVertical: 26, gap: 10 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: '#F9FAFB', fontFamily: 'Lato-Bold', letterSpacing: 0.3 },
  headerSubtitle: { fontSize: 15, color: 'rgba(229,231,235,0.92)', lineHeight: 22, fontFamily: 'Lato-Regular' },
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
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    marginRight: 18,
    shadowColor: 'rgba(15,23,42,0.6)',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  iconPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    resizeMode: 'cover',
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: 'rgba(249,250,251,0.95)', fontFamily: 'Lato-Bold' },
  cardDesc: { fontSize: 13, color: '#9CA3AF', marginTop: 6, fontFamily: 'Lato-Regular' },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, alignSelf: 'flex-start', borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  tagText: { fontSize: 9, fontWeight: '800', fontFamily: 'Lato-Bold', letterSpacing: 0.4, textTransform: 'uppercase' },
});

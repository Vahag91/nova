import React, { useEffect, useMemo, useState, useContext, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, FlatList } from 'react-native';
import Haptic from 'react-native-haptic-feedback';
import { PRESETS } from '../data/presets';
import { useThreadsStore } from '../state/useThreadsStore';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import HeroVideo from '../components/navigation/HeroVideo';
import { colors as palette } from '../styles/colors';
import { SubscriptionAccessContext } from '../context/SubscriptionContext';
import { isAssistantsPremium } from '../config/premium';
import { setPendingPremiumAction } from '../state/premiumActions';
import { useAndroidNavigationMenu } from '../navigation/AndroidNavigationMenuContext';
import { perfLog } from '../lib/perfTrace';
import { resolvePremiumStatus } from '../lib/resolvePremiumStatus';
import { DEFAULT_CHAT_MODEL } from '../config/models';

const HEADER_VIDEOS = [
  require('../../assets/video/fitness.mp4'),
  require('../../assets/video/meels.mp4'),
];

export default function Assistants({ navigation }) {
  const { t } = useTranslation();
  const subscription = useContext(SubscriptionAccessContext);
  const { reportScreenReady } = useAndroidNavigationMenu();
  const createThread = useThreadsStore(s => s.createThread);
  const updateThread = useThreadsStore(s => s.updateThread);
  const setActiveThread = useThreadsStore(s => s.setActiveThread);
  const isFocused = useIsFocused();
  const rootLayoutSeenRef = React.useRef(false);
  const screenReadyReportedRef = React.useRef(false);
  const [headerRestartKey, setHeaderRestartKey] = useState(0);
  const [rootLayoutLogged, setRootLayoutLogged] = useState(false);
  const [headerLayoutLogged, setHeaderLayoutLogged] = useState(false);
  const [contentSizeLogged, setContentSizeLogged] = useState(false);

  useEffect(() => {
    perfLog('assistants.screen.mounted');
    return () => {
      perfLog('assistants.screen.unmounted');
    };
  }, []);

  useEffect(() => {
    perfLog('assistants.screen.focus', {
      isFocused,
    });
    if (isFocused) {
      setHeaderRestartKey(k => k + 1);
      setRootLayoutLogged(false);
      setHeaderLayoutLogged(false);
      setContentSizeLogged(false);
      screenReadyReportedRef.current = false;
      if (rootLayoutSeenRef.current) {
        requestAnimationFrame(() => {
          if (!screenReadyReportedRef.current) {
            reportScreenReady('Assistants');
            screenReadyReportedRef.current = true;
          }
        });
      }
    }
  }, [isFocused, reportScreenReady]);

  const startAssistantPreset = useCallback(async (preset) => {
    try {
      try { Haptic.trigger('impactLight'); } catch {}
      const model = preset?.suggestedModel || DEFAULT_CHAT_MODEL;
      const title = preset?.name || t('assistants.defaultTitle');
      const sys = typeof preset?.system === 'string' ? preset.system : '';

      const tNew = createThread({ title, model, system: sys });
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
      Alert.alert(
        t('assistants.errorTitle'),
        t('assistants.errorMessage'),
      );
    }
  }, [createThread, navigation, setActiveThread, t, updateThread]);

  const handleUsePreset = useCallback(async (preset) => {
    const needsPremium = isAssistantsPremium();
    const hasPremiumAccess = needsPremium
      ? await resolvePremiumStatus(subscription)
      : true;

    perfLog('assistants.preset.press', {
      presetId: preset?.id,
      premiumGate: !hasPremiumAccess && needsPremium,
    });
    if (!hasPremiumAccess && needsPremium) {
      setPendingPremiumAction(() => {
        startAssistantPreset(preset);
      });
      try {
        navigation.navigate('PaywallScreen', { returnTo: 'Assistants' });
      } catch (e) {
        // Navigation error handled silently
      }
      return;
    }
    startAssistantPreset(preset);
  }, [navigation, startAssistantPreset, subscription]);

  const categories = useMemo(() => {
    const set = new Set((PRESETS || []).map(p => p.category || 'General'));
    return ['All', ...Array.from(set)];
  }, []);

  const categoryKeyOf = useCallback((name) => {
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
  }, []);
  const labelForCategory = useCallback((name) => {
    if (name === 'All') return t('assistants.categoryAll');
    const key = categoryKeyOf(name);
    return t(`assistants.categories.${key}`, { defaultValue: name });
  }, [categoryKeyOf, t]);

  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredPresets = useMemo(() => {
    // Show all assistants - gate on click instead
    if (selectedCategory === 'All') return PRESETS;
    return PRESETS.filter(p => (p.category || 'General') === selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    perfLog('assistants.list.snapshot', {
      category: selectedCategory,
      visiblePresets: filteredPresets.length,
      totalPresets: PRESETS.length,
      headerMedia: 'video',
    });
  }, [filteredPresets.length, selectedCategory]);

  const renderPreset = useCallback(({ item, index }) => (
    <TouchableOpacity
      key={item?.id || item?.name || String(index)}
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => handleUsePreset(item)}
    >
      <View style={styles.cardRow}>
        <View style={styles.iconWrap}>
          <Image
            source={item.avatar}
            style={styles.iconPhoto}
          />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{t(`assistants.presets.${item.id}.name`, { defaultValue: item.name })}</Text>
          <Text style={styles.cardDesc}>{t(`assistants.presets.${item.id}.description`, { defaultValue: item.description })}</Text>
        </View>
        {item?.category ? (
          <View style={styles.tag}>
            <Text numberOfLines={1} style={styles.tagText}>
              {labelForCategory(item.category)}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  ), [handleUsePreset, labelForCategory, t]);

  const listHeader = useMemo(() => (
    <View
      onLayout={() => {
        if (headerLayoutLogged) return;
        setHeaderLayoutLogged(true);
        perfLog('assistants.header.layout');
      }}
    >
      <View style={styles.headerIntro}>
        <HeroVideo
          style={styles.headerVideo}
          sources={HEADER_VIDEOS}
          restartKey={headerRestartKey}
          paused={!isFocused}
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
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, isActive && styles.categoryChipActive]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => setSelectedCategory(cat)}
              onPressIn={() => perfLog('assistants.category.press', { category: cat })}
            >
              <Text
                style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}
                numberOfLines={1}
              >
                {labelForCategory(cat)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  ), [
    categories,
    headerLayoutLogged,
    headerRestartKey,
    isFocused,
    labelForCategory,
    selectedCategory,
    t,
  ]);

  return (
    <View
      style={styles.container}
      onLayout={() => {
        if (rootLayoutLogged) return;
        setRootLayoutLogged(true);
        rootLayoutSeenRef.current = true;
        perfLog('assistants.root.layout');
        if (isFocused && !screenReadyReportedRef.current) {
          reportScreenReady('Assistants');
          screenReadyReportedRef.current = true;
        }
      }}
    >
      <FlatList
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        data={filteredPresets}
        renderItem={renderPreset}
        keyExtractor={(item, index) => item?.id || item?.name || String(index)}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {t('assistants.noAssistants', { defaultValue: 'No assistants found in this category.' })}
            </Text>
          </View>
        )}
        removeClippedSubviews={false}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={50}
        windowSize={5}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={(_, height) => {
          if (contentSizeLogged) return;
          setContentSizeLogged(true);
          perfLog('assistants.list.content_size', {
            height,
            items: filteredPresets.length,
          });
        }}
      />
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
    backgroundColor: '#10121C',
    position: 'relative',
    minHeight: 190,
  },
  headerVideo: { ...StyleSheet.absoluteFillObject },
  headerVideoPlaceholder: { backgroundColor: '#10121C' },
  headerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12,14,26,0.54)' },
  headerContent: { paddingHorizontal: 24, paddingVertical: 26, gap: 10 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: '#F9FAFB', fontFamily: 'Lato-Bold', letterSpacing: 0.3 },
  headerSubtitle: { fontSize: 15, color: 'rgba(229,231,235,0.92)', lineHeight: 22, fontFamily: 'Lato-Regular' },
  categoryBar: { paddingTop: 4, paddingBottom: 16, gap: 8, alignItems: 'center' },
  categoryChip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: palette.surface,
  },
  categoryChipActive: { backgroundColor: palette.primary },
  categoryChipText: { color: '#E4E4E6', fontSize: 15, lineHeight: 20, textAlign: 'center' },
  categoryChipTextActive: { color: '#FFFFFF', fontWeight: '500' },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginRight: 14,
    backgroundColor: palette.surfaceInset,
  },
  iconPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    resizeMode: 'cover',
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: '500', color: '#FFFFFF' },
  cardDesc: { fontSize: 14, lineHeight: 19, color: palette.textSecondary, marginTop: 2 },
  tag: {
    maxWidth: '36%',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginStart: 8,
    backgroundColor: palette.surfaceInset,
  },
  tagText: { fontSize: 11, lineHeight: 14, color: palette.textSecondary },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: palette.textSecondary,
    textAlign: 'center',
  },
});

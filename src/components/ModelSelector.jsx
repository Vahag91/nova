// app/src/components/ModelSelector.jsx
import React, { useMemo, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Modal,
  StyleSheet,
  Platform,
  Dimensions,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Haptic from 'react-native-haptic-feedback';
import { useSettingsStore } from '../state/useSettingsStore';
import { colors } from '../styles/colors';
import SvgIcon from './SvgIcon';
import { useTranslation } from 'react-i18next';

// 🔁 Reanimated
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  Easing,
  runOnJS,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';

export default function ModelSelector() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // store
  const models = useSettingsStore(s => s.models);
  const modelKey = useSettingsStore(s => s.model);
  const setModel = useSettingsStore(s => s.setModel);

  // ui
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // reanimated shared values
  const overlay = useSharedValue(0);       // 0..1
  const dropY = useSharedValue(-36);       // translateY
  const sheetScale = useSharedValue(0.985);
  const sheetProgress = useSharedValue(0); // 0..1 (use for opacity / content)
  const rotateArrow = useSharedValue(0);   // 0 closed, 1 open
  const triggerScale = useSharedValue(1);  // trigger micro-bounce

  const listRef = useRef(null);

  // current trigger label
  const current = useMemo(() => {
    const info = models?.[modelKey] || {};
    return {
      name: info.display?.name || modelKey,
      icon: glyphFor(info?.provider, modelKey),
    };
  }, [models, modelKey]);

  // build + group
  const sections = useMemo(() => {
    if (!models || Object.keys(models).length === 0) {
      return [{ type: 'empty', id: 'empty', message: t('modelSelector.noModelsAvailable') }];
    }

    const toRow = ([key, info]) => ({
      key,
      name: info?.display?.name || key,
      desc: t(`models.${key}`, { defaultValue: descriptionFor(key, info) }),
      icon: glyphFor(info?.provider, key),
      labels: labelsFor(key, t),
      provider: (info?.provider || 'other').toLowerCase(),
    });

    let filteredModels = Object.entries(models)
      .filter(([_, info]) => info?.kind === 'chat')
      .map(toRow);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filteredModels = filteredModels.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.desc.toLowerCase().includes(q) ||
        m.provider.includes(q)
      );
    }

    if (filteredModels.length === 0) {
      return [{ type: 'empty', id: 'empty', message: t('modelSelector.noModelsFound') }];
    }
    const order = ['openai', 'anthropic', 'google', 'xai', 'deepseek', 'other'];
    const grouped = filteredModels.reduce((acc, r) => {
      (acc[r.provider] = acc[r.provider] || []).push(r);
      return acc;
    }, {});
    order.forEach(p => (grouped[p] || []).sort((a, b) => a.name.localeCompare(b.name)));

    const out = [];
    order.forEach(p => {
      const set = grouped[p];
      if (set?.length) {
        out.push({ type: 'header', id: `hdr-${p}`, title: titleForProvider(p) });
        set.forEach(row => out.push({ type: 'row', ...row }));
      }
    });
    return out;
  }, [models, searchQuery]);

  // —— Animations ——
  const scrollToSelected = useCallback(() => {
    const idx = sections.findIndex(r => r.type === 'row' && r.key === modelKey);
    if (idx >= 0) setTimeout(() => listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 }), 60);
  }, [sections, modelKey]);

  const runOpen = useCallback(() => {
    // trigger micro interaction
    triggerScale.value = withSequence(
      withTiming(0.96, { duration: 80, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 12, stiffness: 280 })
    );

    setOpen(true);
    // animate in
    overlay.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
    dropY.value = withSpring(0, { damping: 14, stiffness: 160, mass: 0.9 });
    sheetScale.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    sheetProgress.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(scrollToSelected)();
    });
    rotateArrow.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });

    Haptic.trigger('selection');
  }, [overlay, dropY, sheetScale, sheetProgress, rotateArrow, triggerScale, scrollToSelected]);

  const runClose = useCallback(() => {
    setSearchQuery('');
    // animate out
    overlay.value = withTiming(0, { duration: 160, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(setOpen)(false);
    });
    dropY.value = withTiming(-36, { duration: 200, easing: Easing.in(Easing.cubic) });
    sheetScale.value = withTiming(0.985, { duration: 180, easing: Easing.in(Easing.cubic) });
    sheetProgress.value = withTiming(0, { duration: 140, easing: Easing.in(Easing.cubic) });
    rotateArrow.value = withTiming(0, { duration: 160, easing: Easing.in(Easing.cubic) });
  }, [overlay, dropY, sheetScale, sheetProgress, rotateArrow]);

  // —— Animated styles ——
  const triggerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: triggerScale.value }],
  }));

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotateArrow.value * 180}deg` }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlay.value,
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dropY.value }, { scale: sheetScale.value }],
    opacity: sheetProgress.value,
  }));

  // —— render —— //
  const renderItem = ({ item, index }) => {
    if (item.type === 'empty') {
      return (
        <Animated.View entering={FadeIn.duration(180)}>
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>{t('modelSelector.noModelsFound')}</Text>
            <Text style={styles.emptyMessage}>{item.message}</Text>
          </View>
        </Animated.View>
      );
    }

    if (item.type === 'header') {
      return (
        <Animated.View
          key={item.id}
          entering={FadeInDown.delay(index * 30).duration(180)}
          style={styles.sectionHeader}
        >
          <Text style={styles.sectionTitle}>{t(`providers.${item.title.toLowerCase()}`, { defaultValue: item.title })}</Text>
        </Animated.View>
      );
    }

    const selected = item.key === modelKey;
    const next = sections[index + 1];
    const showDivider = next && next.type === 'row';

    return (
      <Animated.View entering={FadeInDown.delay(index * 40).duration(220)}>
        <Pressable
          onPress={() => {
            if (item.key !== modelKey) Haptic.trigger('notificationSuccess');
            else Haptic.trigger('selection');
            
            setModel(item.key);
            runClose();
          }}
          android_ripple={{ color: '#1A1A1D' }}
          style={({ pressed }) => [
            styles.cardRow,
            selected && styles.cardRowSelected,
            pressed && styles.cardRowPressed,
          ]}
          accessibilityRole="menuitem"
          accessibilityState={{ selected }}
          accessibilityLabel={t('modelSelector.modelLabel', { name: item.name })}
          accessibilityHint={selected ? t('modelSelector.currentlySelected') : t('modelSelector.selectHint', { name: item.name })}
        >
          <SvgIcon name={item.icon} size={22} color={colors.textSecondary} />

          <View style={{ flex: 1 }}>
            <View style={styles.titleBar}>
              <Text numberOfLines={1} style={[styles.rowTitle, selected && styles.rowTitleSel]}>
                {item.name}
              </Text>
              {!!item.labels?.length && (
                <View style={styles.badgeWrap}>
                  {item.labels.map(lbl => (
                    <View
                      key={lbl}
                      style={[
                        styles.badge,
                        lbl === 'NEW' && styles.badgeNew,
                        lbl === 'BEST' && styles.badgeBest,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          lbl === 'NEW' && styles.badgeTextNew,
                          lbl === 'BEST' && styles.badgeTextBest,
                        ]}
                      >
                        {lbl}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
            <Text numberOfLines={2} style={[styles.rowDesc, selected && styles.rowDescSel]}>
              {item.desc}
            </Text>
          </View>

          {selected ? <SvgIcon name="check" size={18} color={colors.primary} /> : null}
        </Pressable>

        {showDivider && <View style={styles.divider} />}
      </Animated.View>
    );
  };

  const keyExtractor = it => (it.type === 'header' ? it.id : it.key);

  return (
    <>
      {/* Trigger pill */}
      <Animated.View style={triggerStyle}>
        <Pressable
          style={styles.trigger}
          onPress={runOpen}
          accessibilityRole="button"
          accessibilityLabel={t('modelSelector.currentModel', { name: current.name })}
          accessibilityHint={t('modelSelector.openHint')}
        >
          <SvgIcon name={current.icon} size={22} color={colors.textSecondary} />
          <Text numberOfLines={1} style={styles.triggerText}>{current.name}</Text>
          <Animated.View style={[styles.arrowContainer, arrowStyle]}>
            <SvgIcon name="chevron-down" size={20} color={colors.textSecondary} />
          </Animated.View>
        </Pressable>
      </Animated.View>

      {/* Modal */}
      <Modal transparent visible={open} statusBarTranslucent animationType="none" onRequestClose={runClose}>
        {/* Overlay */}
        <Animated.View style={[styles.overlay, overlayStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={runClose} />
        </Animated.View>

        {/* Panel (top drop) */}
        <Animated.View
          style={[
            styles.panel,
            {
              marginTop: insets.top + 56,
              maxHeight: Math.min(Dimensions.get('window').height * 0.7, 468),
            },
            panelStyle,
          ]}
          accessibilityRole="dialog"
          accessibilityViewIsModal
          importantForAccessibility="yes"
        >
           {/* Header with close */}
           <View style={styles.panelHeader}>
             <View style={styles.panelHeaderRow}>
               <Text style={styles.panelTitle}>{t('modelSelector.title')}</Text>
               <Pressable hitSlop={10} onPress={runClose} accessibilityLabel={t('modelSelector.closeLabel')}>
                 <Text style={styles.close}>✕</Text>
               </Pressable>
             </View>
           </View>


          <FlatList
            ref={listRef}
            data={sections}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
            removeClippedSubviews
            initialNumToRender={12}
            windowSize={10}
          />
        </Animated.View>
      </Modal>
    </>
  );
}

/* ---------- helpers ---------- */
function glyphFor(provider, key) {
  const p = (provider || '').toLowerCase();
  const k = String(key || '').toLowerCase();
  if (/openai/.test(p) || /gpt/i.test(k)) return 'gpt';
  if (/anthropic/.test(p) || /claude/i.test(k)) return 'claude';
  if (/google/.test(p) || /gemini/i.test(k)) return 'gemini';
  if (/xai/.test(p) || /grok/i.test(k)) return 'grok';
  if (/deepseek/.test(p) || /deepseek/i.test(k)) return 'deepseek';
  return 'gpt';
}
function descriptionFor(key, info) {
  const map = {
    'gpt-5': 'Flagship general intelligence',
    'gpt-5-chat-latest': 'Flagship chat model (great streaming)',
    'gpt-5-mini': 'Fast, lower-cost GPT-5 tier',
    'gpt-5-nano': 'Ultra-cheap micro model for simple tasks',
    'o4-mini': 'Efficient reasoning model with strong quality',
    'gpt-4.1-mini': 'Compact GPT-4.1 family model',
    'gpt-4.1-nano': 'Tiny GPT-4.1 model for quick replies',
    'claude-3-haiku': 'Fast and efficient model',
    'claude-3.7-sonnet': 'Advanced reasoning model',
    'gemini-2.5-Flash': "Google's best model",
    'gemini-2.0-flash': 'Fast model with great reasoning',
  };
  return map[key] || `${info?.provider || 'AI'} model`;
}

function labelsFor(key, t) {
  const map = {
    'gpt-5': ['NEW', 'BEST'],
    'gpt-5-chat-latest': ['NEW', 'BEST'],
    'gpt-5-mini': ['NEW'],
    'gpt-5-nano': ['NEW'],
    'o4-mini': ['NEW'],
    'gpt-4.1-mini': [],
    'gpt-4.1-nano': [],
    'claude-3.7-sonnet': ['NEW'],
    'grok-4': ['NEW'],
    'gemini-2.5-flash': ['NEW'],
    'gemini-2.0-flash': ['NEW'],

  };

  return map[key] || [];
}

function titleForProvider(p) {
  if (p === 'openai') return 'OpenAI';
  if (p === 'anthropic') return 'Anthropic';
  if (p === 'google') return 'Google';
  if (p === 'xai') return 'xAI';
  if (p === 'deepseek') return 'DeepSeek';
  return 'Other';
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  /* trigger */
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: Platform.OS === 'ios' ? 9 : 7,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 13,
    marginBottom: 13,
  },
  triggerText: { maxWidth: 144, fontSize: 13, fontWeight: '700', color: colors.text },
  arrowContainer: { backgroundColor: colors.surface, borderRadius: 9, padding: 2 },

  /* overlay */
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },

  /* panel */
  panel: {
    alignSelf: 'center',
    width: '90%',
    maxWidth: 308,
    backgroundColor: '#0D0D0F',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
    borderWidth: 0,
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 29,
    shadowOpacity: Platform.OS === 'ios' ? 0.28 : 0.32,
    elevation: 22,
  },
  panelHeader: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 11,
    borderBottomWidth: 0,
    backgroundColor: '#0D0D0F',
  },
   panelHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
   panelTitle: { fontSize: 13, fontWeight: '800', color: colors.text, letterSpacing: 0.2 },
  close: { fontSize: 16, color: colors.text },

  /* search */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginVertical: 11,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: '#1A1A1D',
    borderRadius: 11,
    borderWidth: 0,
  },
  searchIcon: { fontSize: 14, color: colors.textSecondary, marginRight: 7 },
  searchInput: { flex: 1, fontSize: 13, color: colors.text, paddingVertical: 4 },
  clearButton: { padding: 4 },
  clearIcon: { fontSize: 13, color: colors.textSecondary },

  /* section header */
  sectionHeader: {
    paddingHorizontal: 14, paddingTop: 11, paddingBottom: 5,
    backgroundColor: '#0D0D0F', flexDirection: 'row', alignItems: 'center', gap: 7,
  },
  sectionTitle: {
    fontSize: 10, fontWeight: '800', letterSpacing: 0.5,
    color: colors.textSecondary, textTransform: 'uppercase',
  },

  /* row card */
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 11,
    paddingVertical: 11,
    backgroundColor: 'transparent',
    marginHorizontal: 5,
    marginVertical: 3,
    borderRadius: 11,
  },
  cardRowSelected: {
    backgroundColor: '#1A1A1D',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 7,
    shadowOpacity: 0.1,
    elevation: 4,
  },
  cardRowPressed: { backgroundColor: '#1A1A1D', transform: [{ scale: 0.98 }] },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#2D2D30', marginLeft: 43, marginRight: 7 },

  titleBar: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 2 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  rowTitleSel: { color: colors.primary },
  rowDesc: { fontSize: 12, color: colors.textSecondary },
  rowDescSel: { color: colors.text },

  /* chips */
  badgeWrap: { flexDirection: 'row', gap: 5, flexShrink: 0 },
  badge: {
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, shadowOpacity: 0.1, elevation: 2,
  },
  badgeNew: { backgroundColor: colors.primary + '20', borderColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.2 },
  badgeBest: { backgroundColor: '#6366F120', borderColor: '#6366F1', shadowColor: '#6366F1', shadowOpacity: 0.2 },
  badgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', color: colors.textSecondary, letterSpacing: 0.5 },
  badgeTextNew: { color: colors.primary },
  badgeTextBest: { color: '#6366F1' },

  /* empty */
  emptyState: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 18 },
  emptyIcon: { fontSize: 29, marginBottom: 11, opacity: 0.6 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 },
  emptyMessage: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
});

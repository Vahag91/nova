// app/src/components/ModelSelector.jsx
import React, { useMemo, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Modal,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  Dimensions,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Haptic from 'react-native-haptic-feedback';
import { useSettingsStore } from '../state/useSettingsStore';
import { colors } from '../styles/colors';
import SvgIcon from './SvgIcon';

export default function ModelSelector() {
  const insets = useSafeAreaInsets();

  // store
  const models = useSettingsStore(s => s.models);
  const modelKey = useSettingsStore(s => s.model);
  const setModel = useSettingsStore(s => s.setModel);
console.log(models,"models");
console.log(modelKey,"modelKey");

  // ui
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // anims
  const overlay = useRef(new Animated.Value(0)).current;     // 0..1
  const dropY = useRef(new Animated.Value(-36)).current;   // translateY
  const sheetFade = useRef(new Animated.Value(0)).current;     // 0..1
  const sheetScale = useRef(new Animated.Value(0.985)).current; // subtle scale-in
  const rotateArrow = useRef(new Animated.Value(0)).current;     // 0 closed, 1 open
  const triggerScale = useRef(new Animated.Value(1)).current;    // trigger button scale

  const listRef = useRef(null);

  // current trigger label
  const current = useMemo(() => {
    const info = models?.[modelKey] || {};
    return {
      name: info.display?.name || modelKey,
      icon: glyphFor(info?.provider, modelKey),
    };
  }, [models, modelKey]);

  // build + group (more "pro" look with headers per provider)
  const sections = useMemo(() => {
    if (!models || Object.keys(models).length === 0) {
      return [{ type: 'empty', id: 'empty', message: 'No models available' }];
    }

    const toRow = ([key, info]) => ({
      key,
      name: info?.display?.name || key,
      desc: descriptionFor(key, info),
      icon: glyphFor(info?.provider, key),
      labels: labelsFor(key),
      provider: (info?.provider || 'other').toLowerCase(),
    });

    // Filter by model kind (only show chat models) and search query
    let filteredModels = Object.entries(models)
      .filter(([key, info]) => info?.kind === 'chat') // Only show chat models
      .map(toRow);
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filteredModels = filteredModels.filter(model =>
        model.name.toLowerCase().includes(query) ||
        model.desc.toLowerCase().includes(query) ||
        model.provider.includes(query)
      );
    }

    if (filteredModels.length === 0) {
      return [{ type: 'empty', id: 'empty', message: `No models found for "${searchQuery}"` }];
    }

    const order = ['openai', 'anthropic', 'google', 'xai', 'other'];
    const grouped = filteredModels.reduce((acc, r) => {
      (acc[r.provider] = acc[r.provider] || []).push(r);
      return acc;
    }, {});
    order.forEach(p => (grouped[p] || []).sort((a, b) => a.name.localeCompare(b.name)));

    const out = [];
    order.forEach(p => {
      const set = grouped[p];
      if (set && set.length) {
        out.push({ type: 'header', id: `hdr-${p}`, title: titleForProvider(p) });
        set.forEach(row => out.push({ type: 'row', ...row }));
      }
    });
    return out;
  }, [models, searchQuery]);

  // open / close
  const runOpen = useCallback(() => {
    // Trigger button micro-interaction
    Animated.sequence([
      Animated.timing(triggerScale, {
        toValue: 0.96,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(triggerScale, {
        toValue: 1,
        tension: 300,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    setOpen(true);
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(overlay, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(dropY, { toValue: 0, damping: 12, stiffness: 150, mass: 0.8, useNativeDriver: true }),
        Animated.timing(sheetFade, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(sheetScale, { toValue: 1, duration: 220, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
        Animated.timing(rotateArrow, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        const idx = sections.findIndex(r => r.type === 'row' && r.key === modelKey);
        if (idx >= 0) setTimeout(() => listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 }), 50);
      });
    });
    Haptic.trigger('selection');
  }, [overlay, dropY, sheetFade, sheetScale, rotateArrow, triggerScale, sections, modelKey]);

  const runClose = useCallback(() => {
    setSearchQuery(''); // Clear search when closing
    Animated.parallel([
      Animated.timing(overlay, { toValue: 0, duration: 160, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(dropY, { toValue: -36, duration: 200, easing: Easing.in(Easing.back(1.2)), useNativeDriver: true }),
      Animated.timing(sheetFade, { toValue: 0, duration: 140, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(sheetScale, { toValue: 0.985, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rotateArrow, { toValue: 0, duration: 160, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => finished && setOpen(false));
  }, [overlay, dropY, sheetFade, sheetScale, rotateArrow]);

  const onPick = useCallback((key) => {
    if (key !== modelKey) {
      Haptic.trigger('notificationSuccess');
      setModel(key);
    } else {
      Haptic.trigger('selection');
    }
    runClose();
  }, [setModel, modelKey, runClose]);

  const arrowStyle = {
    transform: [{ rotate: rotateArrow.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }],
  };

  // render
  const renderItem = ({ item, index }) => {
    if (item.type === 'empty') {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyTitle}>No models found</Text>
          <Text style={styles.emptyMessage}>{item.message}</Text>
        </View>
      );
    }

    if (item.type === 'header') {
      // subtle section label with animation
      const headerDelay = index * 30;
      const headerStyle = {
        opacity: sheetFade.interpolate({
          inputRange: [0, 0.3, 1],
          outputRange: [0, 0, 1],
          extrapolate: 'clamp',
        }),
        transform: [{
          translateY: sheetFade.interpolate({
            inputRange: [0, 0.3, 1],
            outputRange: [10, 10, 0],
            extrapolate: 'clamp',
          }),
        }],
      };

      return (
        <Animated.View key={item.id} style={[styles.sectionHeader, headerStyle]}>
          <Text style={styles.sectionTitle}>{item.title}</Text>
        </Animated.View>
      );
    }

    const selected = item.key === modelKey;
    const next = sections[index + 1];
    const showDivider = next && next.type === 'row';

    // Staggered animation for rows
    const rowDelay = index * 40;
    const rowStyle = {
      opacity: sheetFade.interpolate({
        inputRange: [0, 0.2 + rowDelay / 1000, 0.4 + rowDelay / 1000, 1],
        outputRange: [0, 0, 0.3, 1],
        extrapolate: 'clamp',
      }),
      transform: [{
        translateY: sheetFade.interpolate({
          inputRange: [0, 0.2 + rowDelay / 1000, 0.4 + rowDelay / 1000, 1],
          outputRange: [15, 15, 5, 0],
          extrapolate: 'clamp',
        }),
      }, {
        scale: sheetFade.interpolate({
          inputRange: [0, 0.2 + rowDelay / 1000, 0.4 + rowDelay / 1000, 1],
          outputRange: [0.95, 0.95, 0.98, 1],
          extrapolate: 'clamp',
        }),
      }],
    };

    return (
      <Animated.View style={rowStyle}>
        <Pressable
          onPress={() => onPick(item.key)}
          android_ripple={{ color: colors.border }}
          style={({ pressed }) => [
            styles.cardRow,
            selected && styles.cardRowSelected,
            pressed && styles.cardRowPressed,
          ]}
          accessibilityRole="menuitem"
          accessibilityState={{ selected }}
          accessibilityLabel={`${item.name} model`}
          accessibilityHint={selected ? "Currently selected model" : `Select ${item.name} model`}
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
                    <View key={lbl} style={[styles.badge, lbl === 'NEW' && styles.badgeNew, lbl === 'BEST' && styles.badgeBest]}>
                      <Text style={[styles.badgeText, lbl === 'NEW' && styles.badgeTextNew, lbl === 'BEST' && styles.badgeTextBest]}>
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

          {selected ? <Text style={styles.check}>✓</Text> : null}
        </Pressable>

        {showDivider && <View style={styles.divider} />}
      </Animated.View>
    );
  };

  const keyExtractor = it => (it.type === 'header' ? it.id : it.key);

  return (
    <>
      {/* Trigger pill */}
      <Animated.View style={{ transform: [{ scale: triggerScale }] }}>
        <Pressable
          style={styles.trigger}
          onPress={runOpen}
          accessibilityRole="button"
          accessibilityLabel={`Current model: ${current.name}. Tap to change model.`}
          accessibilityHint="Opens model selection menu"
        >
          <SvgIcon name={current.icon} size={18} color={colors.textSecondary} />
          <Text numberOfLines={1} style={styles.triggerText}>{current.name}</Text>
          <Animated.Text style={[styles.triggerArrow, arrowStyle]}>▾</Animated.Text>
        </Pressable>
      </Animated.View>

      {/* Modal */}
      <Modal transparent visible={open} statusBarTranslucent animationType="none" onRequestClose={runClose}>
        {/* Overlay */}
        <Animated.View style={[styles.overlay, { opacity: overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={runClose} />
        </Animated.View>

        {/* Panel (top drop) */}
        <Animated.View
          style={[
            styles.panel,
            {
              marginTop: insets.top + 56,
              maxHeight: Math.min(Dimensions.get('window').height * 0.8, 620),
              transform: [{ translateY: dropY }, { scale: sheetScale }],
              opacity: sheetFade,
            },
          ]}
          accessibilityRole="dialog"
          accessibilityViewIsModal
          importantForAccessibility="yes"
        >
          {/* Panel header */}
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Choose a model</Text>
            <Pressable hitSlop={10} onPress={runClose}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          {/* Search input */}
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search models..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel="Search models"
              accessibilityHint="Type to filter available models"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} style={styles.clearButton}>
                <Text style={styles.clearIcon}>✕</Text>
              </Pressable>
            )}
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

  return 'gpt'; // default fallback
}
function descriptionFor(key, info) {
  const map = {
    'gpt-4o': 'Most powerful AI model',
    'gpt-4o-mini': 'Fast for everyday tasks',
    'claude-3-haiku': 'Fast and efficient model',
    'claude-3.7-sonnet': 'Advanced reasoning model',
    'gemini-2.5-pro': "Google's best model",
    'gemini-2.0-flash': 'Fast model with great reasoning',
  };
  return map[key] || `${info?.provider || 'AI'} model`;
}
function labelsFor(key) {
  const map = {
    'gpt-4o': ['NEW', 'BEST'],
    'gpt-4o-mini': ['NEW'],
    'claude-3.7-sonnet': ['NEW'],
    'grok-4': ['NEW'],
  };
  return map[key] || [];
}
function titleForProvider(p) {
  if (p === 'openai') return 'OpenAI';
  if (p === 'anthropic') return 'Anthropic';
  if (p === 'google') return 'Google';
  if (p === 'xai') return 'xAI';
  return 'Other';
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  /* trigger */
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
  },
  triggerText: { maxWidth: 160, fontSize: 14, fontWeight: '700', color: colors.text },
  triggerArrow: { fontSize: 12, color: colors.textSecondary },

  /* overlay */
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },

  /* panel */
  panel: {
    alignSelf: 'center',
    width: '94%',
    maxWidth: 460,
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    // enhanced shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowRadius: 32,
    shadowOpacity: Platform.OS === 'ios' ? 0.28 : 0.32,
    elevation: 24,
  },
  panelHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
  },
  panelTitle: { fontSize: 14, fontWeight: '800', color: colors.text, letterSpacing: 0.2 },
  close: { fontSize: 18, color: colors.text },

  /* search */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { fontSize: 16, color: colors.textSecondary, marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 4,
  },
  clearButton: { padding: 4 },
  clearIcon: { fontSize: 14, color: colors.textSecondary },

  /* section header */
  sectionHeader: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, backgroundColor: colors.surface },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', letterSpacing: 0.6,
    color: colors.textSecondary, textTransform: 'uppercase',
  },

  /* row card */
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardRowSelected: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.primary + '20',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    shadowOpacity: 0.1,
    elevation: 4,
  },
  cardRowPressed: {
    backgroundColor: colors.surfaceElevated,
    transform: [{ scale: 0.98 }],
  },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 48, marginRight: 8 },

  titleBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  rowTitleSel: { color: colors.primary },
  rowDesc: { fontSize: 13, color: colors.textSecondary },
  rowDescSel: { color: colors.text },

  check: { fontSize: 18, color: colors.primary, fontWeight: '800', marginLeft: 8 },

  /* chips */
  badgeWrap: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  badge: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    shadowOpacity: 0.1,
    elevation: 2,
  },
  badgeNew: {
    backgroundColor: colors.primary + '20',
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
  },
  badgeBest: {
    backgroundColor: '#6366F120',
    borderColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOpacity: 0.2,
  },
  badgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: colors.textSecondary, letterSpacing: 0.5 },
  badgeTextNew: { color: colors.primary },
  badgeTextBest: { color: '#6366F1' },

  /* empty state */
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIcon: { fontSize: 32, marginBottom: 12, opacity: 0.6 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4 },
  emptyMessage: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});

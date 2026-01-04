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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Haptic from 'react-native-haptic-feedback';
import { useSettingsStore } from '../state/useSettingsStore';
import { colors } from '../styles/colors';
import SvgIcon from './SvgIcon';
import { useTranslation } from 'react-i18next';
import { useContext } from 'react';
import { SubscriptionContext } from '../context/SubscriptionContext';
import { isPremiumModel } from '../config/premium';
import { setPendingPremiumAction } from '../state/premiumActions';
import { useNavigation } from '@react-navigation/native';
import { getChatModelPrice } from '../utils/chatPricing';
import Svg, { Path } from 'react-native-svg';
import NetInfo from '@react-native-community/netinfo';

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
  const navigation = useNavigation();
  const subscription = useContext(SubscriptionContext);
  const isPremium = !!subscription?.isPremium;

  // store
  const models = useSettingsStore(s => s.models);
  const modelKey = useSettingsStore(s => s.model);
  const setModel = useSettingsStore(s => s.setModel);

  // ui
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOffline, setIsOffline] = useState(false);

  // reanimated shared values
  const overlay = useSharedValue(0);       // 0..1
  const dropY = useSharedValue(-36);       // translateY
  const sheetScale = useSharedValue(0.985);
  const sheetProgress = useSharedValue(0); // 0..1 (use for opacity / content)
  const rotateArrow = useSharedValue(0);   // 0 closed, 1 open
  const triggerScale = useSharedValue(1);  // trigger micro-bounce
  const offlineOpacity = useSharedValue(0);
  const offlineScale = useSharedValue(0.8);

  const listRef = useRef(null);

  // Offline indicator
  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !(state.isConnected && state.isInternetReachable);
      setIsOffline(offline);
      
      if (offline) {
        offlineOpacity.value = withTiming(1, { duration: 300 });
        offlineScale.value = withSequence(
          withTiming(1.2, { duration: 200 }),
          withTiming(1, { duration: 200 })
        );
      } else {
        offlineOpacity.value = withTiming(0, { duration: 300 });
      }
    });

    return () => unsubscribe();
  }, [offlineOpacity, offlineScale]);

  // current trigger label
  const current = useMemo(() => {
    const info = models?.[modelKey] || {};
    const cost = getChatModelPrice(modelKey);
    return {
      name: info.display?.name || modelKey,
      icon: glyphFor(info?.provider, modelKey),
      cost,
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
      desc: getModelDescription(key, info, t),
      icon: glyphFor(info?.provider, key),
      labels: info?.display?.labels ?? info?.labels ?? labelsFor(key, t), // Backend labels override hardcoded (allow empty array)
      provider: (info?.provider || 'other').toLowerCase(),
      cost: getChatModelPrice(key),
    });

    let filteredModels = Object.entries(models)
      .filter(([_, info]) => info?.kind === 'chat')
      .map(toRow);

    // Show all models - don't filter premium models
    // Premium models will be marked with PRO badge and gated on selection

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
  }, [models, searchQuery, t]);

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

  const offlineStyle = useAnimatedStyle(() => ({
    opacity: offlineOpacity.value,
    transform: [{ scale: offlineScale.value }],
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
            // Check if model requires premium - navigate directly to paywall
            if (!isPremium && isPremiumModel(item.key)) {
              setPendingPremiumAction(() => {
                try {
                  setModel(item.key);
                } catch (error) {
                  // Model setting error handled silently
                }
              });
              runClose();
              try {
                navigation.navigate('PaywallScreen', { returnTo: 'Chat' });
              } catch (e) {
                // Navigation error handled silently
              }
              return;
            }

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
              <View style={styles.titleLeft}>
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
              {isPremiumModel(item.key) && !isPremium && (
                <View style={styles.badgePremium}>
                  <Text style={styles.badgeTextPremium}>
                    {t('premium.badge', { defaultValue: 'PRO' })}
                  </Text>
                </View>
              )}
            </View>
            <Text numberOfLines={2} style={[styles.rowDesc, selected && styles.rowDescSel]}>
              {item.desc}
            </Text>
          </View>

          <View style={styles.rowRight}>
            {item.cost > 0 ? (
              <View style={styles.coinPill}>
                <Svg height={12} width={12} viewBox="0 -960 960 960" fill="#FF9500">
                  <Path d="M480-120q-151 0-255.5-46.5T120-280v-400q0-66 105.5-113T480-840q149 0 254.5 47T840-680v400q0 67-104.5 113.5T480-120Zm0-479q89 0 179-25.5T760-679q-11-29-100.5-55T480-760q-91 0-178.5 25.5T200-679q14 30 101.5 55T480-599Zm0 199q42 0 81-4t74.5-11.5q35.5-7.5 67-18.5t57.5-25v-120q-26 14-57.5 25t-67 18.5Q600-528 561-524t-81 4q-42 0-82-4t-75.5-11.5Q287-543 256-554t-56-25v120q25 14 56 25t66.5 18.5Q358-408 398-404t82 4Zm0 200q46 0 93.5-7t87.5-18.5q40-11.5 67-26t32-29.5v-98q-26 14-57.5 25t-67 18.5Q600-328 561-324t-81 4q-42 0-82-4t-75.5-11.5Q287-343 256-354t-56-25v99q5 15 31.5 29t66.5 25.5q40 11.5 88 18.5t94 7Z" />
                </Svg>
                <Text style={styles.coinPillText}>{item.cost}</Text>
              </View>
            ) : null}
            {selected ? <SvgIcon name="check" size={18} color={colors.primary} /> : null}
          </View>
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
          {isOffline && (
            <Animated.View style={[styles.offlineIndicator, offlineStyle]}>
              <View style={styles.offlineDot} />
            </Animated.View>
          )}
          {current.cost > 0 && (
            <View style={styles.triggerCoinPill}>
              <Svg height={12} width={12} viewBox="0 -960 960 960" fill="#D4AF37">
                <Path d="M480-120q-151 0-255.5-46.5T120-280v-400q0-66 105.5-113T480-840q149 0 254.5 47T840-680v400q0 67-104.5 113.5T480-120Zm0-479q89 0 179-25.5T760-679q-11-29-100.5-55T480-760q-91 0-178.5 25.5T200-679q14 30 101.5 55T480-599Zm0 199q42 0 81-4t74.5-11.5q35.5-7.5 67-18.5t57.5-25v-120q-26 14-57.5 25t-67 18.5Q600-528 561-524t-81 4q-42 0-82-4t-75.5-11.5Q287-543 256-554t-56-25v120q25 14 56 25t66.5 18.5Q358-408 398-404t82 4Zm0 200q46 0 93.5-7t87.5-18.5q40-11.5 67-26t32-29.5v-98q-26 14-57.5 25t-67 18.5Q600-328 561-324t-81 4q-42 0-82-4t-75.5-11.5Q287-343 256-354t-56-25v99q5 15 31.5 29t66.5 25.5q40 11.5 88 18.5t94 7Z" />
              </Svg>
              <Text style={styles.triggerCoinText}>{current.cost}</Text>
            </View>
          )}
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
function getModelDescription(key, info, t) {
  // Priority 0: Backend literal description (lets you change copy without app update).
  const backendDesc = typeof info?.display?.description === 'string' ? info.display.description.trim() : '';
  if (backendDesc) return backendDesc;

  // Priority 1: Backend descriptionKey (translated via i18n)
  const descriptionKey = info?.display?.descriptionKey;
  if (descriptionKey) {
    const translated = t(`modelDescriptions.${descriptionKey}`, { defaultValue: null });
    if (translated && translated !== `modelDescriptions.${descriptionKey}`) {
      return translated;
    }
    // Fallback to hardcoded preset if translation missing
    const preset = MODEL_DESCRIPTION_PRESETS[descriptionKey];
    if (preset) return preset;
  }
  
  // Priority 2: Frontend i18n translation for model key (backward compatibility)
  const translated = t(`models.${key}`, { defaultValue: null });
  if (translated && translated !== `models.${key}`) return translated;
  
  // Priority 3: Hardcoded fallback map
  return descriptionFor(key, info, t);
}

function descriptionFor(key, info, t) {
  const map = {
    'gpt-5': 'Most powerful all-purpose AI',
    'gpt-5-chat-latest': 'Optimized for chat and dialogue',
    'gpt-5-mini': 'Fast and reliable GPT-5',
    'gpt-5-nano': 'Light model for simple tasks',
    'o4-mini': 'Efficient reasoning model',
    'gpt-4.1-mini': 'Compact, capable GPT-4.1',
    'claude-3-haiku': 'Fast and focused Anthropic AI',
    'claude-3.7-sonnet': 'Refined reasoning by Anthropic',
    'gemini-2.5-Flash': "Google's most advanced model",
    'gemini-2.0-flash': 'Quick and precise Google AI'
  };
  
  return map[key] || `${info?.provider || 'AI'} model`;
}

// Model description presets (fallback if i18n translation missing)
const MODEL_DESCRIPTION_PRESETS = {
  most_powerful: "Most powerful AI model",
  fast_everyday: "Fast for everyday tasks",
  fast_reasoning: "Fast model with good reasoning",
  great_reasoning: "Advanced reasoning model",
  coding_reasoning: "Advanced coding and reasoning",
  better_coding: "Better for coding and reasoning",
  best_overall: "Best all-around AI model",
  best_google: "Google's best model",
  best_xai: "xAI's most powerful model",
  creative_focus: "Great for creative writing",
  code_helper: "Great for coding help",
  chat_focus: "Optimized for chatting",
  long_context: "Great for long contexts",
  budget_friendly: "Budget-friendly AI model",
  ultra_fast: "Ultra fast responses",
  safe_default: "Safe default choice",
  multilingual: "Strong multilingual support",
  vision_strong: "Great with images and vision",
  data_analysis: "Good for data analysis",
  structured_tasks: "Good for structured tasks",
  everyday_helper: "Everyday assistant model",
  concise_answers: "Short, concise answers",
  detailed_answers: "Detailed step-by-step answers",
  experimental: "Experimental next-gen model",
  reliable_classic: "Reliable classic model",
  lightweight: "Lightweight, low-cost model",
  chatty_personal: "More friendly and personal",
  pro_users: "Best for power users",
  research_helper: "Good for research and notes",
  reasoning_strong: "Advanced reasoning model",
};

function labelsFor(key, t) {
  const map = {
    'gpt-5': ['NEW', 'BEST'],
    'gpt-5-chat-latest': ['NEW', 'BEST'],
    'gpt-5-mini': ['NEW'],
    'gpt-5-nano': ['NEW'],
    'o4-mini': ['NEW'],
    'gpt-4.1-mini': [],
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  triggerText: { maxWidth: 144, fontSize: 13, fontWeight: '700', color: colors.text },
  triggerCoinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  triggerCoinText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  arrowContainer: { backgroundColor: colors.surface, borderRadius: 9, padding: 2 },
  offlineIndicator: {
    marginLeft: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },

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
    gap: 8,
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

  titleBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  titleLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1, flexShrink: 1 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
  rowTitleSel: { color: colors.primary },
  rowDesc: { fontSize: 12, color: colors.textSecondary },
  rowDescSel: { color: colors.text },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coinPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  /* chips */
  badgeWrap: { flexDirection: 'row', gap: 5, flexShrink: 0 },
  badge: {
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, shadowOpacity: 0.1, elevation: 2,
  },
  badgeNew: { 
    backgroundColor: colors.primary, 
    borderWidth: 0,
    shadowColor: colors.primary, 
    shadowOpacity: 0.2 
  },
  badgeBest: { 
    backgroundColor: '#6366F1', 
    borderWidth: 0,
    shadowColor: '#6366F1', 
    shadowOpacity: 0.2 
  },
  badgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', color: colors.textSecondary, letterSpacing: 0.5 },
  badgeTextNew: { color: '#FFFFFF' },
  badgeTextBest: { color: '#FFFFFF' },
  badgePremium: { 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 4,
    backgroundColor: 'transparent',
    // No border, no shadow
  },
  badgeTextPremium: { 
    fontSize: 9, 
    fontWeight: '700', 
    color: '#F59E0B', 
    letterSpacing: 0.3,
    // No uppercase transform for PRO
  },

  /* empty */
  emptyState: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 18 },
  emptyIcon: { fontSize: 29, marginBottom: 11, opacity: 0.6 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 4 },
  emptyMessage: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
});

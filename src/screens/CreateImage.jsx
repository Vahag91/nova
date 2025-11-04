import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Image,
  TextInput,
  Keyboard,
  Platform,
  ScrollView,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SvgIcon from '../components/SvgIcon';
import { useSettingsStore } from '../state/useSettingsStore';
import {
  createSbWithDevice,
  fetchBalanceByDevice,
} from '../lib/supabaseDevice';
import { ensureDeviceId } from '../lib/deviceId';
import ModelMenu from '../components/image-studio/ModelMenu';
import CreateImageGenerating from '../components/create-image/CreateImageGenerating';
import Reanimated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  useDerivedValue,
  withTiming,
  Easing,
  KeyboardState,
} from 'react-native-reanimated';
import { getModelVisuals, hexToRgba } from '../utils/modelVisuals';

const STYLES = [
  {
    id: 'anime',
    name: 'Anime',
    image: require('../../assets/images/createstudio/anime.webp'),
    cost: 2,
  },
  {
    id: 'cartoon',
    name: 'Cartoon',
    image: require('../../assets/images/createstudio/cartoon.webp'),
    cost: 2,
  },
  {
    id: 'photoreal',
    name: 'Photoreal',
    image: require('../../assets/images/createstudio/photoreal.webp'),
    cost: 3,
    selected: true,
  },
  {
    id: 'sketch',
    name: 'Sketch',
    image: require('../../assets/images/createstudio/sketch.webp'),
    cost: 1,
  },
  // --- New requests ---
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    cost: 2,
    image: require('../../assets/images/createstudio/cyberpunk.webp'),
  },
  {
    id: 'steampunk',
    name: 'Steampunk',
    cost: 2,
    image: require('../../assets/images/createstudio/steampunk.webp'),
  },
  {
    id: 'illustration_3d',
    name: '3D Illustration',
    cost: 3,
    image: require('../../assets/images/createstudio/3dillistration.webp'),
  },
  {
    id: 'dark_fantasy',
    name: 'Dark Fantasy',
    cost: 3,
    image: require('../../assets/images/createstudio/darkfantasy.webp'),
  },
  // --- Safe extras ---
  {
    id: 'vintage_film',
    name: 'Vintage Film',
    cost: 1,
    image: require('../../assets/images/createstudio/vintage.webp'),
  },
  {
    id: 'pastel',
    name: 'Pastel Aesthetic',
    cost: 1,
    image: require('../../assets/images/createstudio/pastel.webp'),
  },
  {
    id: 'neon_glow',
    name: 'Neon Glow',
    cost: 2,
    image: require('../../assets/images/createstudio/neo.webp'),
  },
  {
    id: 'epic_landscape',
    name: 'Epic Landscape',
    cost: 3,
    image: require('../../assets/images/createstudio/epic.webp'),
  },
];

const STARTER_PROMPTS = [
  'studio headshot',
  'modern living room',
  'tropical beach at sunset',
];

const ASPECTS = [
  { key: '1:1', size: '1024x1024', label: 'Square', glyph: { width: 16, height: 16 } },
  { key: '16:9', size: '1024x576', label: 'Landscape', glyph: { width: 20, height: 11 } },
  { key: '3:4', size: '768x1024', label: 'Portrait', glyph: { width: 11, height: 20 } },
];

export default function CreateImage({ navigation }) {
  const insets = useSafeAreaInsets();

  // Balance
  const [coins, setCoins] = useState(null);
  const [coinsLoading, setCoinsLoading] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const id = await ensureDeviceId();
        const sb = createSbWithDevice(id);
        setCoinsLoading(true);
        const bal = await fetchBalanceByDevice(sb, id);
        if (mounted) setCoins(bal);
      } catch {
        if (mounted) setCoins(null);
      } finally {
        if (mounted) setCoinsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Model from settings
  const models = useSettingsStore(s => s.models);
  const defaultModel = useMemo(() => {
    const entries = Object.entries(models || {});
    const first = entries.find(([, v]) => v?.caps?.imageGen);
    return first ? first[0] : 'runware-flux-dev';
  }, [models]);
  const imageModels = useMemo(() => {
    const entries = Object.entries(models || {}).filter(([, v]) => v?.caps?.imageGen);
    if (!entries.length) {
      return [
        {
          key: defaultModel,
          display: { name: defaultModel },
          provider: 'custom',
        },
      ];
    }
    return entries.map(([key, value]) => ({
      key,
      display: value?.display || { name: key },
      provider: value?.provider || 'custom',
    }));
  }, [models, defaultModel]);

  // Form state
  const [selectedStyle, setSelectedStyle] = useState(
    STYLES.find(s => s.selected)?.id || STYLES[0].id,
  );
  const [aspect, setAspect] = useState(ASPECTS[0].key);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelButtonRef = useRef(null);
  const [generatorVisible, setGeneratorVisible] = useState(false);
  const [generatorPayload, setGeneratorPayload] = useState(null);

  useEffect(() => {
    setSelectedModel(defaultModel);
  }, [defaultModel]);

  const selectedModelDisplay = useMemo(
    () => imageModels.find(m => m.key === selectedModel),
    [imageModels, selectedModel],
  );
  const modelVisuals = useMemo(
    () => getModelVisuals(selectedModelDisplay?.provider),
    [selectedModelDisplay?.provider],
  );
  const headerStyle = useMemo(
    () => [styles.header, { paddingTop: Math.max(insets.top, 12) + 6 }],
    [insets.top],
  );
  // Keyboard-aware footer + content (ported from ImagesStudio)
  const keyboard = useAnimatedKeyboard();
  const GAP = 24; // space between keyboard and footer
  const kTranslate = useSharedValue(0);
  const kGap = useSharedValue(0);

  useDerivedValue(() => {
    const h = keyboard.height.value;
    const isClosing = keyboard.state.value === KeyboardState.CLOSING;
    const duration = isClosing ? 240 : 40;
    kTranslate.value = withTiming(-h, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
    kGap.value = withTiming(h > 0 ? GAP : 0, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  });

  const animatedContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: kTranslate.value }],
  }));
  const animatedFooterStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: kTranslate.value + kGap.value }],
  }));

  const footerInset = Math.max(insets.bottom, 14);
  const footerStyle = useMemo(
    () => [styles.footer, { paddingBottom: footerInset }],
    [footerInset],
  );
  const bottomScrollPadding = useMemo(
    () =>
      56 /* btn */ +
      10 /* footer top pad */ +
      footerInset +
      12 /* extra breathing */,
    [footerInset],
  );

  const selectedStyleData = useMemo(
    () => STYLES.find(s => s.id === selectedStyle),
    [selectedStyle],
  );
  const selectedCost = selectedStyleData?.cost ?? 2;
  const selectedSize = useMemo(
    () => ASPECTS.find(a => a.key === aspect)?.size || '1024x1024',
    [aspect],
  );

  const onGenerate = useCallback(() => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    const basePrompt = prompt.trim();
    const styleTag = selectedStyleData?.name
      ? `${selectedStyleData.name} style`
      : null;
    const promptWithStyle = styleTag
      ? `${styleTag}, ${basePrompt}`
      : basePrompt;
    const payload = {
      prompt: promptWithStyle,
      originalPrompt: basePrompt,
      styleId: selectedStyleData?.id,
      styleName: selectedStyleData?.name,
      model: selectedModel,
      size: selectedSize,
    };
    setGeneratorPayload(payload);
    setGeneratorVisible(true);
    Keyboard.dismiss();
  }, [
    prompt,
    busy,
    selectedModel,
    selectedSize,
    selectedStyleData,
  ]);

  const handleGeneratorClose = useCallback(() => {
    setGeneratorVisible(false);
    setGeneratorPayload(null);
    setBusy(false);
  }, []);

  // Renderers
  const renderStyle = useCallback(
    ({ item }) => {
      const selected = item.id === selectedStyle;
      return (
        <Pressable
          key={item.id}
          onPress={() => setSelectedStyle(item.id)}
          style={[styles.styleItem, selected && styles.styleItemSelected]}
        >
          <View
            style={[
              styles.styleThumbWrap,
              selected && styles.styleThumbSelected,
            ]}
          >
            <Image
              source={
                typeof item.image === 'number'
                  ? item.image
                  : { uri: item.image }
              }
              style={[styles.styleThumb, styles.styleThumbImage]}
              fadeDuration={0}
            />
          </View>
          <Text
            style={[styles.styleName, selected && styles.styleNameSelected]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
        </Pressable>
      );
    },
    [selectedStyle],
  );

  const keyStyle = useCallback((it) => it.id, []);

  const renderChip = useCallback(
    ({ item }) => (
      <Pressable
        onPress={() => setPrompt(p => (p ? p : item))}
        style={styles.chip}
      >
        <Text style={styles.chipText}>{item}</Text>
      </Pressable>
    ),
    [],
  );

  const keyChip = useCallback((it, idx) => `${idx}-${it}`, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={headerStyle}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.headerBackBtn}
            hitSlop={10}
          >
            <SvgIcon name="chevron-left" size={22} color="#FFFFFF" />
          </Pressable>
          <View pointerEvents="none" style={styles.headerCenterAbs}>
            <Text style={styles.headerTitle}>Create</Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate('CoinStore')}
            style={styles.balancePill}
            hitSlop={8}
          >
            <Text style={styles.balanceText}>
              {coinsLoading ? '…' : `◈ ${coins ?? '—'}`}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomScrollPadding },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Reanimated.View style={[styles.content, animatedContentStyle]}>
          {/* Model selector */}
          <View style={styles.modelWrap}>
            <Pressable
              ref={modelButtonRef}
              onPress={() => setModelMenuOpen(true)}
              style={styles.modelButton}
              hitSlop={6}
            >
              <View style={styles.modelSimpleInfo}>
                <View
                  style={[
                    styles.modelSimpleIcon,
                    {
                      borderColor: hexToRgba(modelVisuals.accent, 0.35),
                      backgroundColor: hexToRgba(modelVisuals.accent, 0.18),
                    },
                  ]}
                >
                  <SvgIcon
                    name={modelVisuals.icon}
                    size={18}
                    color="#FFFFFF"
                  />
                </View>
                <Text style={styles.modelButtonName} numberOfLines={1}>
                  {selectedModelDisplay?.display?.name || selectedModel}
                </Text>
              </View>
              <View style={styles.modelButtonChevron}>
                <SvgIcon
                  name="chevron-down"
                  size={16}
                  color="rgba(255,255,255,0.9)"
                />
              </View>
            </Pressable>
          </View>

          {/* Choose a Style */}
          <View style={styles.rowBetween}>
            <Text style={styles.sectionLabel}>Choose a Style</Text>
          </View>
          <FlatList
            data={STYLES}
            keyExtractor={keyStyle}
            renderItem={renderStyle}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stylesList}
            initialNumToRender={5}
            windowSize={3}
            removeClippedSubViews
          />

          <Text style={styles.aspectLabel}>Aspect Ratio</Text>
          <View style={styles.aspectList}>
            {ASPECTS.map(a => {
              const active = aspect === a.key;
              return (
                <Pressable
                  key={a.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setAspect(a.key)}
                  style={[styles.aspectCard, active && styles.aspectCardActive]}
                >
                  <View style={[styles.aspectGlyphWrap, active && styles.aspectGlyphWrapActive]}>
                    <View
                      style={[
                        styles.aspectGlyphRect,
                        { width: a.glyph.width, height: a.glyph.height },
                        active && styles.aspectGlyphRectActive,
                      ]}
                    />
                  </View>
                  <Text
                    style={[styles.aspectKey, active && styles.aspectKeyActive]}
                    numberOfLines={1}
                  >
                    {a.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Starter prompts */}
          <Text style={[styles.sectionLabel, styles.mt6]}>Starter Prompts</Text>
          <FlatList
            data={STARTER_PROMPTS}
            keyExtractor={keyChip}
            renderItem={renderChip}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsList}
            initialNumToRender={6}
            windowSize={3}
            removeClippedSubviews
          />

          {/* Prompt (moved below advanced) */}
          <View style={styles.promptWrap}>
            <TextInput
              style={styles.prompt}
              placeholder="Type what you want to see…"
              placeholderTextColor={'rgba(255,255,255,0.65)'}
              multiline
              value={prompt}
              onChangeText={setPrompt}
              textAlignVertical="top"
            />
            {prompt?.length > 0 && (
              <Pressable
                onPress={() => setPrompt('')}
                style={styles.promptClearBtn}
                hitSlop={8}
                accessibilityLabel="Clear text"
              >
                <SvgIcon
                  name="clear"
                  size={18}
                  color={'rgba(255,255,255,0.8)'}
                />
              </Pressable>
            )}
            <Text style={styles.promptHint}>
              Example: 'Golden retriever in studio lighting'
            </Text>
          </View>
        </Reanimated.View>
      </ScrollView>

      {/* Footer */}
      <Reanimated.View style={[footerStyle, animatedFooterStyle]}>
        <Pressable
          onPress={onGenerate}
          disabled={!prompt.trim() || busy}
          style={[
            styles.generateBtn,
            (!prompt.trim() || busy) && styles.generateBtnDisabled,
          ]}
        >
          <View style={styles.generateContent}>
            <View style={styles.generateIconWrap}>
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <SvgIcon name="stars" size={18} color="#FFFFFF" />
              )}
            </View>
            <Text style={styles.generateBtnText}>
              {busy ? 'Generating…' : 'Generate'}
            </Text>
            <View style={styles.generateCoinsWrap}>
              <SvgIcon
                name="diamond"
                size={12}
                color={busy ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.8)'}
              />
              <Text
                style={[
                  styles.generateCoinsText,
                  busy && { color: 'rgba(255,255,255,0.5)' },
                ]}
              >
                {busy ? '…' : selectedCost}
              </Text>
            </View>
          </View>
        </Pressable>
      </Reanimated.View>

      <ModelMenu
        visible={modelMenuOpen}
        onClose={() => setModelMenuOpen(false)}
        model={selectedModel}
        onModelChange={setSelectedModel}
        imageModels={imageModels}
        buttonRef={modelButtonRef}
      />

      <CreateImageGenerating
        visible={generatorVisible}
        payload={generatorPayload}
        onClose={handleGeneratorClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0E' },
  header: { paddingVertical: 20, backgroundColor: 'rgba(11,11,14,0.92)' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    position: 'relative',
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenterAbs: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  balancePill: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#17171C',
    borderRadius: 999,
    paddingHorizontal: 12,
  },
  balanceText: { color: '#7C5CFF', fontSize: 14, fontWeight: '800' },

  content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  modelWrap: { gap: 8 },
  modelButton: {
    minHeight: 60,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#0B0B0E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modelSimpleInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  modelSimpleIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modelButtonName: {
    color: '#F5F7FF',
    fontSize: 17,
    fontFamily: 'Lato-Bold',
    flexShrink: 1,
  },
  modelButtonChevron: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginLeft: 12,
  },
  stylesList: { paddingTop: 4, paddingBottom: 6, gap: 12 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '600',
  },
  link: { color: '#7C5CFF', fontSize: 13, fontWeight: '700' },

  styleThumbWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#11131B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    height: 128,
    width: '100%',
  },
  styleItem: { width: 140, marginRight: 12, marginBottom: 12, alignItems: 'center' },
  styleItemSelected: {},
  styleThumbSelected: { borderWidth: 2, borderColor: '#7C5CFF' },
  styleThumb: { width: '100%', height: '100%' },
  styleThumbImage: { borderRadius: 18, resizeMode: 'cover' },
  styleName: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  styleNameSelected: { fontWeight: '800' },

  aspectLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 8,
  },
  mt6: { marginTop: 18 },

  chipsList: { gap: 10 },
  chip: {
    height: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: '#17171C',
    marginRight: 10,
  },
  chipText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '600',
  },

  promptWrap: { gap: 6, marginTop: 6 },
  prompt: {
    minHeight: 120,
    borderRadius: 12,
    padding: 14,
    paddingRight: 44,
    backgroundColor: '#17171C',
    color: '#FFFFFF',
    fontSize: 16,
  },
  promptClearBtn: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  promptHint: { color: 'rgba(255,255,255,0.65)', fontSize: 12 },
  aspectList: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  aspectCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: '#15161D',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    minHeight: 44,
  },
  aspectCardActive: {
    borderColor: '#7C5CFF',
    backgroundColor: 'rgba(124,92,255,0.14)',
  },
  aspectGlyphWrap: {
    width: 22,
    height: 22,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aspectGlyphWrapActive: {
  },
  aspectGlyphRect: {
    borderWidth: 1,
    borderRadius: 3,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  aspectGlyphRectActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
  aspectKey: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 9,
  },
  aspectKeyActive: { color: '#FFFFFF' },
  outputRow: { gap: 10, marginTop: 14 },

  scrollContent: { paddingBottom: 24 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,11,14,0.86)',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  generateBtn: {
    height: 60,
    borderRadius: 16,
    backgroundColor: '#7C5CFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#7C5CFF',
        shadowOpacity: 0.28,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
      },
      android: { elevation: 3 },
    }),
  },
  generateBtnDisabled: { opacity: 0.65 },
  generateContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 18,
  },
  generateIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  generateBtnText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  generateCoinsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  generateCoinsText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '700',
  },
});

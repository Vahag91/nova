import React, { useMemo, useState, useEffect, useCallback, useRef, useContext } from 'react';
import {
  ActivityIndicator,
  Alert,
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Image,
  TextInput,
  Keyboard,
  ScrollView,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SvgIcon from '../components/SvgIcon';
import ModelMenu from '../components/image-studio/ModelMenu';
import CoinBalanceBadge from '../components/image-studio/CoinBalanceBadge';
import CreateImageGenerating from '../components/create-image/CreateImageGenerating';
import useCoinBalance from '../hooks/useCoinBalance';
import Reanimated, {
  useAnimatedStyle,
  useSharedValue,
  useDerivedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  useAnimatedKeyboard,
  KeyboardState,
} from 'react-native-keyboard-controller';
import { getModelVisuals } from '../utils/modelVisuals';
import { getImageModelPrice } from '../utils/imagePricing';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { SubscriptionAccessContext } from '../context/SubscriptionContext';
import features from '../config/features';
import { getImageModelsRegistry } from '../config/models';
import { perfLog } from '../lib/perfTrace';
import { resolvePremiumStatus } from '../lib/resolvePremiumStatus';
import {
  ROOT_DRAWER_ROUTE,
  ROOT_DRAWER_SCREEN_NAMES,
} from '../navigation/rootNavigation';

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

const DEFAULT_STARTER_PROMPTS = [
  'studio headshot',
  'modern living room',
  'tropical beach at sunset',
];

const ASPECTS = [
  { key: '1:1', size: '1024x1024', labelKey: 'studioCommon.aspectRatios.square', glyph: { width: 16, height: 16 } },
  { key: '16:9', size: '1024x576', labelKey: 'studioCommon.aspectRatios.landscape', glyph: { width: 20, height: 11 } },
  { key: '3:4', size: '768x1024', labelKey: 'studioCommon.aspectRatios.portrait', glyph: { width: 11, height: 20 } },
];

export default function CreateImage({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const zeroImageModelCosts = !!features.zeroImageModelCosts;
  
  // Handle returnTo navigation like EditImage for consistency
  const returnTo = route?.params?.returnTo;
  
  // Balance
  const coins = useCoinBalance();

  // Image Studio models are project-local by design.
  const models = getImageModelsRegistry();
  const defaultModel = useMemo(() => {
    const entries = Object.entries(models || {});
    const first = entries.find(([, v]) => v?.caps?.imageGen);
    return first ? first[0] : 'runware-flux-schnell';
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
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [aspect, setAspect] = useState(ASPECTS[0].key);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelButtonRef = useRef(null);
  const [generatorVisible, setGeneratorVisible] = useState(false);
  const [generatorPayload, setGeneratorPayload] = useState(null);

  useEffect(() => {
    const seedPrompt = route?.params?.seedPrompt;
    if (seedPrompt && typeof seedPrompt === 'string') {
      setPrompt(seedPrompt);
      return;
    }

    setPrompt('');
  }, [returnTo, route?.params?.seedPrompt]);
  const starterPrompts = useMemo(() => {
    const list = t('createImage.starterPrompts.items', { returnObjects: true });
    return Array.isArray(list) ? list : DEFAULT_STARTER_PROMPTS;
  }, [t]);

  const getStyleLabel = useCallback(
    (style) => {
      if (!style) return '';
      return t(`studioCommon.styles.${style.id}.name`, {
        defaultValue: style.name || style.id,
      });
    },
    [t],
  );

  useEffect(() => {
    setSelectedModel(defaultModel);
  }, [defaultModel]);

  const selectedModelDisplay = useMemo(
    () => imageModels.find(m => m.key === selectedModel),
    [imageModels, selectedModel],
  );
  const modelVisuals = useMemo(
    () => getModelVisuals(selectedModelDisplay?.provider, selectedModel),
    [selectedModelDisplay?.provider, selectedModel],
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

  const subscription = useContext(SubscriptionAccessContext);
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

  const selectedStyleData = useMemo(() => {
    if (!selectedStyle) return null;
    const base = STYLES.find(s => s.id === selectedStyle);
    if (!base) return null;
    return {
      ...base,
      name: getStyleLabel(base),
    };
  }, [selectedStyle, getStyleLabel]);
  const selectedCost = getImageModelPrice(selectedModel);
  const selectedSize = useMemo(
    () => ASPECTS.find(a => a.key === aspect)?.size || '1024x1024',
    [aspect],
  );
  const showInsufficientCoinsAlert = useCallback(() => {
    Alert.alert(
      t('studioCommon.notEnoughCoinsTitle', { defaultValue: 'Not enough coins' }),
      t('studioCommon.notEnoughCoinsMessage', {
        defaultValue: 'Your current balance is too low for this image.',
      }),
    );
  }, [t]);

  const onGenerate = useCallback(async () => {
    if (!prompt.trim() || busy) return;
    if ((coins ?? 0) < (selectedCost ?? 0)) {
      if (!(await resolvePremiumStatus(subscription))) {
        try {
          navigation.navigate('PaywallScreen');
        } catch {}
      } else {
        showInsufficientCoinsAlert();
      }
      return;
    }
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
      styleId: selectedStyleData?.id || null,
      styleName: selectedStyleData?.name || null,
      model: selectedModel,
      size: selectedSize,
      includeCost: !zeroImageModelCosts,
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
    zeroImageModelCosts,
    coins,
    selectedCost,
    navigation,
    showInsufficientCoinsAlert,
    subscription,
  ]);

  const handleBackPress = useCallback(() => {
    perfLog('studio.create.back_press', {
      returnTo: returnTo || null,
    });
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (returnTo) {
      perfLog('studio.create.return_to', {
        returnTo,
      });
      if (ROOT_DRAWER_SCREEN_NAMES.has(returnTo)) {
        navigation.navigate(ROOT_DRAWER_ROUTE, { screen: returnTo });
        return;
      }
      try {
        navigation.navigate(returnTo);
        return;
      } catch {}
    }

    perfLog('studio.create.return_home', {
      source: 'header_back',
    });
    navigation.navigate(ROOT_DRAWER_ROUTE, { screen: 'Studio' });
  }, [navigation, returnTo]);

  const handleGeneratorClose = useCallback(() => {
    setGeneratorVisible(false);
    setGeneratorPayload(null);
    setBusy(false);
  }, []);

  // Renderers
  const renderStyle = useCallback(
    ({ item }) => {
      const selected = item.id === selectedStyle;
      const label = getStyleLabel(item);
      return (
        <Pressable
          key={item.id}
          onPress={() =>
            setSelectedStyle(prev => (prev === item.id ? null : item.id))
          }
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
            {selected && (
              <View style={styles.styleSelectedOverlay}>
                <View style={styles.styleSelectedIcon}>
                  <SvgIcon name="check" size={24} color="#FFFFFF" />
                </View>
              </View>
            )}
          </View>
          <Text
            style={[styles.styleName, selected && styles.styleNameSelected]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </Pressable>
      );
    },
    [selectedStyle, getStyleLabel],
  );

  const keyStyle = useCallback((it) => it.id, []);

  const renderChip = useCallback(
    ({ item }) => {
      const isSelected = prompt.trim() === item.trim();
      return (
      <Pressable
        onPress={() => setPrompt(item)}
          style={[styles.chip, isSelected && styles.chipSelected]}
      >
          <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{item}</Text>
      </Pressable>
      );
    },
    [prompt],
  );

  const keyChip = useCallback((it, idx) => `${idx}-${it}`, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={headerStyle}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={handleBackPress}
            style={styles.headerBackBtn}
            hitSlop={10}
          >
            <SvgIcon name="chevron-left" size={22} color="#FFFFFF" />
          </Pressable>
          <View pointerEvents="none" style={styles.headerCenterAbs}>
            <Text style={styles.headerTitle}>{t('createImage.headerTitle')}</Text>
          </View>
          <View style={styles.headerRightSlot}>
            <CoinBalanceBadge coins={coins} />
          </View>
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
        <Reanimated.View
          style={[styles.content, animatedContentStyle]}
        >
          {/* Model selector */}
          <View style={styles.modelWrap}>
            <Pressable
              ref={modelButtonRef}
              onPress={() => setModelMenuOpen(true)}
              style={styles.modelButton}
              hitSlop={6}
            >
              <View style={styles.modelSimpleInfo}>
                <View style={styles.modelSimpleIcon}>
                  <SvgIcon name={modelVisuals.icon} size={24} color="#FFFFFF" />
                </View>
                <Text style={styles.modelButtonName} numberOfLines={1}>
                  {selectedModelDisplay?.display?.name || selectedModel}
                </Text>
                {selectedCost > 0 && (
                  <View style={styles.modelButtonCoins}>
                    <Svg height={12} width={12} viewBox="0 -960 960 960" fill="#FF9500">
                      <Path d="M480-120q-151 0-255.5-46.5T120-280v-400q0-66 105.5-113T480-840q149 0 254.5 47T840-680v400q0 67-104.5 113.5T480-120Zm0-479q89 0 179-25.5T760-679q-11-29-100.5-55T480-760q-91 0-178.5 25.5T200-679q14 30 101.5 55T480-599Zm0 199q42 0 81-4t74.5-11.5q35.5-7.5 67-18.5t57.5-25v-120q-26 14-57.5 25t-67 18.5Q600-528 561-524t-81 4q-42 0-82-4t-75.5-11.5Q287-543 256-554t-56-25v120q25 14 56 25t66.5 18.5Q358-408 398-404t82 4Zm0 200q46 0 93.5-7t87.5-18.5q40-11.5 67-26t32-29.5v-98q-26 14-57.5 25t-67 18.5Q600-328 561-324t-81 4q-42 0-82-4t-75.5-11.5Q287-343 256-354t-56-25v99q5 15 31.5 29t66.5 25.5q40 11.5 88 18.5t94 7Z" />
                    </Svg>
                    <Text style={styles.modelButtonCoinsText}>{selectedCost}</Text>
                  </View>
                )}
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
            <Text style={styles.sectionLabel}>{t('createImage.chooseStyle')}</Text>
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

          <Text style={styles.aspectLabel}>{t('createImage.aspectRatio')}</Text>
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
                    {t(a.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Starter prompts */}
          <Text style={[styles.sectionLabel, styles.mt6]}>{t('createImage.starterPrompts.title')}</Text>
          <FlatList
            data={starterPrompts}
            keyExtractor={keyChip}
            renderItem={renderChip}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsList}
            initialNumToRender={6}
            windowSize={3}
            removeClippedSubviews={false}
          />

          {/* Prompt (moved below advanced) */}
          <View style={styles.promptWrap}>
            <TextInput
              style={styles.prompt}
              placeholder={t('createImage.promptPlaceholder')}
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
                accessibilityLabel={t('createImage.clearText')}
              >
                <SvgIcon
                  name="clear"
                  size={18}
                  color={'rgba(255,255,255,0.8)'}
                />
              </Pressable>
            )}
            <Text style={styles.promptHint}>
              {t('createImage.promptHint')}
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
              {busy ? t('createImage.generating') : t('createImage.generate')}
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
    justifyContent: 'space-between',
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
    paddingHorizontal: 96,
  },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  headerRightSlot: {
    minWidth: 74,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

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
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelButtonName: {
    color: '#F5F7FF',
    fontSize: 17,
    fontFamily: 'Lato-Bold',
    flexShrink: 1,
  },
  modelButtonCoins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modelButtonCoinsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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
  styleThumbSelected: {},
  styleThumb: { width: '100%', height: '100%' },
  styleThumbImage: { borderRadius: 18, resizeMode: 'cover' },
  styleSelectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    backgroundColor: 'rgba(124, 92, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleSelectedIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7C5CFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  styleName: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  styleNameSelected: { 
    fontWeight: '800',
    color: '#7C5CFF',
  },

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
    borderWidth: 1,
    borderColor: 'transparent',
    marginRight: 10,
  },
  chipSelected: {
    backgroundColor: '#7C5CFF',
    borderColor: '#7C5CFF',
  },
  chipText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
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
    elevation: 3,
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

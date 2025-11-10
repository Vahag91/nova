import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  Keyboard,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SvgIcon from '../components/SvgIcon';
import { useSettingsStore } from '../state/useSettingsStore';
import { useImagesStore } from '../state/useImagesStore';
import { createSbWithDevice, fetchBalanceByDevice } from '../lib/supabaseDevice';
import { ensureDeviceId } from '../lib/deviceId';
import { launchImageLibrary } from 'react-native-image-picker';
import { ensurePhotoLibraryAccess, promptOpenSettings } from '../lib/permissions';
import Reanimated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  useDerivedValue,
  withTiming,
  Easing,
  KeyboardState,
} from 'react-native-reanimated';
import ModelMenu from '../components/image-studio/ModelMenu';
import CreateImageGenerating from '../components/create-image/CreateImageGenerating';
import { getModelVisuals } from '../utils/modelVisuals';
import { getImageModelPrice } from '../utils/imagePricing';
import RNFS from 'react-native-fs';
import { useTranslation } from 'react-i18next';

const STYLES = [
  { id: 'photoreal', name: 'Photoreal', image: require('../../assets/images/createstudio/photoreal.webp'), cost: 3 },
  { id: 'anime', name: 'Anime', image: require('../../assets/images/createstudio/anime.webp'), cost: 2 },
  { id: 'cartoon', name: 'Cartoon', image: require('../../assets/images/createstudio/cartoon.webp'), cost: 2 },
  { id: 'sketch', name: 'Sketch', image: require('../../assets/images/createstudio/sketch.webp'), cost: 1 },
  { id: 'cyberpunk', name: 'Cyberpunk', image: require('../../assets/images/createstudio/cyberpunk.webp'), cost: 2 },
  { id: 'steampunk', name: 'Steampunk', image: require('../../assets/images/createstudio/steampunk.webp'), cost: 2 },
  { id: 'illustration_3d', name: '3D Illustration', image: require('../../assets/images/createstudio/3dillistration.webp'), cost: 3 },
  { id: 'dark_fantasy', name: 'Dark Fantasy', image: require('../../assets/images/createstudio/darkfantasy.webp'), cost: 3 },
  { id: 'vintage_film', name: 'Vintage Film', image: require('../../assets/images/createstudio/vintage.webp'), cost: 1 },
  { id: 'pastel', name: 'Pastel Aesthetic', image: require('../../assets/images/createstudio/pastel.webp'), cost: 1 },
  { id: 'neon_glow', name: 'Neon Glow', image: require('../../assets/images/createstudio/neo.webp'), cost: 2 },
  { id: 'epic_landscape', name: 'Epic Landscape', image: require('../../assets/images/createstudio/epic.webp'), cost: 3 },
];

const DEFAULT_STARTER_PROMPTS = [
  'fix lighting',
  'remove background',
  'soft portrait retouch',
];

const ASPECTS = [
  { key: '1:1', size: '1024x1024', labelKey: 'studioCommon.aspectRatios.square', glyph: { width: 16, height: 16 } },
  { key: '16:9', size: '1024x576', labelKey: 'studioCommon.aspectRatios.landscape', glyph: { width: 20, height: 11 } },
  { key: '3:4', size: '768x1024', labelKey: 'studioCommon.aspectRatios.portrait', glyph: { width: 11, height: 20 } },
];

const IMG2IMG_MODELS = new Set([
  'runware-qwen-image',
  'google:4@1',
]);

export default function EditImage({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Balance
  const coins = useImagesStore(s => s.coinsBalance);
  const setCoinsBalance = useImagesStore(s => s.setCoinsBalance);
  const [coinsLoading, setCoinsLoading] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const id = await ensureDeviceId();
        const sb = createSbWithDevice(id);
        setCoinsLoading(true);
        const bal = await fetchBalanceByDevice(sb, id);
        if (mounted) setCoinsBalance(bal);
      } catch { if (mounted) setCoinsBalance(null); }
      finally { if (mounted) setCoinsLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  // Model from settings
  const models = useSettingsStore(s => s.models);
  const defaultModel = useMemo(() => {
    const entries = Object.entries(models || {});
    const firstAllowed = entries.find(([key, v]) => v?.caps?.imageGen && IMG2IMG_MODELS.has(key));
    if (firstAllowed) return firstAllowed[0];
    const fallback = entries.find(([, v]) => v?.caps?.imageGen);
    return fallback ? fallback[0] : 'runware-qwen-image';
  }, [models]);

  const fluxKontentName = t('studioCommon.models.fluxKontent', { defaultValue: 'Flux Kontent' });
  const imageModels = useMemo(() => {
    const entries = Object.entries(models || {}).filter(([, v]) => v?.caps?.imageGen);
    const filtered = entries.filter(([key]) => IMG2IMG_MODELS.has(key));
    const effective = filtered.length
      ? filtered
      : IMG2IMG_MODELS.has(defaultModel) && models?.[defaultModel]
        ? [[defaultModel, models[defaultModel]]]
        : [];
    if (!effective.length) {
      return [
        {
          key: defaultModel,
          display: { name: defaultModel },
          provider: 'custom',
        },
      ];
    }
    return effective.map(([key, value]) => {
      const baseDisplay = value?.display || { name: key };
      const isFluxKontent = key === 'runware-qwen-image';
      const display = isFluxKontent
        ? { ...baseDisplay, name: fluxKontentName }
        : baseDisplay;
      const providerOverride = isFluxKontent
        ? 'flux-kontent'
        : value?.provider || 'custom';
      return {
        key,
        display,
        provider: providerOverride,
      };
    });
  }, [models, defaultModel, fluxKontentName]);

  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelButtonRef = useRef(null);
  const selectedModelDisplay = useMemo(
    () => imageModels.find(m => m.key === selectedModel),
    [imageModels, selectedModel],
  );
  const fluxKontentTagline = t('studioCommon.modelTaglines.fluxKontent', { defaultValue: 'Flux Kontent tuned for edits' });
  const modelVisuals = useMemo(() => {
    if (selectedModel === 'runware-qwen-image') {
      return {
        icon: 'flux-schnell',
        accent: '#5C6CFF',
        tagline: fluxKontentTagline,
      };
    }
    return getModelVisuals(selectedModelDisplay?.provider, selectedModel);
  }, [selectedModel, selectedModelDisplay?.provider, fluxKontentTagline]);
  const [generatorVisible, setGeneratorVisible] = useState(false);
  const [generatorPayload, setGeneratorPayload] = useState(null);
  const starterPrompts = useMemo(() => {
    const list = t('editImage.starterPrompts.items', { returnObjects: true });
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
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [aspect, setAspect] = useState(ASPECTS[0].key);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [imageUri, setImageUri] = useState('');
  const [imageReference, setImageReference] = useState('');

  useEffect(() => {
    setSelectedModel(defaultModel);
  }, [defaultModel]);

  const headerStyle = useMemo(() => [styles.header, { paddingTop: Math.max(insets.top, 12) + 6 }], [insets.top]);
  const footerInset = Math.max(insets.bottom, 14);
  // Keyboard-aware footer + content
  const keyboard = useAnimatedKeyboard();
  const GAP = 24;
  const kTranslate = useSharedValue(0);
  const kGap = useSharedValue(0);
  useDerivedValue(() => {
    const h = keyboard.height.value;
    const isClosing = keyboard.state.value === KeyboardState.CLOSING;
    const duration = isClosing ? 240 : 40;
    kTranslate.value = withTiming(-h, { duration, easing: Easing.out(Easing.cubic) });
    kGap.value = withTiming(h > 0 ? GAP : 0, { duration, easing: Easing.out(Easing.cubic) });
  });
  const animatedContentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: kTranslate.value }] }));
  const animatedFooterStyle = useAnimatedStyle(() => ({ transform: [{ translateY: kTranslate.value + kGap.value }] }));
  const footerStyle = useMemo(() => [styles.footer, { paddingBottom: footerInset }], [footerInset]);
  const bottomScrollPadding = useMemo(() => 56 + 10 + footerInset + 12, [footerInset]);

  const selectedStyleData = useMemo(() => {
    if (!selectedStyle) return null;
    const style = STYLES.find(s => s.id === selectedStyle);
    if (!style) return null;
    return {
      ...style,
      name: getStyleLabel(style),
    };
  }, [selectedStyle, getStyleLabel]);
  const selectedCost = getImageModelPrice(selectedModel);
  const selectedSize = useMemo(() => (ASPECTS.find(a => a.key === aspect)?.size || '1024x1024'), [aspect]);

  const pickImage = useCallback(async () => {
    const ok = await ensurePhotoLibraryAccess();
    if (!ok) {
      await promptOpenSettings();
      return;
    }
    const res = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, includeBase64: true });
    const asset = res?.assets?.[0];
    if (asset?.uri) {
      setImageUri(asset.uri);
      const mime = asset?.type || 'image/jpeg';
      if (asset?.base64) {
        setImageReference(`data:${mime};base64,${asset.base64}`);
      } else {
        setImageReference(asset.uri);
      }
    }
  }, []);

  const ensureReferenceImage = useCallback(async () => {
    if (!imageUri) return '';
    if (imageReference) return imageReference;
    try {
      const normalized = imageUri.startsWith('file://') ? imageUri.replace('file://', '') : imageUri;
      const base64 = await RNFS.readFile(normalized, 'base64');
      const ext = (imageUri.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1] || 'jpg').toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const dataUri = `data:${mime};base64,${base64}`;
      setImageReference(dataUri);
      return dataUri;
    } catch (error) {
      console.warn('[EditImage] Failed to convert reference image:', error);
      return '';
    }
  }, [imageUri, imageReference]);

  const onGenerate = useCallback(async () => {
    if (!imageUri || busy) return;
    // Insufficient coins: open Coin Store instead of generating
    if ((coins ?? 0) < (selectedCost ?? 0)) {
      try { navigation.navigate('CoinStore'); } catch {}
      return;
    }
    setBusy(true);
    const basePrompt = prompt.trim();
    const styleTag = selectedStyleData?.name ? `${selectedStyleData.name} style` : null;
    let promptWithStyle = basePrompt;
    if (styleTag && basePrompt) {
      promptWithStyle = `${styleTag}, ${basePrompt}`;
    } else if (styleTag && !basePrompt) {
      promptWithStyle = styleTag;
    }
    const referenceImage = await ensureReferenceImage();
    if (!referenceImage) {
      setBusy(false);
      Alert.alert(t('editImage.imageUnavailable.title'), t('editImage.imageUnavailable.message'));
      return;
    }
    const references = Array.from(
      new Set(referenceImage ? [referenceImage] : []),
    );
    const payload = {
      prompt: promptWithStyle || '__BLANK__',
      originalPrompt: basePrompt,
      styleId: selectedStyleData?.id || null,
      styleName: selectedStyleData?.name || null,
      model: selectedModel,
      size: selectedSize,
      mode: 'img2img',
      outputFormat: 'JPEG',
      outputType: ['URL'],
      includeCost: true,
    };
    if (!references.length) {
      setBusy(false);
      Alert.alert(t('editImage.imageUnavailable.title'), t('editImage.imageUnavailable.message'));
      return;
    }
    if (selectedModel === 'runware-qwen-image') {
      Object.assign(payload, {
        steps: 28,
        CFGScale: 2.5,
        scheduler: 'Default',
        checkNSFW: true,
        referenceImages: references,
        advancedFeatures: {
          guidanceEndStepPercentage: 75,
        },
      });
    } else if (selectedModel === 'google:4@1') {
      Object.assign(payload, {
        referenceImages: references,
      });
    } else {
      Object.assign(payload, {
        referenceImages: references,
      });
    }
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[EditImage] payload to generator:', payload);
    }
    setGeneratorPayload(payload);
    setGeneratorVisible(true);
    Keyboard.dismiss();
  }, [
    imageUri,
    busy,
    prompt,
    selectedStyleData,
    selectedModel,
    selectedSize,
    ensureReferenceImage,
    coins,
    selectedCost,
    navigation,
  ]);

  const renderStyle = useCallback(
    ({ item }) => {
      const selected = item.id === selectedStyle;
      const label = getStyleLabel(item);
      return (
        <Pressable
          onPress={() =>
            setSelectedStyle(prev => (prev === item.id ? null : item.id))
          }
          style={[styles.styleItem, selected && styles.styleItemSelected]}
        >
          <View style={[styles.styleThumbWrap, selected && styles.styleThumbSelected]}>
            <Image
              source={typeof item.image === 'number' ? item.image : { uri: item.image }}
              style={styles.styleThumb}
              fadeDuration={0}
            />
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
  const renderChip = useCallback(({ item }) => (
    <Pressable onPress={() => setPrompt(p => (p ? p : item))} style={styles.chip}>
      <Text style={styles.chipText}>{item}</Text>
    </Pressable>
  ), []);
  const keyChip = useCallback((it, idx) => `${idx}-${it}` , []);

  const handleGeneratorClose = useCallback(() => {
    setGeneratorVisible(false);
    setGeneratorPayload(null);
    setBusy(false);
  }, []);

  return (
    <View style={styles.container}>
      <View style={headerStyle}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerBackBtn} hitSlop={10}>
            <SvgIcon name="chevron-left" size={22} color="#FFFFFF" />
          </Pressable>
          <View pointerEvents="none" style={styles.headerCenterAbs}>
            <Text style={styles.headerTitle}>{t('editImage.headerTitle')}</Text>
          </View>
          <Pressable onPress={() => navigation.navigate('CoinStore')} style={styles.balancePill} hitSlop={8}>
            <Text style={styles.balanceText}>{coinsLoading ? '…' : `◈ ${coins ?? '—'}`}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomScrollPadding }]}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <Reanimated.View style={[styles.content, animatedContentStyle]}>
          {/* Upload / preview */}
          <View style={styles.uploadCard}>
            {imageUri ? (
              <View>
                <Image source={{ uri: imageUri }} style={styles.uploadPreview} resizeMode="cover" />
                <View style={styles.uploadActions}>
                  <Pressable style={styles.uploadBtn} onPress={pickImage}><Text style={styles.uploadBtnText}>{t('editImage.upload.change')}</Text></Pressable>
                  <Pressable
                    style={styles.uploadBtn}
                    onPress={() => {
                      setImageUri('');
                      setImageReference('');
                    }}
                  >
                    <Text style={styles.uploadBtnText}>{t('editImage.upload.remove')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={styles.uploadEmpty} onPress={pickImage}>
                <SvgIcon name="photo" size={24} color={'rgba(255,255,255,0.8)'} />
                <Text style={styles.uploadEmptyText}>{t('editImage.upload.choose')}</Text>
              </Pressable>
            )}
          </View>

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
              </View>
              <View style={styles.modelButtonChevron}>
                <SvgIcon name="chevron-down" size={16} color="rgba(255,255,255,0.9)" />
              </View>
            </Pressable>
          </View>

          {/* Choose a Style */}
          <View style={styles.rowBetween}>
            <Text style={styles.sectionLabel}>{t('editImage.chooseStyle')}</Text>
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

          {/* Starter prompts */}
          <Text style={[styles.sectionLabel, styles.mt6]}>{t('editImage.starterPrompts.title')}</Text>
          <FlatList
            data={starterPrompts}
            keyExtractor={keyChip}
            renderItem={renderChip}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsList}
            initialNumToRender={6}
            windowSize={3}
            removeClippedSubviews
          />

          <Text style={[styles.sectionLabel, styles.mt6]}>{t('editImage.aspectRatio')}</Text>
          <View style={styles.aspectList}>
            {ASPECTS.map(a => {
              const active = aspect === a.key;
              return (
                <Pressable
                  key={a.key}
                  onPress={() => setAspect(a.key)}
                  style={[styles.aspectCard, active && styles.aspectCardActive]}
                >
                  <View
                    style={[styles.aspectGlyphWrap, active && styles.aspectGlyphWrapActive]}
                  >
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
          {/* Prompt */}
          <View style={styles.promptWrap}>
            <TextInput
              style={styles.prompt}
              placeholder={t('editImage.promptPlaceholder')}
              placeholderTextColor={'rgba(255,255,255,0.65)'}
              multiline
              value={prompt}
              onChangeText={setPrompt}
              textAlignVertical="top"
            />
            {prompt?.length > 0 && (
              <Pressable onPress={() => setPrompt('')} style={styles.promptClearBtn} hitSlop={8} accessibilityLabel={t('editImage.clearText')}>
                <SvgIcon name="clear" size={18} color={'rgba(255,255,255,0.8)'} />
              </Pressable>
            )}
          </View>
        </Reanimated.View>
      </ScrollView>

      <Reanimated.View style={[footerStyle, animatedFooterStyle]}>
        <Pressable
          onPress={onGenerate}
          disabled={!imageUri || busy}
          style={[styles.generateBtn, (!imageUri || busy) && styles.generateBtnDisabled]}
        >
          <View style={styles.generateContent}>
            <View style={styles.generateIconWrap}>
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <SvgIcon name="stars" size={18} color="#FFFFFF" />
              )}
            </View>
                <Text style={styles.generateBtnText}>{busy ? t('editImage.generating') : t('editImage.generate')}</Text>
            <View style={styles.generateCoinsWrap}>
              <SvgIcon
                name="diamond"
                size={12}
                color={busy ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)'}
              />
              <Text
                style={[styles.generateCoinsText, busy && { color: 'rgba(255,255,255,0.5)' }]}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, position: 'relative' },
  headerBackBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenterAbs: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  balancePill: { height: 40, flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 8 },
  balanceText: { color: '#7C5CFF', fontSize: 16, fontWeight: '800' },

  content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  modelWrap: { gap: 8 },
  modelButton: {
    minHeight: 60,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0B0B0E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modelSimpleInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  modelSimpleIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelButtonName: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', flexShrink: 1 },
  modelButtonChevron: { marginLeft: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
  mt6: { marginTop: 18 },

  uploadCard: { borderRadius: 16, backgroundColor: '#17171C', padding: 12 },
  uploadEmpty: { height: 160, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', gap: 8 },
  uploadEmptyText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  uploadPreview: { width: '100%', aspectRatio: 1, borderRadius: 12 },
  uploadActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  uploadBtn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  uploadBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  stylesList: { paddingTop: 4, paddingBottom: 6, gap: 12 },
  styleItem: { width: 140, marginRight: 12, marginBottom: 12, alignItems: 'center' },
  styleItemSelected: {},
  styleThumbWrap: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#11131B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    height: 128,
  },
  styleThumbSelected: { borderColor: '#7C5CFF', borderWidth: 2 },
  styleThumb: { width: '100%', height: '100%', borderRadius: 18, resizeMode: 'cover' },
  styleName: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  styleNameSelected: { fontWeight: '800' },

  chip: { height: 40, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: '#17171C', marginRight: 10 },
  chipsList: { gap: 10 },
  chipText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },

  promptWrap: { gap: 6, marginTop: 6 },
  prompt: { minHeight: 100, borderRadius: 12, padding: 14, backgroundColor: '#17171C', color: '#FFFFFF', fontSize: 16 },
  promptClearBtn: { position: 'absolute', right: 10, top: 10, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },

  aspectList: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  aspectCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
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
  aspectGlyphWrapActive: {},
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

  scrollContent: { paddingBottom: 24 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11,11,14,0.86)', paddingHorizontal: 16, paddingTop: 10 },
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
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '700',
  },
});

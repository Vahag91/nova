import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ImageBackground,
  TextInput,
  Keyboard,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SvgIcon from '../components/SvgIcon';
import { useImagesStore } from '../state/useImagesStore';
import { useSettingsStore } from '../state/useSettingsStore';
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

const STYLES = [
  { id: 'photoreal', name: 'Photoreal', image: require('../../assets/images/createstudio/photoreal.webp'), cost: 3, selected: true },
  { id: 'anime', name: 'Anime', image: require('../../assets/images/createstudio/anime.webp'), cost: 2 },
  { id: 'render3d', name: '3D', image: require('../../assets/images/createstudio/3dillistration.webp'), cost: 3 },
];

const STARTER_PROMPTS = [
  'fix lighting',
  'remove background',
  'soft portrait retouch',
];

const ASPECTS = [
  { key: '1:1', size: '1024x1024' },
  { key: '3:4', size: '768x1024' },
  { key: '16:9', size: '1024x576' },
];

function glyphActive(key) {
  return {
    borderColor: '#7C5CFF',
    width: key === '3:4' ? 16 : key === '16:9' ? 24 : 20,
    height: key === '3:4' ? 20 : key === '16:9' ? 12 : 20,
  };
}

export default function EditImage({ navigation }) {
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
      } catch { if (mounted) setCoins(null); }
      finally { if (mounted) setCoinsLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  // Model from settings
  const models = useSettingsStore(s => s.models);
  const defaultModel = useMemo(() => {
    const entries = Object.entries(models || {});
    const first = entries.find(([, v]) => v?.caps?.imageGen);
    return first ? first[0] : 'runware-flux-dev';
  }, [models]);

  const runImg2Img = useImagesStore(s => s.runImg2Img);

  const [selectedStyle, setSelectedStyle] = useState(STYLES.find(s => s.selected)?.id || STYLES[0].id);
  const [aspect, setAspect] = useState(ASPECTS[0].key);
  const [guidance, setGuidance] = useState(7.5);
  const [strength, setStrength] = useState(0.85);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [imageUri, setImageUri] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(true);

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

  const selectedCost = useMemo(() => (STYLES.find(s => s.id === selectedStyle)?.cost || 2), [selectedStyle]);
  const selectedSize = useMemo(() => (ASPECTS.find(a => a.key === aspect)?.size || '1024x1024'), [aspect]);

  const pickImage = useCallback(async () => {
    const ok = await ensurePhotoLibraryAccess();
    if (!ok) {
      await promptOpenSettings();
      return;
    }
    const res = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, includeBase64: false });
    const asset = res?.assets?.[0];
    if (asset?.uri) setImageUri(asset.uri);
  }, []);

  const onGenerate = useCallback(async () => {
    if (!imageUri || busy) return;
    setBusy(true);
    try {
      await runImg2Img({
        prompt: prompt.trim() || '__BLANK__',
        model: defaultModel,
        size: selectedSize,
        seedImage: imageUri,
        strength,
        CFGScale: guidance,
        outputType: 'URL',
        outputFormat: 'JPG',
        outputQuality: 95,
      });
      Keyboard.dismiss();
      navigation.navigate('ImagesStudio');
    } catch (e) {
    } finally {
      setBusy(false);
    }
  }, [imageUri, prompt, busy, runImg2Img, defaultModel, selectedSize, strength, guidance, navigation]);

  const renderStyle = useCallback(({ item }) => {
    const selected = item.id === selectedStyle;
    return (
      <Pressable onPress={() => setSelectedStyle(item.id)} style={[styles.styleItem, selected && styles.styleItemSelected]}>
        <View style={[styles.styleThumbWrap, selected && styles.styleThumbSelected]}> 
          <Image
            source={typeof item.image === 'number' ? item.image : { uri: item.image }}
            style={[styles.styleThumb, styles.styleThumbImage]}
            fadeDuration={0}
          />
          <View style={styles.costPill}>
            <Text style={styles.costPillText}>{item.cost}</Text>
            <Text style={[styles.costPillText, styles.costPillDiamond]}> ◈</Text>
          </View>
        </View>
        <Text style={[styles.styleName, selected && styles.styleNameSelected]} numberOfLines={1}>{item.name}</Text>
      </Pressable>
    );
  }, [selectedStyle]);

  const keyStyle = useCallback((it) => it.id, []);
  const renderChip = useCallback(({ item }) => (
    <Pressable onPress={() => setPrompt(p => (p ? p : item))} style={styles.chip}>
      <Text style={styles.chipText}>{item}</Text>
    </Pressable>
  ), []);
  const keyChip = useCallback((it, idx) => `${idx}-${it}` , []);

  return (
    <View style={styles.container}>
      <View style={headerStyle}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerBackBtn} hitSlop={10}>
            <SvgIcon name="chevron-left" size={22} color="#FFFFFF" />
          </Pressable>
          <View pointerEvents="none" style={styles.headerCenterAbs}>
            <Text style={styles.headerTitle}>Edit</Text>
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
                  <Pressable style={styles.uploadBtn} onPress={pickImage}><Text style={styles.uploadBtnText}>Change</Text></Pressable>
                  <Pressable style={styles.uploadBtn} onPress={() => setImageUri('')}><Text style={styles.uploadBtnText}>Remove</Text></Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={styles.uploadEmpty} onPress={pickImage}>
                <SvgIcon name="photo" size={24} color={'rgba(255,255,255,0.8)'} />
                <Text style={styles.uploadEmptyText}>Choose Photo</Text>
              </Pressable>
            )}
          </View>

          {/* Choose a Style */}
          <View style={styles.rowBetween}> 
            <Text style={styles.sectionLabel}>Choose a Style</Text>
            <Pressable hitSlop={6}><Text style={styles.link}>Browse more</Text></Pressable>
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

          {/* Advanced */}
          <View style={styles.advancedWrap}>
            <Pressable style={styles.advancedHeader} onPress={() => setAdvancedOpen(o => !o)}>
              <Text style={styles.sectionLabel}>Advanced</Text>
            </Pressable>
            {advancedOpen && (
              <View style={styles.advancedContent}>
                <Text style={styles.advLabel}>Aspect Ratio</Text>
                <View style={styles.aspectRow}>
                  {ASPECTS.map((a) => {
                    const active = aspect === a.key;
                    return (
                      <Pressable key={a.key} onPress={() => setAspect(a.key)} style={[styles.aspectBtn, active && styles.aspectBtnActive]}>
                        <View style={[styles.aspectGlyph, active && glyphActive(a.key)]} />
                        <Text style={[styles.aspectText, active && styles.aspectTextActive]}>{a.key}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.guidanceRow}>
                  <Text style={styles.advLabel}>Strength</Text>
                  <Text style={styles.advValue}>{strength.toFixed(2)}</Text>
                </View>
                <View style={styles.stepperRow}>
                  <Pressable style={styles.stepBtn} onPress={() => setStrength(s => Math.max(0.1, +(s - 0.05).toFixed(2)))}>
                    <Text style={styles.stepBtnText}>−</Text>
                  </Pressable>
                  <Pressable style={styles.stepBtn} onPress={() => setStrength(s => Math.min(1.0, +(s + 0.05).toFixed(2)))}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </Pressable>
                </View>

                <View style={styles.guidanceRow}>
                  <Text style={styles.advLabel}>Guidance</Text>
                  <Text style={styles.advValue}>{guidance.toFixed(1)}</Text>
                </View>
                <View style={styles.stepperRow}>
                  <Pressable style={styles.stepBtn} onPress={() => setGuidance(g => Math.max(0, +(g - 0.5).toFixed(1)))}>
                    <Text style={styles.stepBtnText}>−</Text>
                  </Pressable>
                  <Pressable style={styles.stepBtn} onPress={() => setGuidance(g => Math.min(10, +(g + 0.5).toFixed(1)))}>
                    <Text style={styles.stepBtnText}>+</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
          {/* Prompt (moved below advanced) */}
          <View style={styles.promptWrap}>
            <TextInput
              style={styles.prompt}
              placeholder="Describe edits (optional)"
              placeholderTextColor={'rgba(255,255,255,0.65)'}
              multiline
              value={prompt}
              onChangeText={setPrompt}
              textAlignVertical="top"
            />
            {prompt?.length > 0 && (
              <Pressable onPress={() => setPrompt('')} style={styles.promptClearBtn} hitSlop={8} accessibilityLabel="Clear text">
                <SvgIcon name="clear" size={18} color={'rgba(255,255,255,0.8)'} />
              </Pressable>
            )}
          </View>
        </Reanimated.View>
      </ScrollView>

      <Reanimated.View style={[footerStyle, animatedFooterStyle]}>
        <Pressable onPress={onGenerate} disabled={!imageUri || busy} style={[styles.generateBtn, (!imageUri || busy) && styles.generateBtnDisabled]}>
          <Text style={styles.generateBtnText}>Generate ({selectedCost} ◈)</Text>
        </Pressable>
      </Reanimated.View>
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
  balancePill: { height: 40, flexDirection: 'row', alignItems: 'center', backgroundColor: '#17171C', borderRadius: 999, paddingHorizontal: 12 },
  balanceText: { color: '#7C5CFF', fontSize: 14, fontWeight: '800' },

  content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
  link: { color: '#7C5CFF', fontSize: 13, fontWeight: '700' },

  uploadCard: { borderRadius: 16, backgroundColor: '#17171C', padding: 12 },
  uploadEmpty: { height: 160, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', gap: 8 },
  uploadEmptyText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  uploadPreview: { width: '100%', aspectRatio: 1, borderRadius: 12 },
  uploadActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  uploadBtn: { flex: 1, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  uploadBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  stylesList: { paddingTop: 4, paddingBottom: 6, gap: 12 },
  styleItem: { width: 128, height: 128, marginRight: 12 },
  styleItemSelected: {},
  styleThumbWrap: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#1A1A1D', height: '100%' },
  styleThumbSelected: { borderWidth: 2, borderColor: '#7C5CFF' },
  styleThumb: { width: '100%', aspectRatio: 1 },
  styleThumbImage: { borderRadius: 12 },
  costPill: { position: 'absolute', right: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  costPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  costPillDiamond: { color: '#7C5CFF' },
  styleName: { color: '#FFFFFF', fontSize: 12, marginTop: 6, textAlign: 'center' },
  styleNameSelected: { fontWeight: '800' },

  chip: { height: 40, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: '#17171C', marginRight: 10 },
  chipsList: { gap: 10 },
  chipText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },

  promptWrap: { gap: 6, marginTop: 6 },
  prompt: { minHeight: 100, borderRadius: 12, padding: 14, backgroundColor: '#17171C', color: '#FFFFFF', fontSize: 16 },
  promptClearBtn: { position: 'absolute', right: 10, top: 10, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },

  advancedWrap: { marginTop: 8 },
  advancedHeader: { paddingVertical: 10 },
  advancedContent: { gap: 12, paddingTop: 6, paddingBottom: 4 },
  advLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  advValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  aspectRow: { flexDirection: 'row', gap: 10 },
  aspectBtn: { flex: 1, height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17171C' },
  aspectBtnActive: { borderWidth: 2, borderColor: '#7C5CFF' },
  aspectGlyph: { width: 20, height: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 3, marginBottom: 6 },
  aspectText: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  aspectTextActive: { color: '#FFFFFF', fontWeight: '700' },

  scrollContent: { paddingBottom: 24 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11,11,14,0.86)', paddingHorizontal: 16, paddingTop: 10 },
  generateBtn: { height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7C5CFF', ...Platform.select({ ios: { shadowColor: '#7C5CFF', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }, android: { elevation: 3 } }) },
  generateBtnDisabled: { opacity: 0.6 },
  generateBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});

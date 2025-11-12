import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  FlatList,
  Dimensions,
  Platform,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import SvgIcon from '../components/SvgIcon';
import { useImagesStore } from '../state/useImagesStore';
import { normalizeImageUri } from '../lib/imageUtils';
import { createSbWithDevice, fetchBalanceByDevice } from '../lib/supabaseDevice';
import { ensureDeviceId } from '../lib/deviceId';
import ImageViewer from '../components/image-studio/ImageViewer';
import LinearGradient from 'react-native-linear-gradient';
import MaskedViewIOS from '@react-native-masked-view/masked-view';
import Svg, { Path } from 'react-native-svg';
import { getImageModelPrice } from '../utils/imagePricing';
import HeroVideo from '../components/navigation/HeroVideo';

const CREATE_VIDEO = require('../../assets/video/create.mp4');
const EDIT_VIDEO = require('../../assets/video/hero.mp4');

const CARD_ASPECT = 16 / 9;

function GradientText({
  children,
  style,
  colors = ['#42d392', '#647eff'], // green → blue (same as PaywallScreen)
  start = { x: 0, y: 0 },
  end = { x: 1, y: 0 },
}) {
  return (
    <MaskedViewIOS
      style={styles.gradientTextContainer}
      maskElement={
        <View style={styles.maskWrap}>
          <Text style={[style, styles.maskText]}>{children}</Text>
        </View>
      }
    >
      <LinearGradient colors={colors} start={start} end={end}>
        <Text style={[style, styles.invisibleText]}>{children}</Text>
      </LinearGradient>
    </MaskedViewIOS>
  );
}

export default function StudioHome({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const isFocused = useIsFocused();

  // Coin balance
  const coins = useImagesStore(s => s.coinsBalance);
  const setCoinsBalance = useImagesStore(s => s.setCoinsBalance);
  const [coinsLoading, setCoinsLoading] = useState(false);
  const coinsClientRef = useRef(null);
  const deviceIdRef = useRef(null);
  const createCost = useMemo(() => getImageModelPrice('runware-flux-schnell'), []);
  const editCost = useMemo(() => getImageModelPrice('runware-qwen-image'), []);

  useEffect(() => {
    // Enable smooth layout animations on Android
    try { if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) UIManager.setLayoutAnimationEnabledExperimental(true); } catch {}
    
    // Only fetch coins if balance is not already loaded
    if (coins !== null && coins !== undefined) {
      return;
    }
    
    let mounted = true;
    (async () => {
      try {
        const id = await ensureDeviceId();
        deviceIdRef.current = id;
        const sb = createSbWithDevice(id);
        coinsClientRef.current = sb;
        setCoinsLoading(true);
        const bal = await fetchBalanceByDevice(sb, id);
        if (mounted) setCoinsBalance(bal);
      } catch (e) {
        if (mounted) setCoinsBalance(null);
      } finally {
        if (mounted) setCoinsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [coins, setCoinsBalance]);

  // Recent images from jobs store
  const jobs = useImagesStore(s => s.jobs);
  const images = useMemo(() => {
    const done = (jobs || []).filter(j => j?.status === 'done');
    const result = done.flatMap((j, jdx) => (j.images || []).map((img, idx) => {
      const normalizedUrl = normalizeImageUri(img?.url);
      // Preserve the image's own id if present (it's already globally unique in the store).
      const uniqueId = img?.id || `${j.id || 'job'}:${jdx}:${idx}`;
      return normalizedUrl ? {
        id: uniqueId,
        jobId: j.id,
        url: normalizedUrl,
        originalUrl: img?.originalUrl || img?.url,
        prompt: j.prompt,
        size: j.size || '1024x1024',
        model: j.model,
      } : null;
    })).filter(Boolean);
    return result;
  }, [jobs]);

  // Gallery items: show only real images; no placeholders
  const galleryItems = useMemo(() => images || [], [images]);

  // Viewer
  const [viewer, setViewer] = useState({ open: false, uri: '', id: null, jobId: null });

  // Multi-select state for gallery
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState(new Set());
  const [showBatchActions, setShowBatchActions] = useState(false);
  const deleteImage = useImagesStore(s => s.deleteImage);

  const toggleSelectionMode = useCallback(() => {
    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch {}
    setIsSelectionMode(prev => !prev);
    setSelectedImages(new Set());
    setShowBatchActions(false);
  }, []);

  const toggleImageSelection = useCallback((imageId) => {
    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch {}
    const next = new Set(selectedImages);
    if (next.has(imageId)) next.delete(imageId); else next.add(imageId);
    setSelectedImages(next);
    setShowBatchActions(next.size > 0);
  }, [selectedImages]);

  const selectAllImages = useCallback(() => {
    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch {}
    const all = new Set(galleryItems.map(g => g.id));
    setSelectedImages(all);
    setShowBatchActions(all.size > 0);
  }, [galleryItems]);

  const clearSelection = useCallback(() => {
    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch {}
    setSelectedImages(new Set());
    setShowBatchActions(false);
  }, []);

  const deleteSelectedImages = useCallback(() => {
    if (selectedImages.size === 0) return;
    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch {}
    const targets = [];
    selectedImages.forEach(imageId => {
      const it = galleryItems.find(g => g.id === imageId);
      if (it?.jobId) targets.push({ jobId: it.jobId, imageId: it.id });
    });
    targets.forEach(({ jobId, imageId }) => {
      try { deleteImage(jobId, imageId); } catch {}
    });
    clearSelection();
    setIsSelectionMode(false);
  }, [selectedImages, galleryItems, deleteImage, clearSelection]);

  const openCreate = useCallback(() => {
    navigation.navigate('CreateImage');
  }, [navigation]);

  const openEdit = useCallback(() => {
    navigation.navigate('EditImage');
  }, [navigation]);

  const renderTile = useCallback(({ item }) => {
    const size = (Dimensions.get('window').width - 4 * 12) / 3; // 3 cols, 12 padding/gap
    const selected = selectedImages.has(item.id);
    return (
      <Pressable
        onPress={() => {
          if (isSelectionMode) {
            toggleImageSelection(item.id);
          } else {
            setViewer({ open: true, uri: item.url, id: item.id, jobId: item.jobId });
          }
        }}
        onLongPress={() => {
          if (!isSelectionMode) {
            setIsSelectionMode(true);
            toggleImageSelection(item.id);
          }
        }}
        style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1A1A1D' }}
      >
        <Image source={{ uri: item.url }} style={{ flex: 1 }} resizeMode="cover" />
        {isSelectionMode && (
          <View style={styles.selectionOverlay}>
            <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
              {selected && <SvgIcon name="check" size={14} color="#0B0B0E" />}
            </View>
          </View>
        )}
      </Pressable>
    );
  }, [isSelectionMode, selectedImages, toggleImageSelection]);

  // Dynamic styles
  const headerStyle = React.useMemo(
    () => [styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }],
    [insets.top]
  );
  const listContentStyle = React.useMemo(
    () => [styles.listContent, { paddingBottom: Math.max(insets.bottom, 24) }],
    [insets.bottom]
  );
  const tileSize = React.useMemo(() => (Dimensions.get('window').width - 4 * 12) / 3, []);
  const tileDynamicStyle = React.useMemo(() => ({ width: tileSize, height: tileSize }), [tileSize]);
  const selectionToggleLabel = isSelectionMode
    ? t('studioHome.gallery.selection.exit')
    : t('studioHome.gallery.selection.enter');
  const deleteButtonLabel = selectedImages.size > 0
    ? t('studioHome.gallery.selection.deleteSelected')
    : t('studioHome.gallery.selection.selectForDelete');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={headerStyle}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => navigation.toggleDrawer?.()}
            style={styles.headerBackBtn}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('studioHome.accessibility.openMenu')}
          >
            <SvgIcon name="menu" size={22} color="#FFFFFF" />
          </Pressable>
          <View pointerEvents="none" style={styles.headerCenterAbs}>
            <GradientText style={styles.headerTitle}>{t('studioHome.headerTitle')}</GradientText>
          </View>
          {/* Removed top header selection icon for minimalist design */}
          <Pressable onPress={() => navigation.navigate('CoinStore')} style={styles.balancePill} hitSlop={8}>
            <View style={styles.balanceContent}>
              <Svg height={14} width={14} viewBox="0 -960 960 960" fill="#FF9500">
                <Path d="M480-120q-151 0-255.5-46.5T120-280v-400q0-66 105.5-113T480-840q149 0 254.5 47T840-680v400q0 67-104.5 113.5T480-120Zm0-479q89 0 179-25.5T760-679q-11-29-100.5-55T480-760q-91 0-178.5 25.5T200-679q14 30 101.5 55T480-599Zm0 199q42 0 81-4t74.5-11.5q35.5-7.5 67-18.5t57.5-25v-120q-26 14-57.5 25t-67 18.5Q600-528 561-524t-81 4q-42 0-82-4t-75.5-11.5Q287-543 256-554t-56-25v120q25 14 56 25t66.5 18.5Q358-408 398-404t82 4Zm0 200q46 0 93.5-7t87.5-18.5q40-11.5 67-26t32-29.5v-98q-26 14-57.5 25t-67 18.5Q600-328 561-324t-81 4q-42 0-82-4t-75.5-11.5Q287-343 256-354t-56-25v99q5 15 31.5 29t66.5 25.5q40 11.5 88 18.5t94 7Z" />
              </Svg>
              <Text style={styles.balanceText}>{coinsLoading ? '…' : coins ?? '—'}</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Batch actions bar removed for minimalist header controls */}

      {/* Body */}
      <FlatList
        contentContainerStyle={listContentStyle}
        extraData={{ isSelectionMode, selSize: selectedImages.size }}
        ListHeaderComponent={
          <View style={styles.headerGroup}>
            {/* Create Card */}
            <View style={styles.card}>
              <HeroVideo
                style={styles.absoluteFill}
                source={CREATE_VIDEO}
                enforceAspectRatio={false}
                paused={!isFocused}
                placeholderColor="#17171C"
              />
              <LinearGradient
                colors={["rgba(0,0,0,0.7)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.05)"]}
                locations={[0, 0.4, 1]}
                start={{ x: 0.5, y: 1 }}
                end={{ x: 0.5, y: 0 }}
                style={styles.cardOverlay}
              />
              <View style={styles.cardContent}>
                <View style={styles.labelPill}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardIconWrap}><SvgIcon name="quill" size={22} color="#FFFFFF" /></View>
                    <View style={styles.cardTextCol}>
                      <Text style={styles.cardTitle}>{t('studioHome.createCard.title')}</Text>
                      <Text style={styles.cardSubtitle}>{t('studioHome.createCard.subtitle')}</Text>
                    </View>
                  </View>
                </View>
                <Pressable onPress={openCreate} style={[styles.primaryBtn]} hitSlop={6}>
                  <Text style={styles.primaryBtnText}>{t('studioHome.createCard.cta')}</Text>
                </Pressable>
              </View>
            </View>

            {/* Edit Card */}
            <View style={styles.card}>
              <HeroVideo
                style={styles.absoluteFill}
                source={EDIT_VIDEO}
                enforceAspectRatio={false}
                paused={!isFocused}
                placeholderColor="#17171C"
              />
              <LinearGradient
                colors={["rgba(0,0,0,0.7)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.05)"]}
                locations={[0, 0.4, 1]}
                start={{ x: 0.5, y: 1 }}
                end={{ x: 0.5, y: 0 }}
                style={styles.cardOverlay}
              />
              <View style={styles.cardContent}>
                <View style={styles.labelPill}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardIconWrap}>
                      <SvgIcon name="stars" size={22} color="#FFFFFF" />
                    </View>
                    <View style={styles.cardTextCol}>
                      <Text style={styles.cardTitle}>{t('studioHome.editCard.title')}</Text>
                      <Text style={styles.cardSubtitle}>{t('studioHome.editCard.subtitle')}</Text>
                    </View>
                  </View>
                </View>
                <Pressable onPress={openEdit} style={[styles.secondaryBtn]} hitSlop={6}>
                  <Text style={styles.secondaryBtnText}>{t('studioHome.editCard.cta')}</Text>
                </Pressable>
              </View>
            </View>

            {/* Gallery header */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>{t('studioHome.gallery.title')}</Text>
              <View style={styles.sectionActions}>
                <Pressable
                  onPress={() => {
                    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch {}
                    toggleSelectionMode();
                  }}
                  hitSlop={8}
                  style={styles.sectionHeaderBtn}
                  accessibilityLabel={selectionToggleLabel}
                >
                  <SvgIcon name="copygrey" size={18} color={isSelectionMode ? '#8A42FF' : '#FFFFFF'} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (selectedImages.size > 0) {
                      try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch {}
                      deleteSelectedImages();
                    } else if (!isSelectionMode) {
                      toggleSelectionMode();
                    }
                  }}
                  hitSlop={8}
                  style={[styles.sectionHeaderBtn, selectedImages.size > 0 && { backgroundColor: 'rgba(220,50,50,0.2)' }]}
                  accessibilityLabel={deleteButtonLabel}
                >
                  <SvgIcon name="delete" size={18} color={selectedImages.size > 0 ? '#FFB0B0' : '#FFFFFF'} />
                </Pressable>
              </View>
            </View>
          </View>
        }
        data={galleryItems}
        keyExtractor={(item) => item.id}
        renderItem={renderTile}
        numColumns={3}
        columnWrapperStyle={styles.columnWrapper}
        ListEmptyComponent={<Text style={styles.emptyText}>{t('studioHome.gallery.empty')}</Text>}
        showsVerticalScrollIndicator={false}
      />

      {/* Image viewer modal */}
      <ImageViewer
        visible={viewer.open}
        imageUri={viewer.uri}
        imageId={viewer.id}
        jobId={viewer.jobId}
        hideEdit
        onClose={() => setViewer({ open: false, uri: '', id: null, jobId: null })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0B0E' },
  absoluteFill: { ...StyleSheet.absoluteFillObject },
  flex1: { flex: 1 },
  header: {
    paddingVertical: 22,
    backgroundColor: 'rgba(11,11,14,0.92)',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, position: 'relative' },
  headerBackBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenterAbs: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 0.3 },
  headerButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  headerButtonActive: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10 },
  balancePill: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
  },
  balanceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  balanceText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  card: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#17171C',
    aspectRatio: CARD_ASPECT,
  },
  cardOverlay: { ...StyleSheet.absoluteFillObject },
  cardContent: { flex: 1, justifyContent: 'flex-end', padding: 16, gap: 10 },
  labelPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,92,255,0.25)' },
  cardTextCol: { maxWidth: '82%' },
  cardTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  cardSubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 1 },

  primaryBtn: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7C5CFF' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryBtn: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  secondaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  sectionHeader: { marginTop: 8, marginBottom: 8, color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 8 },
  sectionHeaderBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emptyText: { color: 'rgba(255,255,255,0.65)', paddingVertical: 24 },
  listContent: { padding: 12 },
  columnWrapper: { gap: 12, marginBottom: 12 },
  headerGroup: { gap: 12 },
  tile: { borderRadius: 10, overflow: 'hidden', backgroundColor: '#1A1A1D' },
  selectionOverlay: { position: 'absolute', top: 8, right: 8, zIndex: 2 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  batchActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(11,11,14,0.92)'
  },
  batchActionsLeft: { flexDirection: 'row', alignItems: 'center' },
  batchActionsRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  batchActionsText: { color: '#FFFFFF', fontSize: 13, opacity: 0.8 },
  selectAllButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectAllButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  deleteButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(220,50,50,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  // Gradient text styles
  gradientTextContainer: {
    alignSelf: 'center', // centers gradient to text width
  },
  maskWrap: {
    backgroundColor: 'transparent',
  },
  maskText: {
    // must be opaque so the mask is solid
    color: '#000', // mask color; not visible to user
  },
  invisibleText: {
    opacity: 0, // not visible; defines gradient's layout size
  },
});

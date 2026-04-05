import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  FlatList,
  Dimensions,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import SvgIcon from '../components/SvgIcon';
import { useImagesStore } from '../state/useImagesStore';
import { normalizeImageUri } from '../lib/imageUtils';
import ImageViewer from '../components/image-studio/ImageViewer';
import { perfEnd, perfLog, perfStart } from '../lib/perfTrace';
import { useAndroidNavigationMenu } from '../navigation/AndroidNavigationMenuContext';

const CREATE_IMAGE = require('../../assets/images/createstudio/photoreal.webp');
const EDIT_IMAGE = require('../../assets/images/createstudio/anime.webp');

const CARD_ASPECT = 16 / 9;

function GradientText({ children, style }) {
  return <Text style={style}>{children}</Text>;
}

export default function StudioHome({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const isFocused = useIsFocused();
  const { openMenu, reportScreenReady } = useAndroidNavigationMenu();
  const rootLayoutLoggedRef = useRef(false);
  const rootLayoutSeenRef = useRef(false);
  const screenReadyReportedRef = useRef(false);
  const headerLayoutLoggedRef = useRef(false);
  const contentSizeLoggedRef = useRef(false);

  useEffect(() => {
    perfLog('studio.screen.mounted');
    return () => {
      perfLog('studio.screen.unmounted');
    };
  }, []);

  useEffect(() => {
    perfLog('studio.screen.focus', {
      isFocused,
    });
    if (isFocused) {
      screenReadyReportedRef.current = false;
      if (rootLayoutSeenRef.current) {
        requestAnimationFrame(() => {
          if (!screenReadyReportedRef.current) {
            reportScreenReady('Studio');
            screenReadyReportedRef.current = true;
          }
        });
      }
    }
  }, [isFocused, reportScreenReady]);

  useEffect(() => {
    if (!isFocused) {
      perfEnd('studio.focus_cycle', {
        status: 'blur',
      });
      return;
    }

    rootLayoutLoggedRef.current = false;
    headerLayoutLoggedRef.current = false;
    contentSizeLoggedRef.current = false;
    perfStart('studio.focus_cycle');

    return () => {
      perfEnd('studio.focus_cycle', {
        status: 'cleanup',
      });
    };
  }, [isFocused]);

  useEffect(() => {
    const shouldEnableLayoutAnimation =
      typeof UIManager.setLayoutAnimationEnabledExperimental === 'function' &&
      !global?.nativeFabricUIManager;

    try {
      if (shouldEnableLayoutAnimation) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
      }
    } catch {}
  }, []);

  // Recent images from jobs store
  const jobs = useImagesStore(s => s.jobs);
  const images = useMemo(() => {
    const startedAt = global.performance?.now?.() ?? Date.now();
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
    const finishedAt = global.performance?.now?.() ?? Date.now();
    perfLog('studio.images.derived', {
      jobs: jobs?.length || 0,
      doneJobs: done.length,
      images: result.length,
      durationMs: Number((finishedAt - startedAt).toFixed(1)),
    });
    return result;
  }, [jobs]);

  useEffect(() => {
    perfLog('studio.images.count', {
      count: images.length,
    });
  }, [images.length]);

  useEffect(() => {
    const totalImages = (jobs || []).reduce((sum, job) => sum + (job?.images?.length || 0), 0);
    perfLog('studio.jobs.snapshot', {
      jobs: jobs?.length || 0,
      totalImages,
    });
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
    perfLog('studio.home.open_create', {
      galleryItems: galleryItems.length,
    });
    navigation.navigate('CreateImage');
  }, [galleryItems.length, navigation]);

  const openEdit = useCallback(() => {
    perfLog('studio.home.open_edit', {
      galleryItems: galleryItems.length,
    });
    navigation.navigate('EditImage');
  }, [galleryItems.length, navigation]);

  const tileSize = useMemo(() => (Dimensions.get('window').width - 4 * 12) / 3, []);
  const tileDynamicStyle = useMemo(() => ({ width: tileSize, height: tileSize }), [tileSize]);
  const galleryExtraData = useMemo(
    () => ({ isSelectionMode, selSize: selectedImages.size }),
    [isSelectionMode, selectedImages.size]
  );

  const renderTile = useCallback(({ item }) => {
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
        style={[tileDynamicStyle, styles.tile]}
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
  }, [isSelectionMode, selectedImages, tileDynamicStyle, toggleImageSelection]);

  // Dynamic styles
  const headerStyle = React.useMemo(
    () => [styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }],
    [insets.top]
  );
  const listContentStyle = React.useMemo(
    () => [styles.listContent, { paddingBottom: Math.max(insets.bottom, 24) }],
    [insets.bottom]
  );
  const selectionToggleLabel = isSelectionMode
    ? t('studioHome.gallery.selection.exit')
    : t('studioHome.gallery.selection.enter');
  const deleteButtonLabel = selectedImages.size > 0
    ? t('studioHome.gallery.selection.deleteSelected')
    : t('studioHome.gallery.selection.selectForDelete');

  return (
    <View
      style={styles.container}
      onLayout={() => {
        if (rootLayoutLoggedRef.current) return;
        rootLayoutLoggedRef.current = true;
        rootLayoutSeenRef.current = true;
        perfLog('studio.root.layout');
        if (isFocused && !screenReadyReportedRef.current) {
          reportScreenReady('Studio');
          screenReadyReportedRef.current = true;
        }
      }}
    >
      {/* Header */}
      <View style={headerStyle}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={openMenu}
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
          <View style={styles.headerRightSpacer} />
        </View>
      </View>

      {/* Batch actions bar removed for minimalist header controls */}

      {/* Body */}
      <FlatList
        contentContainerStyle={listContentStyle}
        extraData={galleryExtraData}
        ListHeaderComponent={
          <View
            style={styles.headerGroup}
            onLayout={() => {
              if (headerLayoutLoggedRef.current) return;
              headerLayoutLoggedRef.current = true;
              perfLog('studio.header.layout');
            }}
          >
            {/* Create Card */}
            <View style={styles.card}>
              <Image
                source={CREATE_IMAGE}
                style={styles.absoluteFill}
                resizeMode="cover"
              />
              <View style={[styles.cardOverlay, styles.cardOverlayAndroid]} />
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
                <View style={styles.cardButtonContainer}>
                  <Pressable onPress={openCreate} style={[styles.secondaryBtn]} hitSlop={6}>
                    <Text style={styles.secondaryBtnText}>{t('studioHome.createCard.cta')}</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Edit Card */}
            <View style={styles.card}>
              <Image
                source={EDIT_IMAGE}
                style={styles.absoluteFill}
                resizeMode="cover"
              />
              <View style={[styles.cardOverlay, styles.cardOverlayAndroid]} />
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
                <View style={styles.cardButtonContainer}>
                  <Pressable onPress={openEdit} style={[styles.primaryBtn]} hitSlop={6}>
                    <Text style={styles.primaryBtnText}>{t('studioHome.editCard.cta')}</Text>
                  </Pressable>
                </View>
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
        removeClippedSubviews
        initialNumToRender={9}
        maxToRenderPerBatch={6}
        windowSize={5}
        onContentSizeChange={(_, height) => {
          if (contentSizeLoggedRef.current) return;
          contentSizeLoggedRef.current = true;
          perfLog('studio.list.content_size', {
            height,
            items: galleryItems.length,
          });
        }}
      />

      {/* Image viewer modal */}
      {viewer.open ? (
        <ImageViewer
          visible={viewer.open}
          imageUri={viewer.uri}
          imageId={viewer.id}
          jobId={viewer.jobId}
          hideEdit
          onClose={() => setViewer({ open: false, uri: '', id: null, jobId: null })}
        />
      ) : null}
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
  headerRightSpacer: { width: 40, height: 40 },

  card: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#17171C',
    aspectRatio: CARD_ASPECT,
  },
  cardOverlay: { ...StyleSheet.absoluteFillObject },
  cardOverlayAndroid: {
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  cardContent: { flex: 1, justifyContent: 'space-between', padding: 16 },
  cardButtonContainer: { marginTop: 'auto' },
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
});

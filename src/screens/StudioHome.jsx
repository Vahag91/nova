import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  ScrollView,
  Dimensions,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import SvgIcon from '../components/SvgIcon';
import CoinBalanceBadge from '../components/image-studio/CoinBalanceBadge';
import { useImagesStore } from '../state/useImagesStore';
import useCoinBalance from '../hooks/useCoinBalance';
import { normalizeImageUri } from '../lib/imageUtils';
import ImageViewer from '../components/image-studio/ImageViewer';
import { useAndroidNavigationMenu } from '../navigation/AndroidNavigationMenuContext';

const CREATE_IMAGE = require('../../assets/studioImages/astronaut.jpg');
const EDIT_IMAGE = require('../../assets/studioImages/editImage.webp');

const CARD_ASPECT = 16 / 9;

const StudioActionCard = React.memo(function StudioActionCard({
  imageSource,
  cta,
  iconName,
  onPress,
  primary = false,
}) {
  return (
    <Pressable onPress={onPress} style={styles.card} hitSlop={6}>
      <Image source={imageSource} style={styles.cardImage} resizeMode="contain" />
      <View style={[styles.cardOverlay, styles.cardOverlayAndroid]} />
      <View style={styles.cardContent}>
        <View style={[styles.cardAction, primary ? styles.primaryBtn : styles.secondaryBtn]}>
          <SvgIcon name={iconName} size={18} color="#FFFFFF" />
          <Text style={primary ? styles.primaryBtnText : styles.secondaryBtnText}>{cta}</Text>
        </View>
      </View>
    </Pressable>
  );
});

const StudioGalleryTile = React.memo(function StudioGalleryTile({
  item,
  selected,
  selectionMode,
  tileStyle,
  onPress,
  onLongPress,
}) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={[tileStyle, styles.tile]}>
      <Image source={{ uri: item.url }} style={styles.tileImage} resizeMode="cover" />
      {selectionMode ? (
        <View style={styles.selectionOverlay}>
          <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
            {selected ? <SvgIcon name="check" size={14} color="#0B0B0E" /> : null}
          </View>
        </View>
      ) : null}
    </Pressable>
  );
});

function GradientText({ children, style }) {
  return <Text style={style}>{children}</Text>;
}

export default function StudioHome({ navigation }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { openMenu, reportScreenReady } = useAndroidNavigationMenu();
  const coins = useCoinBalance();
  const screenReadyReportedRef = useRef(false);

  const jobs = useImagesStore(state => state.jobs);
  const deleteImage = useImagesStore(state => state.deleteImage);

  const [viewer, setViewer] = useState({ open: false, uri: '', id: null, jobId: null });
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState(() => new Set());

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

  const galleryItems = useMemo(() => (
    (jobs || [])
      .filter(job => job?.status === 'done')
      .flatMap((job, jobIndex) =>
        (job.images || [])
          .map((image, imageIndex) => {
            const url = normalizeImageUri(image?.url);
            if (!url) {
              return null;
            }

            return {
              id: image?.id || `${job.id || 'job'}:${jobIndex}:${imageIndex}`,
              jobId: job.id,
              url,
            };
          })
          .filter(Boolean),
      )
  ), [jobs]);

  const galleryItemsById = useMemo(() => {
    const next = new Map();
    galleryItems.forEach(item => {
      next.set(item.id, item);
    });
    return next;
  }, [galleryItems]);

  const galleryRows = useMemo(() => {
    const rows = [];
    for (let index = 0; index < galleryItems.length; index += 3) {
      rows.push(galleryItems.slice(index, index + 3));
    }
    return rows;
  }, [galleryItems]);

  const headerStyle = useMemo(
    () => [styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }],
    [insets.top],
  );

  const bodyStyle = useMemo(
    () => [styles.body, { paddingBottom: Math.max(insets.bottom, 24) }],
    [insets.bottom],
  );

  const tileSize = useMemo(() => (Dimensions.get('window').width - 4 * 12) / 3, []);
  const tileStyle = useMemo(() => ({ width: tileSize, height: tileSize }), [tileSize]);

  const openCreate = useCallback(() => {
    navigation.navigate('CreateImage');
  }, [navigation]);

  const openEdit = useCallback(() => {
    navigation.navigate('EditImage');
  }, [navigation]);

  const toggleSelectionMode = useCallback(() => {
    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch {}
    setIsSelectionMode(previous => !previous);
    setSelectedImages(new Set());
  }, []);

  const toggleImageSelection = useCallback((imageId) => {
    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch {}
    setSelectedImages(previous => {
      const next = new Set(previous);
      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }
      return next;
    });
  }, []);

  const openViewer = useCallback((item) => {
    setViewer({
      open: true,
      uri: item.url,
      id: item.id,
      jobId: item.jobId,
    });
  }, []);

  const handleTilePress = useCallback((item) => {
    if (isSelectionMode) {
      toggleImageSelection(item.id);
      return;
    }

    openViewer(item);
  }, [isSelectionMode, openViewer, toggleImageSelection]);

  const handleTileLongPress = useCallback((item) => {
    if (isSelectionMode) {
      return;
    }

    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch {}
    setIsSelectionMode(true);
    setSelectedImages(new Set([item.id]));
  }, [isSelectionMode]);

  const deleteSelectedImages = useCallback(() => {
    if (selectedImages.size === 0) {
      return;
    }

    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch {}

    selectedImages.forEach(imageId => {
      const item = galleryItemsById.get(imageId);
      if (!item?.jobId) {
        return;
      }
      try {
        deleteImage(item.jobId, item.id);
      } catch {}
    });

    setSelectedImages(new Set());
    setIsSelectionMode(false);
  }, [deleteImage, galleryItemsById, selectedImages]);

  const handleRootLayout = useCallback(() => {
    if (screenReadyReportedRef.current) {
      return;
    }
    screenReadyReportedRef.current = true;
    reportScreenReady('Studio');
  }, [reportScreenReady]);

  const showGalleryActions = isSelectionMode || galleryItems.length > 0;
  const selectionToggleLabel = isSelectionMode
    ? t('studioHome.gallery.selection.exit')
    : t('studioHome.gallery.selection.enter');
  const deleteButtonLabel = selectedImages.size > 0
    ? t('studioHome.gallery.selection.deleteSelected')
    : t('studioHome.gallery.selection.selectForDelete');

  return (
    <View style={styles.container} onLayout={handleRootLayout}>
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
          <View style={styles.headerRightSlot}>
            <CoinBalanceBadge coins={coins} />
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={bodyStyle} showsVerticalScrollIndicator={false}>
        <View style={styles.cardsColumn}>
          <StudioActionCard
            imageSource={CREATE_IMAGE}
            cta={t('studioHome.createCard.title')}
            iconName="quill"
            onPress={openCreate}
          />
          <StudioActionCard
            imageSource={EDIT_IMAGE}
            cta={t('studioHome.editCard.title')}
            iconName="stars"
            onPress={openEdit}
            primary
          />
        </View>

        {showGalleryActions ? (
          <View style={styles.galleryActionsRow}>
            <View style={styles.sectionActions}>
              <Pressable
                onPress={toggleSelectionMode}
                hitSlop={8}
                style={styles.sectionHeaderBtn}
                accessibilityLabel={selectionToggleLabel}
              >
                <SvgIcon name="copygrey" size={18} color={isSelectionMode ? '#8A42FF' : '#FFFFFF'} />
              </Pressable>
              <Pressable
                onPress={() => {
                  if (selectedImages.size > 0) {
                    deleteSelectedImages();
                  } else if (!isSelectionMode) {
                    toggleSelectionMode();
                  }
                }}
                hitSlop={8}
                style={[styles.sectionHeaderBtn, selectedImages.size > 0 && styles.sectionHeaderBtnDanger]}
                accessibilityLabel={deleteButtonLabel}
              >
                <SvgIcon name="delete" size={18} color={selectedImages.size > 0 ? '#FFB0B0' : '#FFFFFF'} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {galleryRows.length > 0 ? (
          galleryRows.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.columnWrapper}>
              {row.map(item => (
                <StudioGalleryTile
                  key={item.id}
                  item={item}
                  selected={selectedImages.has(item.id)}
                  selectionMode={isSelectionMode}
                  tileStyle={tileStyle}
                  onPress={() => handleTilePress(item)}
                  onLongPress={() => handleTileLongPress(item)}
                />
              ))}
              {row.length < 3
                ? Array.from({ length: 3 - row.length }, (_, spacerIndex) => (
                    <View
                      key={`spacer-${rowIndex}-${spacerIndex}`}
                      style={[tileStyle, styles.tileSpacer]}
                    />
                  ))
                : null}
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>{t('studioHome.gallery.empty')}</Text>
        )}
      </ScrollView>

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
  header: {
    paddingVertical: 22,
    backgroundColor: 'rgba(11,11,14,0.92)',
  },
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
    paddingHorizontal: 104,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerRightSlot: {
    minWidth: 74,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  body: {
    padding: 12,
  },
  cardsColumn: {
    gap: 12,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#17171C',
    aspectRatio: CARD_ASPECT,
  },
  cardImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  cardOverlayAndroid: {
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  cardAction: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: '#7C5CFF',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  secondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  galleryActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 14,
    marginBottom: 8,
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sectionHeaderBtnDanger: {
    backgroundColor: 'rgba(220,50,50,0.2)',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.65)',
    paddingVertical: 24,
  },
  columnWrapper: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  tile: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1A1A1D',
  },
  tileImage: {
    flex: 1,
  },
  tileSpacer: {
    backgroundColor: 'transparent',
  },
  selectionOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
  },
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
});

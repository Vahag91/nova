import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
  ActionSheetIOS,
  Linking,
  Pressable,
  Animated,
  Modal,
  Alert,
} from 'react-native';
import { useThreadsStore } from '../state/useThreadsStore';
import { useTranslation } from 'react-i18next';
import Reanimated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  useDerivedValue,
  withTiming,
  Easing,
  KeyboardState,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Haptic from 'react-native-haptic-feedback';
import { useImagesStore } from '../state/useImagesStore';
import { useSettingsStore } from '../state/useSettingsStore';
import SvgIcon from '../components/SvgIcon';
import Svg, { Path } from 'react-native-svg';
import { fetchModels } from '../api/models';
import { launchImageLibrary } from 'react-native-image-picker';

import {
  ImageCard,
  AdaptiveGrid,
  ProgressBar,
  InputComposer,
  GenerateButton,
  ModelMenu,
  ImageViewer,
  ErrorDisplay,
  AdvancedParams,
} from '../components/image-studio';

// helpers
import { normalizeImageUri } from '../lib/imageUtils';
import { ensurePhotoLibraryAccess, promptOpenSettings } from '../lib/permissions';

// Empty state icon component
const EmptyImageIcon = ({ color = "#B7B7B7", size = 64 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm40-80h480L570-480 450-320l-90-120-120 160Zm-40 80v-560 560Z" />
  </Svg>
);

// Helper function for URL checking
const isHttp = (url) => /^https?:\/\//i.test(url);

// ---------- Screen ----------
export default function ImagesStudio({ navigation, route }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { seedPrompt = '' } = route?.params || {};

  // Get the insert to chat callback from global store instead of navigation params
  const insertToChat = useThreadsStore(s => s.insertToChat);

  // Keyboard animation
  const keyboard = useAnimatedKeyboard();
  const GAP = 24; // space between keyboard and footer
  const kTranslate = useSharedValue(0);  // animated -height
  const kGap = useSharedValue(0);        // animated gap 0 ↔ GAP

  useDerivedValue(() => {
    const h = keyboard.height.value;
    const isClosing = keyboard.state.value === KeyboardState.CLOSING;
    const duration = isClosing ? 240 : 40; // tiny extra time on close feels better

    // animate the main offset
    kTranslate.value = withTiming(-h, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
    // animate the tiny gap so it never snaps at the end
    kGap.value = withTiming(h > 0 ? GAP : 0, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  });

  // State
  const [prompt, setPrompt] = useState(seedPrompt || '');
  const [size, setSize] = useState('1024x1024');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState({ open: false, uri: '' });
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  // Mode state
  const [mode, setMode] = useState('text2img');
  const [seedImage, setSeedImage] = useState('');
  const [advancedParams, setAdvancedParams] = useState({});
  const [advancedParamsOpen, setAdvancedParamsOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const plusButtonRef = useRef(null);

  // Multi-select state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState(new Set());
  const [showBatchActions, setShowBatchActions] = useState(false);

  // Track actual model being used (for auto-selection feedback)
  const [actualModel, setActualModel] = useState(null);
  const [modelChanged, setModelChanged] = useState(false);
  const safeCall = useCallback((fn, ...args) => {
    if (typeof fn !== 'function') return;
    try { fn(...args); } catch {}
  }, []);

  // Model capabilities mapping (should match the backend)
  const MODEL_CAPABILITIES = {
    'runware-flux-dev': { text2img: true, img2img: true },
    'runware-flux-schnell': { text2img: true, img2img: true },
    'runware-flux-canny': { text2img: false, img2img: true }, // canny is for img2img
    'runware-sdxl-civitai': { text2img: true, img2img: true },
  };

  // Get the best model for a specific mode
  const getBestModelForMode = useCallback((mode, preferredModel) => {
    const capableModels = Object.keys(MODEL_CAPABILITIES).filter(
      modelKey => MODEL_CAPABILITIES[modelKey]?.[mode]
    );

    if (preferredModel && capableModels.includes(preferredModel)) {
      return preferredModel;
    }
    const fluxModels = capableModels.filter(m => m.includes('flux'));
    return fluxModels[0] || capableModels[0] || "runware-flux-dev";
  }, []);

  // Animation refs
  const progressAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  // Stores
  const createJob = useImagesStore((s) => s.createJob);
  const runImg2Img = useImagesStore((s) => s.runImg2Img);
  const jobs = useImagesStore((s) => s.jobs);
  const clearFailed = useImagesStore((s) => s.clearFailed);
  const deleteImage = useImagesStore((s) => s.deleteImage);
  const deleteJob = useImagesStore((s) => s.deleteJob);
  const models = useSettingsStore((s) => s.models);
  const setModels = useSettingsStore((s) => s.setModels);
  const forceRefreshModels = useSettingsStore((s) => s.forceRefreshModels);

  // Computed values
  const imageModels = useMemo(() => {
    const list = Object.entries(models || {}).filter(([, v]) => v?.caps?.imageGen);
    if (!list.length) {
      return [{ key: 'runware-flux-dev', display: { name: 'FLUX.1 dev' }, provider: 'runware' }];
    }
    const result = list.map(([key, v]) => ({ key, display: v.display || { name: key }, provider: v.provider }));
    return result;
  }, [models]);

  const [model, setModel] = useState(imageModels[0]?.key || 'runware-flux-dev');

  useEffect(() => {
    if (imageModels.length > 0 && !imageModels.find((m) => m.key === model)) {
      setModel(imageModels[0].key);
    }
  }, [imageModels, model]);

  // Force refresh models from server on mount
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const incoming = await fetchModels({ signal: ac.signal });
        if (incoming && typeof incoming === 'object' && Object.keys(incoming).length > 0) {
          setModels(incoming);
        }
      } catch (error) {
        // silently ignore UI noise
      }
    })();
    return () => ac.abort();
  }, [setModels]);

  // Keep model compatible with mode
  useEffect(() => {
    if (mode === 'text2img') {
      setActualModel(null);
      setModelChanged(false);
      return;
    }
    const bestModel = getBestModelForMode(mode, model);
    const isModelChanged = bestModel !== model;
    setActualModel(bestModel);
    setModelChanged(isModelChanged);
  }, [mode, model, getBestModelForMode]);

  // Delete handlers
  const handleDeleteImage = useCallback((image) => {
    const confirmData = {
      type: 'image',
      image,
      title: t('imagesStudio.deleteConfirmTitle'),
      message: t('imagesStudio.deleteConfirmMessage'),
    };
    setDeleteConfirm(confirmData);
  }, [t]);

  const handleDeleteJob = useCallback((job) => {
    setDeleteConfirm({
      type: 'job',
      job,
      title: t('imagesStudio.deleteConfirmTitle'),
      message: t('imagesStudio.deleteConfirmMessage'),
    });
  }, [t]);

  const confirmDelete = useCallback(() => {
    if (!deleteConfirm) return;
    if (deleteConfirm.onConfirm) {
      safeCall(deleteConfirm.onConfirm);
    } else if (deleteConfirm.type === 'image') {
      safeCall(deleteImage, deleteConfirm.image.jobId, deleteConfirm.image.id);
      setDeleteConfirm(null);
    } else if (deleteConfirm.type === 'job') {
      safeCall(deleteJob, deleteConfirm.job.id);
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, deleteImage, deleteJob, safeCall]);

  const cancelDelete = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  // Multi-select functionality
  const [images, setImages] = useState([]);
  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedImages(new Set());
    setShowBatchActions(false);
  }, [isSelectionMode]);

  const toggleImageSelection = useCallback((imageId) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(imageId)) newSelected.delete(imageId);
    else newSelected.add(imageId);
    setSelectedImages(newSelected);
    setShowBatchActions(newSelected.size > 0);
  }, [selectedImages]);

  const selectAllImages = useCallback(() => {
    const allImageIds = new Set(images.map(img => img.id));
    setSelectedImages(allImageIds);
    setShowBatchActions(true);
  }, [images]);

  const clearSelection = useCallback(() => {
    setSelectedImages(new Set());
    setShowBatchActions(false);
  }, []);

  const deleteSelectedImages = useCallback(() => {
    if (selectedImages.size === 0) return;
    const jobIds = new Set();
    selectedImages.forEach(imageId => {
      const image = images.find(img => img.id === imageId);
      if (image) jobIds.add(image.jobId);
    });

    setDeleteConfirm({
      title: t('imagesStudio.deleteSelectedConfirmTitle'),
      message: t('imagesStudio.deleteSelectedConfirmMessage', { count: jobIds.size }),
      onConfirm: () => {
        jobIds.forEach(jobId => {
          safeCall(deleteJob, jobId);
        });
        clearSelection();
        setIsSelectionMode(false);
        setDeleteConfirm(null);
      }
    });
  }, [selectedImages, images, deleteJob, t, safeCall, clearSelection]);

  // Flatten jobs → images
  const jobsMemo = useMemo(() => jobs || [], [jobs]);
  useEffect(() => {
    const done = (jobsMemo).filter(j => j?.status === 'done');
    const result = done.flatMap((j, jdx) => {
      return (j.images || [])
        .map((img, idx) => {
          const normalizedUrl = normalizeImageUri(img?.url);
          const uniqueId = img?.id ? `${j.id}:${img.id}` : `${j.id || 'job'}:${jdx}:${idx}`;
          return {
            ...img,
            id: uniqueId,
            jobId: j.id,
            url: normalizedUrl,
            originalUrl: img?.url,
            prompt: j.prompt,
            size: j.size || '1024x1024',
            model: j.model,
          };
        })
        .filter((img) => !!img.url);
    });
    setImages(result);
  }, [jobsMemo]);

  const canGenerate = (() => {
    if (busy) return false;
    if (mode === 'text2img') return prompt.trim().length > 0;
    if (mode === 'img2img') return !!seedImage; // prompt optional for img2img
    return false;
  })();

  // ---------- actions ----------
  const onGenerate = useCallback(async () => {
    if (!canGenerate) return;

    setError('');
    setBusy(true);
    setGenerationProgress(0);
    safeCall(clearFailed);
    setRetryCount(0);

    try { Haptic.trigger('selection'); } catch {}

    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        const newProgress = Math.min(prev + Math.random() * 15, 90);
        Animated.timing(progressAnim, { toValue: newProgress / 100, duration: 200, useNativeDriver: false }).start();
        return newProgress;
      });
    }, 500);

    const unavailableMsg = t('imagesStudio.imageGenerationUnavailable');
    const generationUnavailable = unavailableMsg && unavailableMsg !== 'imagesStudio.imageGenerationUnavailable'
      ? unavailableMsg
      : 'Image generation unavailable.';

    try {
      const modelToUse = actualModel || model;

      const baseParams = {
        prompt: mode === 'text2img' ? prompt.trim() : (prompt.trim() || '__BLANK__'),
        model: modelToUse,
        size,
        steps: advancedParams.steps || 30,
        CFGScale: advancedParams.CFGScale || 9,
        outputType: advancedParams.outputType || 'URL',
        outputFormat: advancedParams.outputFormat || 'JPG',
        outputQuality: advancedParams.outputQuality || 95,
      };

      if (mode === 'img2img') {
        if (typeof runImg2Img === 'function') {
          await runImg2Img({
            ...baseParams,
            seedImage,
            strength: advancedParams.strength || 0.85,
          });
        } else {
          throw new Error(generationUnavailable);
        }
      } else {
        if (typeof createJob === 'function') {
          await createJob({
            prompt: prompt.trim(),
            model: modelToUse,
            size,
            n: 1,
            mode: 'text2img',
          });
        } else {
          throw new Error(generationUnavailable);
        }
      }

      clearInterval(progressInterval);
      setGenerationProgress(100);
      Animated.timing(progressAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
      try { Haptic.trigger('notificationSuccess'); } catch {}

      setTimeout(() => {
        setGenerationProgress(0);
        progressAnim.setValue(0);
      }, 2000);

    } catch (e) {
      clearInterval(progressInterval);
      setError(String(e?.message || t('imagesStudio.imageGenerationFailed')));
      setGenerationProgress(0);
      progressAnim.setValue(0);
      try { Haptic.trigger('notificationError'); } catch {}
    } finally {
      setBusy(false);
    }
  }, [canGenerate, prompt, model, size, createJob, runImg2Img, clearFailed, buttonScale, progressAnim, mode, actualModel, seedImage, advancedParams, t, safeCall]);

  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    onGenerate();
  }, [onGenerate]);

  const handleOpenPhotoGallery = useCallback(async () => {
    const res = await ensurePhotoLibraryAccess({ write: false });
    if (!res.ok) {
      if (res.blocked) {
        promptOpenSettings(
          t('imagesStudio.photosPermissionTitle') || 'Photos Permission Needed',
          t('imagesStudio.photosPermissionMessage') || 'Please enable photo access in Settings.'
        );
      } else {
        Alert.alert(
          t('imagesStudio.photosPermissionTitle') || 'Photos Permission Needed',
          t('imagesStudio.photosPermissionMessage') || 'Please allow photo access to pick a seed image.',
          [
            { text: t('common.cancel') || 'Cancel', style: 'cancel' },
            {
              text: t('common.allow') || 'Allow',
              onPress: async () => {
                const retry = await ensurePhotoLibraryAccess({ write: false });
                if (!retry.ok && retry.blocked) {
                  promptOpenSettings(
                    t('imagesStudio.photosPermissionTitle') || 'Photos Permission Needed',
                    t('imagesStudio.photosPermissionMessage') || 'Please enable photo access in Settings.'
                  );
                }
              }
            }
          ],
          { cancelable: true }
        );
      }
      return;
    }

    const options = {
      mediaType: 'photo',
      includeBase64: true,
      maxHeight: 2048,
      maxWidth: 2048,
      quality: 0.8,
    };

    try {
      launchImageLibrary(options, (response) => {
        if (response?.didCancel || response?.errorMessage) {
          return;
        }

        const asset = Array.isArray(response?.assets) ? response.assets[0] : null;
        if (asset && asset.base64) {
          const mime = asset.type && typeof asset.type === 'string' ? asset.type : 'image/jpeg';
          const base64DataUri = `data:${mime};base64,${asset.base64}`;
          setSeedImage(base64DataUri);
          setMode('img2img');
        }
      });
    } catch (err) {
      setError(String(err?.message || t('imagesStudio.photosPermissionMessage')));
    }
  }, [setSeedImage, setMode, t]);

  const openImageExternally = useCallback((url) => {
    if (isHttp(url)) Linking.openURL(url).catch(() => {});
  }, []);

  const insertAsMarkdown = useCallback(({ prompt: p, url }) => {
    const md = [
      t('imagesStudio.insertMarkdownHeader'),
      ``,
      `> ${p || t('imagesStudio.generatedImage')}`,
      ``,
      `![image](${url})`,
    ].join('\n');
    safeCall(() => insertToChat(md));
    safeCall(() => navigation?.goBack?.());
  }, [insertToChat, navigation, t, safeCall]);

  const showTileActions = useCallback((item) => {
    const url = item?.url;
    const job = jobs.find(j => j.id === item.jobId);
    const hasMultipleImages = job?.images?.length > 1;

    const options = [
      t('imagesStudio.insertToChat'),
      isHttp(url) ? t('imagesStudio.openInBrowser') : null,
      t('imagesStudio.makeVariations'),
      t('imagesStudio.delete'),
      hasMultipleImages ? t('imagesStudio.deleteAllFromGeneration') : null,
      t('common.cancel')
    ].filter(Boolean);

    const handler = (ix) => {
      const label = options[ix];
      if (label === t('imagesStudio.insertToChat')) insertAsMarkdown(item);
      else if (label === t('imagesStudio.openInBrowser')) openImageExternally(url);
      else if (label === t('imagesStudio.makeVariations')) setPrompt(`${prompt.trim()} ${t('imagesStudio.variationSuffix')}`);
      else if (label === t('imagesStudio.delete')) {
        handleDeleteImage(item);
      } else if (label === t('imagesStudio.deleteAllFromGeneration')) {
        handleDeleteJob(job);
      }
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: options.length - 1, userInterfaceStyle: 'dark' },
        handler
      );
    } else {
      Alert.alert(
        t('imagesStudio.imageOptionsTitle'),
        t('imagesStudio.imageOptionsMessage'),
        options.map((option, index) => ({
          text: option,
          onPress: () => handler(index),
          style: option === t('common.cancel') ? 'cancel' : 'default',
        }))
      );
    }
  }, [insertAsMarkdown, openImageExternally, prompt, handleDeleteImage, handleDeleteJob, jobs, t]);

  const animatedContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: kTranslate.value }],
  }));

  const animatedFooterStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: kTranslate.value + kGap.value }],
  }));

  // ---------- tile renderer ----------
  const renderTile = useCallback((item, _index, tileStyle) => {
    const isSelected = selectedImages.has(item.id);

    return (
      <ImageCard
        item={item}
        style={tileStyle}
        onPress={() => {
          if (isSelectionMode) {
            toggleImageSelection(item.id);
          } else {
            setViewer({ open: true, uri: item.url });
          }
        }}
        onLongPress={() => {
          if (!isSelectionMode) {
            showTileActions(item);
          }
        }}
        onDelete={handleDeleteImage}
        isGenerating={item.status === 'generating'}
        isSelectionMode={isSelectionMode}
        isSelected={isSelected}
        onToggleSelection={() => toggleImageSelection(item.id)}
      />
    );
  }, [showTileActions, handleDeleteImage, isSelectionMode, selectedImages, toggleImageSelection]);

  // ---------- UI ----------
  return (
    <View style={styles.container}>
      <View style={styles.keyboardAvoidingView}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.iconContainer}>
              <SvgIcon name="studio" size={28} color="#8A42FF" />
            </View>
            <Text style={styles.title}>{t('imagesStudio.title')}</Text>
          </View>
          <View style={styles.headerRight}>
            {images.length > 0 && (
              <Pressable
                style={[
                  styles.headerButton,
                  isSelectionMode && styles.headerButtonActive
                ]}
                onPress={toggleSelectionMode}
                hitSlop={8}
                accessibilityLabel={isSelectionMode ? t('imagesStudio.exitSelectionMode') : t('imagesStudio.selectImages')}
              >
                <SvgIcon
                  name="copygrey"
                  size={24}
                  color={isSelectionMode ? "#8A42FF" : "#FFFFFF"}
                />
              </Pressable>
            )}
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={12}
              style={styles.closeButton}
            >
              <SvgIcon name="close" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Batch Actions Bar */}
        {isSelectionMode && showBatchActions && (
          <View style={styles.batchActionsBar}>
            <View style={styles.batchActionsLeft}>
              <Text style={styles.batchActionsText}>
                {selectedImages.size} {t('imagesStudio.selectedCount')}
              </Text>
            </View>
            <View style={styles.batchActionsRight}>
              <Pressable
                style={styles.selectAllButton}
                onPress={selectAllImages}
                hitSlop={8}
              >
                <Text style={styles.selectAllButtonText}>{t('imagesStudio.selectAll')}</Text>
              </Pressable>
              <Pressable
                style={styles.deleteButton}
                onPress={deleteSelectedImages}
                hitSlop={8}
              >
                <Text style={styles.deleteButtonText}>{t('imagesStudio.delete')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Gallery */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            isSelectionMode && showBatchActions && styles.contentWithBatchActions
          ]}
          showsVerticalScrollIndicator={false}
          accessibilityLabel={t('imagesStudio.generatedImagesGallery')}
        >
          <Reanimated.View style={animatedContentStyle}>
            {images.length > 0 ? (
              <AdaptiveGrid items={images} renderTile={renderTile} horizontalPadding={20} />
            ) : (
              <View style={styles.empty}>
                <EmptyImageIcon color="#B7B7B7" size={64} />
                <Text style={styles.emptyTitle}>{t('imagesStudio.noImagesYet')}</Text>
                <Text style={styles.emptyHint}>{t('imagesStudio.describeImageHint')}</Text>
              </View>
            )}
          </Reanimated.View>
        </ScrollView>

        {/* Footer */}
        <Reanimated.View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16) },
            animatedFooterStyle,
          ]}
        >
          <InputComposer
            prompt={prompt}
            onPromptChange={(text) => { setPrompt(text); if (error) setError(''); }}
            onGenerate={onGenerate}
            onClearPrompt={() => setPrompt('')}
            onOpenSettings={() => setModelMenuOpen(true)}
            onModeChange={setMode}
            currentMode={mode}
            disabled={busy}
            plusButtonRef={plusButtonRef}
            selectedImageUri={mode === 'img2img' ? seedImage : null}
            onRemoveSelectedImage={() => setSeedImage('')}
            onOpenPhotoGallery={handleOpenPhotoGallery}
            currentModel={actualModel ? (models?.[actualModel]?.display?.name || actualModel) : (models?.[model]?.display?.name || model)}
            modelChanged={modelChanged}
            originalModel={models?.[model]?.display?.name || model}
          />

          {/* Progress Bar */}
          {busy && generationProgress > 0 && (
            <ProgressBar
              progress={generationProgress}
              animatedValue={progressAnim}
            />
          )}

          {/* Error Display */}
          <ErrorDisplay
            error={error}
            retryCount={retryCount}
            onRetry={handleRetry}
          />

          {/* Model Change Notification */}
          {modelChanged && actualModel && (
            <View style={styles.modelChangeNotification}>
              <Text style={styles.modelChangeIcon}>🔄</Text>
              <Text style={styles.modelChangeText}>
                {t('imagesStudio.autoSelectedModel', {
                  model: models?.[actualModel]?.display?.name || actualModel,
                  mode
                })}
              </Text>
            </View>
          )}

          {/* Generate Button and Settings */}
          <View style={styles.generateSection}>
            <GenerateButton
              onPress={onGenerate}
              disabled={!canGenerate}
              busy={busy}
              modelName={models?.[model]?.display?.name || model}
              actualModelName={actualModel ? (models?.[actualModel]?.display?.name || actualModel) : null}
              modelChanged={modelChanged}
              animatedValue={buttonScale}
              onAdvancedParams={() => setAdvancedParamsOpen(true)}
              style={styles.generateButtonFlex}
            />
          </View>
        </Reanimated.View>

        {/* Model Menu */}
        <ModelMenu
          visible={modelMenuOpen}
          onClose={() => setModelMenuOpen(false)}
          model={model}
          onModelChange={setModel}
          imageModels={imageModels}
          buttonRef={plusButtonRef}
        />

        {/* Image Viewer */}
        <ImageViewer
          visible={viewer.open}
          imageUri={viewer.uri}
          onClose={() => setViewer({ open: false, uri: '' })}
        />

        {/* Advanced Parameters Modal */}
        <AdvancedParams
          visible={advancedParamsOpen}
          onClose={() => setAdvancedParamsOpen(false)}
          mode={mode}
          params={advancedParams}
          onParamsChange={setAdvancedParams}
        />

        {/* Delete Confirmation Dialog */}
        <Modal
          visible={!!deleteConfirm}
          transparent
          animationType="fade"
          onRequestClose={cancelDelete}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{deleteConfirm?.title}</Text>
              <Text style={styles.modalMessage}>{deleteConfirm?.message}</Text>
              <View style={styles.modalButtons}>
                <Pressable
                  style={styles.modalButtonCancel}
                  onPress={cancelDelete}
                >
                  <Text style={styles.modalButtonTextCancel}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable
                  style={styles.modalButtonDelete}
                  onPress={confirmDelete}
                >
                  <Text style={styles.modalButtonTextDelete}>{t('common.delete')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

// ---------- styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  keyboardAvoidingView: { flex: 1, paddingTop: 44 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconContainer: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: '#F9FAFB', fontFamily: 'Lato-Bold', letterSpacing: 0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 12 },
  closeButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22 },
  headerButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22 },
  headerButtonActive: {},
  batchActionsBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 6 },
  batchActionsLeft: { flexDirection: 'row', alignItems: 'center' },
  batchActionsRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  batchActionsText: { color: '#F9FAFB', fontSize: 15, fontWeight: '600', fontFamily: 'Lato-Bold' },
  selectAllButton: { paddingHorizontal: 12, paddingVertical: 6 },
  selectAllButtonText: { color: '#F9FAFB', fontSize: 14, fontWeight: '600', fontFamily: 'Lato-Bold' },
  deleteButton: {
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  deleteButtonText: { color: '#EF4444', fontSize: 14, fontWeight: '600', fontFamily: 'Lato-Bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modalContent: {
    backgroundColor: '#1E1E1E', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 20, width: '100%', maxWidth: 320,
    borderWidth: 1, borderColor: '#374151',
  },
  modalTitle: { color: '#F9FAFB', fontSize: 16, fontWeight: '600', marginBottom: 6, textAlign: 'center', fontFamily: 'Lato-Bold' },
  modalMessage: { color: '#9CA3AF', fontSize: 13, lineHeight: 18, marginBottom: 20, textAlign: 'center', fontFamily: 'Lato-Regular' },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalButtonCancel: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent', borderWidth: 1, borderColor: '#374151',
  },
  modalButtonDelete: { flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EF4444' },
  modalButtonTextCancel: { color: '#9CA3AF', fontSize: 13, fontWeight: '600', fontFamily: 'Lato-Bold' },
  modalButtonTextDelete: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', fontFamily: 'Lato-Bold' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 140 },
  contentWithBatchActions: { paddingTop: 8 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 32, gap: 16 },
  emptyTitle: { color: '#F9FAFB', fontWeight: '700', fontSize: 24, fontFamily: 'Lato-Bold', textAlign: 'center', marginBottom: 8 },
  emptyHint: { color: '#9CA3AF', fontSize: 16, fontFamily: 'Lato-Regular', textAlign: 'center', lineHeight: 24 },
  footer: {
    paddingVertical: 14, backgroundColor: '#000000', shadowColor: '#000000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3, marginTop: 10,
  },
  uploadSection: { marginBottom: 20 },
  modelChangeNotification: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2937', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#00E0C7',
    shadowColor: '#00E0C7', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  modelChangeIcon: { fontSize: 18, marginRight: 12 },
  modelChangeText: { color: '#F9FAFB', fontSize: 15, fontFamily: 'Lato-Regular', flex: 1, lineHeight: 20 },
  generateSection: { flexDirection: 'row', alignItems: 'stretch', gap: 8, height: 48, marginTop: 12 },
  generateButtonFlex: { flex: 1, marginTop: 0 },
  modelNameContainer: {
    flex: 0.3, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(156, 163, 175, 0.1)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(156, 163, 175, 0.2)', paddingVertical: 8, paddingHorizontal: 12,
  },
  modelNameText: { color: '#F9FAFB', fontSize: 14, fontWeight: '600', fontFamily: 'Lato-Bold', textAlign: 'center' },
  modelChangedIndicator: { color: '#9CA3AF', fontSize: 10, fontWeight: '400', fontFamily: 'Lato-Regular', textAlign: 'center', marginTop: 2, opacity: 0.8 },
});

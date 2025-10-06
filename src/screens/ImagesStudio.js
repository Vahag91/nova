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

// ---------- helpers ----------
import { normalizeImageUri } from '../lib/imageUtils';

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

    // If preferred model supports the mode, use it
    if (preferredModel && capableModels.includes(preferredModel)) {
      return preferredModel;
    }

    // Otherwise, use the first capable model (prefer FLUX models)
    const fluxModels = capableModels.filter(m => m.includes('flux'));
    return fluxModels[0] || capableModels[0] || "runware-flux-dev";
  }, []);

  // Check model compatibility when mode or model changes
  useEffect(() => {
    if (mode === 'text2img') {
      // For text2img, all models are compatible
      setActualModel(null);
      setModelChanged(false);
      return;
    }

    const bestModel = getBestModelForMode(mode, model);
    const isModelChanged = bestModel !== model;

    setActualModel(bestModel);
    setModelChanged(isModelChanged);

  }, [mode, model, getBestModelForMode]);

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
      }
    })();
    return () => ac.abort();
  }, [setModels]);


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

    // Check if we have a custom onConfirm handler (for multi-select)
    if (deleteConfirm.onConfirm) {
      deleteConfirm.onConfirm();
    } else if (deleteConfirm.type === 'image') {
      deleteImage(deleteConfirm.image.jobId, deleteConfirm.image.id);
      setDeleteConfirm(null);
    } else if (deleteConfirm.type === 'job') {
      deleteJob(deleteConfirm.job.id);
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, deleteImage, deleteJob]);

  const cancelDelete = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  // Multi-select functionality
  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedImages(new Set());
    setShowBatchActions(false);
  }, [isSelectionMode]);

  const toggleImageSelection = useCallback((imageId) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(imageId)) {
      newSelected.delete(imageId);
    } else {
      newSelected.add(imageId);
    }
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

    // Get unique job IDs from selected images (same approach as deleteSelectedJobs)
    const jobIds = new Set();
    selectedImages.forEach(imageId => {
      const image = images.find(img => img.id === imageId);
      if (image) {
        jobIds.add(image.jobId);
      }
    });

    setDeleteConfirm({
      title: t('imagesStudio.deleteSelectedConfirmTitle'),
      message: t('imagesStudio.deleteSelectedConfirmMessage', { count: jobIds.size }),
      onConfirm: () => {
        jobIds.forEach(jobId => {
          deleteJob(jobId);
        });
        clearSelection();
        setIsSelectionMode(false);
        setDeleteConfirm(null);
      }
    });
  }, [selectedImages, images, deleteJob]);



  const images = useMemo(() => {
    const done = (jobs || []).filter((j) => j?.status === 'done');

    const result = done.flatMap((j, jdx) => {
      return (j.images || [])
        .map((img, idx) => {
          const normalizedUrl = normalizeImageUri(img?.url);
          // Ensure unique ID by combining job ID with image ID
          const uniqueId = img?.id ? `${j.id}:${img.id}` : `${j.id || 'job'}:${jdx}:${idx}`;
          const processedImg = {
            ...img,
            id: uniqueId,
            jobId: j.id, // Add jobId to each image
            url: normalizedUrl,
            originalUrl: img?.url, // Preserve original URL for re-caching
            prompt: j.prompt,
            size: j.size || '1024x1024',
            model: j.model,
          };

          return processedImg;
        })
        .filter((img) => !!img.url);
    });

    return result;
  }, [jobs]);

  const canGenerate = (() => {
    if (busy) return false;
    if (mode === 'text2img') return prompt.trim().length > 0;
    if (mode === 'img2img') return seedImage; // prompt optional for img2img
    return false;
  })();


  // ---------- actions ----------
  const onGenerate = useCallback(async () => {
    if (!canGenerate) {
      return;
    }
    setError('');
    setBusy(true);
    setGenerationProgress(0);
    clearFailed();
    setRetryCount(0);

    Haptic.trigger('selection');

    // Animate button press
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        const newProgress = Math.min(prev + Math.random() * 15, 90);
        Animated.timing(progressAnim, {
          toValue: newProgress / 100,
          duration: 200,
          useNativeDriver: false,
        }).start();
        return newProgress;
      });
    }, 500);

    try {
      // Use the actual model that will be used (auto-selected if needed)
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



      let result;
      if (mode === 'img2img') {
        const img2imgParams = {
          ...baseParams,
          seedImage,
          strength: advancedParams.strength || 0.85,
        };
        result = await runImg2Img(img2imgParams);
      } else {
        // text2img
        if (!prompt.trim()) {
          throw new Error(t('imagesStudio.enterPrompt'));
        }
        result = await createJob({
          prompt: prompt.trim(),
          model: modelToUse,
          size,
          n: 1,
          mode: 'text2img',
        });
      }

      // Complete progress
      clearInterval(progressInterval);
      setGenerationProgress(100);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();


      // Log model selection info for debugging
      if (result?.modelSelection?.changed) {
      }

      Haptic.trigger('notificationSuccess');

      // Reset progress after delay
      setTimeout(() => {
        setGenerationProgress(0);
        progressAnim.setValue(0);
      }, 2000);

    } catch (e) {
      clearInterval(progressInterval);
      setError(String(e?.message || t('imagesStudio.imageGenerationFailed')));
      setGenerationProgress(0);
      progressAnim.setValue(0);
      Haptic.trigger('notificationError');
    } finally {
      setBusy(false);
    }
  }, [canGenerate, prompt, model, size, createJob, runImg2Img, clearFailed, buttonScale, progressAnim, mode, actualModel, seedImage, advancedParams]);

  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    onGenerate();
  }, [onGenerate]);

  const handleOpenPhotoGallery = useCallback(() => {
    const options = {
      mediaType: 'photo',
      includeBase64: true,
      maxHeight: 2048,
      maxWidth: 2048,
      quality: 0.8,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }

      const asset = response.assets?.[0];
      if (asset) {
        // Convert to base64 data URI
        const base64DataUri = `data:image/jpeg;base64,${asset.base64}`;

        // Set as seed image and switch to img2img mode
        setSeedImage(base64DataUri);
        setMode('img2img');
      }
    });
  }, [setSeedImage, setMode]);

  const openImageExternally = useCallback((url) => {
    if (isHttp(url)) Linking.openURL(url).catch(() => { });
  }, []);

  const insertAsMarkdown = useCallback(({ prompt: p, url }) => {
    const md = [
      t('imagesStudio.insertMarkdownHeader'),
      ``,
      `> ${p || t('imagesStudio.generatedImage')}`,
      ``,
      `![image](${url})`,
    ].join('\n');
    insertToChat(md);
    navigation.goBack();
  }, [insertToChat, navigation, t]);

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
      // Android fallback: use Alert
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
                <Text style={styles.emptyIcon}>🖼️</Text>
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
            // Model information for display
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
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardAvoidingView: {
    flex: 1,
    paddingTop: 44,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    // fontSize: Math.min(32, useWindowDimensions().width * 0.08),
    fontSize: 28,
    fontWeight: '700',
    color: '#F9FAFB',
    fontFamily: 'Lato-Bold',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  headerButtonActive: {
    // No background or border for clean look
  },
  batchActionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 6,
  },
  batchActionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  batchActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  batchActionsText: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  selectAllButtonText: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalTitle: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
    fontFamily: 'Lato-Bold',
  },
  modalMessage: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Lato-Regular',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#374151',
  },
  modalButtonDelete: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
  },
  modalButtonTextCancel: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  modalButtonTextDelete: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 140,
  },
  contentWithBatchActions: {
    paddingTop: 8,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyIcon: {
    fontSize: 64,
    opacity: 0.6,
  },
  emptyTitle: {
    color: '#F9FAFB',
    fontWeight: '700',
    fontSize: 24,
    fontFamily: 'Lato-Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHint: {
    color: '#9CA3AF',
    fontSize: 16,
    fontFamily: 'Lato-Regular',
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    paddingVertical: 14,
    backgroundColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginTop: 10,
  },
  uploadSection: {
    marginBottom: 20,
  },
  modelChangeNotification: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#00E0C7',
    shadowColor: '#00E0C7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modelChangeIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  modelChangeText: {
    color: '#F9FAFB',
    fontSize: 15,
    fontFamily: 'Lato-Regular',
    flex: 1,
    lineHeight: 20,
  },
  generateSection: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    height: 48,
    marginTop: 12,
  },
  generateButtonFlex: {
    flex: 1,
    marginTop: 0,
  },
  modelNameContainer: {
    flex: 0.3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(156, 163, 175, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modelNameText: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
    textAlign: 'center',
  },
  modelChangedIndicator: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '400',
    fontFamily: 'Lato-Regular',
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.8,
  },
});
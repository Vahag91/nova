import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActionSheetIOS,
  Linking,
  Pressable,
  Animated,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Haptic from 'react-native-haptic-feedback';
import { useImagesStore } from '../state/useImagesStore';
import { useSettingsStore } from '../state/useSettingsStore';
import { fetchModels } from '../api/models';
import '../utils/testImageGeneration'; // Import test functions for dev
import {
  ImageCard,
  AdaptiveGrid,
  ProgressBar,
  InputComposer,
  GenerateButton,
  SettingsModal,
  ImageViewer,
  ErrorDisplay,
  // ModeSelector, // DISABLED - using dropdown in InputComposer now
  AdvancedParams,
  ImageUpload,
  ModeMenu,
} from '../components/image-studio';

// ---------- helpers ----------
import { normalizeImageUri } from '../lib/imageUtils';

// Helper function for URL checking
const isHttp = (url) => /^https?:\/\//i.test(url);

// ---------- Screen ----------
export default function ImagesStudio({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { seedPrompt = '', onInsertToChat } = route?.params || {};
  
  // State
  const [prompt, setPrompt] = useState(seedPrompt || '');
  const [size, setSize] = useState('1024x1024');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState({ open: false, uri: '' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  
  // Mode state
  const [mode, setMode] = useState('text2img');
  const [seedImage, setSeedImage] = useState('');
  const [advancedParams, setAdvancedParams] = useState({});
  const [advancedParamsOpen, setAdvancedParamsOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const plusButtonRef = useRef(null);
  
  // Track actual model being used (for auto-selection feedback)
  const [actualModel, setActualModel] = useState(null);
  const [modelChanged, setModelChanged] = useState(false);
  
  // Model capabilities mapping (should match the backend)
  const MODEL_CAPABILITIES = {
    'runware-flux-dev':      { text2img: true, img2img: true },
    'runware-flux-schnell':  { text2img: true, img2img: true },
    'runware-flux-canny':    { text2img: false, img2img: true }, // canny is for img2img
    'runware-sdxl-civitai':  { text2img: true, img2img: true },
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
    
    console.log('🔍 [SCREEN] Model compatibility check:', {
      mode,
      selectedModel: model,
      bestModel,
      isModelChanged
    });
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
    console.log('🔍 [IMAGES] Computing imageModels from:', Object.keys(models || {}));
    const list = Object.entries(models || {}).filter(([, v]) => v?.caps?.imageGen);
    console.log('🔍 [IMAGES] Filtered image models:', list.map(([key]) => key));
    if (!list.length) {
      console.log('⚠️ [IMAGES] No image models found, using fallback');
      return [{ key: 'runware-flux-dev', display: { name: 'FLUX.1 dev' }, provider: 'runware' }];
    }
    const result = list.map(([key, v]) => ({ key, display: v.display || { name: key }, provider: v.provider }));
    console.log('✅ [IMAGES] Final imageModels:', result.map(m => m.key));
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
        console.log('🔄 [IMAGES] Fetching latest models from server...');
        const incoming = await fetchModels({ signal: ac.signal });
        
        if (incoming && typeof incoming === 'object' && Object.keys(incoming).length > 0) {
          console.log('✅ [IMAGES] Received models from server:', Object.keys(incoming));
          setModels(incoming);
        }
      } catch (error) {
        console.error('❌ [IMAGES] Error fetching models:', error);
      }
    })();
    return () => ac.abort();
  }, [setModels]);

  // Debug function to check image URLs
  const debugImages = useCallback(() => {
    console.log('🔍 [DEBUG] Current images state:');
    images.forEach((img, i) => {
      console.log(`  Image ${i + 1}:`, {
        id: img.id,
        url: img.url?.substring(0, 100),
        urlType: img.url?.startsWith('data:') ? 'data-uri' : img.url?.startsWith('file://') ? 'local-file' : 'remote-url',
        jobId: img.jobId,
        status: jobs.find(j => j.id === img.jobId)?.status
      });
    });
  }, [images, jobs]);

  // Delete handlers
  const handleDeleteImage = useCallback((image) => {
    console.log('🗑️ [IMAGES] Delete image requested:', image);
    const confirmData = {
      type: 'image',
      image,
      title: 'Delete Image',
      message: 'Are you sure you want to delete this image? This action cannot be undone.',
    };
    console.log('🗑️ [IMAGES] Setting delete confirm:', confirmData);
    setDeleteConfirm(confirmData);
  }, []);

  const handleDeleteJob = useCallback((job) => {
    console.log('🗑️ [IMAGES] Delete job requested:', job);
    setDeleteConfirm({
      type: 'job',
      job,
      title: 'Delete All Images',
      message: `Are you sure you want to delete all ${job.images?.length || 0} images from this generation? This action cannot be undone.`,
    });
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteConfirm) {
      console.log('❌ [IMAGES] No delete confirmation found');
      return;
    }
    
    console.log('🗑️ [IMAGES] Confirming delete:', deleteConfirm.type, deleteConfirm);
    
    if (deleteConfirm.type === 'image') {
      console.log('🗑️ [IMAGES] Deleting image:', deleteConfirm.image.id, 'from job:', deleteConfirm.image.jobId);
      deleteImage(deleteConfirm.image.jobId, deleteConfirm.image.id);
      console.log('✅ [IMAGES] Image deletion completed');
    } else if (deleteConfirm.type === 'job') {
      console.log('🗑️ [IMAGES] Deleting job:', deleteConfirm.job.id);
      deleteJob(deleteConfirm.job.id);
      console.log('✅ [IMAGES] Job deletion completed');
    }
    
    setDeleteConfirm(null);
  }, [deleteConfirm, deleteImage, deleteJob]);

  const cancelDelete = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  const images = useMemo(() => {
    const done = (jobs || []).filter((j) => j?.status === 'done');
    const result = done.flatMap((j, jdx) =>
      (j.images || [])
        .map((img, idx) => ({
          ...img,
          id: img?.id || `${j.id || 'job'}:${jdx}:${idx}`,
          jobId: j.id, // Add jobId to each image
          url: normalizeImageUri(img?.url),
          prompt: j.prompt,
          size: j.size || '1024x1024',
          model: j.model,
        }))
        .filter((img) => !!img.url) // Filter out empty URLs
    );
    console.log('🖼️ [IMAGES] Computed images with jobIds:', result.map(img => ({ id: img.id, jobId: img.jobId })));
    return result;
  }, [jobs]);

  const canGenerate = (() => {
    if (busy) return false;
    if (mode === 'text2img') return prompt.trim().length > 0;
    if (mode === 'img2img') return seedImage; // prompt optional for img2img
    return false;
  })();

  // Debug canGenerate
  useEffect(() => {
    console.log('🔍 [SCREEN] canGenerate check:', {
      busy,
      mode,
      promptLength: prompt.trim().length,
      hasSeedImage: !!seedImage,
      canGenerate
    });
  }, [busy, mode, prompt, seedImage, canGenerate]);

  // ---------- actions ----------
  const onGenerate = useCallback(async () => {
    console.log('🎯 [SCREEN] onGenerate called, canGenerate:', canGenerate);
    if (!canGenerate) {
      console.log('❌ [SCREEN] Generation blocked - canGenerate is false');
      return;
    }
    
      console.log('🎯 [SCREEN] Starting image generation:', {
        mode,
        selectedModel: model,
        actualModel: actualModel || model,
        modelChanged: !!modelChanged,
        prompt: prompt?.substring(0, 100) + (prompt?.length > 100 ? '...' : ''),
        size,
        hasSeedImage: !!seedImage,
        advancedParams: Object.keys(advancedParams).length > 0
      });
    
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
      
      console.log('🎯 [SCREEN] Base parameters prepared:', baseParams);


      let result;
      if (mode === 'img2img') {
        const img2imgParams = {
          ...baseParams,
          seedImage,
          strength: advancedParams.strength || 0.85,
        };
        console.log('🔄 [SCREEN] Executing img2img with params:', {
          ...img2imgParams,
          seedImage: !!img2imgParams.seedImage
        });
        result = await runImg2Img(img2imgParams);
      } else {
        // text2img
        if (!prompt.trim()) {
          throw new Error('Please enter a prompt for text-to-image generation');
        }
        console.log('🎨 [SCREEN] Executing text2img with params:', {
          ...baseParams,
          prompt: prompt.trim()
        });
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
      
      console.log('✅ [SCREEN] Generation completed successfully:', {
        mode,
        model,
        resultId: result?.id,
        imagesCount: result?.images?.length || 0,
        modelSelection: result?.modelSelection
      });
      
      // Log model selection info for debugging
      if (result?.modelSelection?.changed) {
        console.log('🔄 [SCREEN] Model was auto-selected:', result.modelSelection.reason);
      }
      
      Haptic.trigger('notificationSuccess');
      
      // Reset progress after delay
      setTimeout(() => {
        setGenerationProgress(0);
        progressAnim.setValue(0);
      }, 2000);
      
    } catch (e) {
      clearInterval(progressInterval);
      console.error('❌ [SCREEN] Generation failed:', {
        mode,
        model,
        error: e?.message || e?.toString(),
        stack: e?.stack?.split('\n')[0]
      });
      setError(String(e?.message || 'Image generation failed'));
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

  const openImageExternally = useCallback((url) => {
    if (isHttp(url)) Linking.openURL(url).catch(() => { });
  }, []);

  const insertAsMarkdown = useCallback(({ prompt: p, url }) => {
    const md = [
      `Here is the image for:`,
      ``,
      `> ${p || 'Generated image'}`,
      ``,
      `![image](${url})`,
    ].join('\n');
    onInsertToChat?.(md);
    navigation.goBack();
  }, [onInsertToChat, navigation]);

  const showTileActions = useCallback((item) => {
    console.log('🎯 [IMAGES] showTileActions called for item:', item);
    const url = item?.url;
    const job = jobs.find(j => j.id === item.jobId);
    const hasMultipleImages = job?.images?.length > 1;
    
    console.log('🎯 [IMAGES] Job found:', job?.id, 'hasMultipleImages:', hasMultipleImages);
    
    const options = [
      'Insert to chat', 
      isHttp(url) ? 'Open in browser' : null, 
      'Make variations', 
      'Delete',
      hasMultipleImages ? 'Delete all from this generation' : null,
      'Cancel'
    ].filter(Boolean);
    
    console.log('🎯 [IMAGES] Action sheet options:', options);
    
    const handler = (ix) => {
      const label = options[ix];
      console.log('🎯 [IMAGES] Action selected:', label, 'for item:', item.id);
      if (label === 'Insert to chat') insertAsMarkdown(item);
      else if (label === 'Open in browser') openImageExternally(url);
      else if (label === 'Make variations') setPrompt(`${prompt.trim()} — variation of previous image`);
      else if (label === 'Delete') {
        console.log('🎯 [IMAGES] Calling handleDeleteImage with:', item);
        handleDeleteImage(item);
      } else if (label === 'Delete all from this generation') {
        console.log('🎯 [IMAGES] Calling handleDeleteJob with:', job);
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
      console.log('🎯 [IMAGES] Android fallback - showing Alert');
      Alert.alert(
        'Image Options',
        'What would you like to do with this image?',
        options.map((option, index) => ({
          text: option,
          onPress: () => handler(index),
          style: option === 'Cancel' ? 'cancel' : 'default',
        }))
      );
    }
  }, [insertAsMarkdown, openImageExternally, prompt, handleDeleteImage, handleDeleteJob, jobs]);

  // ---------- tile renderer ----------
  const renderTile = useCallback((item, _index, tileStyle) => {
    return (
      <ImageCard
        item={item}
        style={tileStyle}
        onPress={() => setViewer({ open: true, uri: item.url })}
        onLongPress={showTileActions}
        onDelete={handleDeleteImage}
        isGenerating={item.status === 'generating'}
      />
    );
  }, [showTileActions, handleDeleteImage]);

  // ---------- UI ----------
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.logo}>🎨</Text>
          <Text style={styles.title}>Studio</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>
      </View>

      {/* Gallery */}
      <ScrollView 
        style={styles.scroll} 
        contentContainerStyle={styles.content} 
        showsVerticalScrollIndicator={false}
        accessibilityLabel="Generated images gallery"
      >
        {images.length > 0 ? (
          <AdaptiveGrid items={images} renderTile={renderTile} horizontalPadding={16} />
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🖼️</Text>
            <Text style={styles.emptyTitle}>No images yet</Text>
            <Text style={styles.emptyHint}>Describe your image below and tap Generate.</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* Mode Selector - DISABLED (using dropdown in InputComposer now) */}
        {/* <ModeSelector
          mode={mode}
          onModeChange={setMode}
          disabled={busy}
        /> */}

        {/* Image Upload for Image to Image Mode */}
        {mode === 'img2img' && (
          <View style={styles.uploadSection}>
            <ImageUpload
              label="Seed Image"
              imageUri={seedImage}
              onImageSelected={setSeedImage}
              onRemoveImage={() => setSeedImage('')}
              required={true}
              disabled={busy}
            />
          </View>
        )}

        <InputComposer
          prompt={prompt}
          onPromptChange={(text) => { setPrompt(text); if (error) setError(''); }}
          onGenerate={onGenerate}
          onClearPrompt={() => setPrompt('')}
          onOpenSettings={() => setSettingsOpen(true)}
          onModeChange={setMode}
          currentMode={mode}
          disabled={busy}
          showModeMenu={showModeMenu}
          onShowModeMenu={setShowModeMenu}
          plusButtonRef={plusButtonRef}
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
              Auto-selected {models?.[actualModel]?.display?.name || actualModel} for {mode} mode
            </Text>
          </View>
        )}

        {/* Generate Button */}
        <GenerateButton
          onPress={onGenerate}
          disabled={!canGenerate}
          busy={busy}
          modelName={models?.[model]?.display?.name || model}
          actualModelName={actualModel ? (models?.[actualModel]?.display?.name || actualModel) : null}
          modelChanged={modelChanged}
          animatedValue={buttonScale}
          onAdvancedParams={() => setAdvancedParamsOpen(true)}
        />
      </View>

      {/* Settings Modal */}
        <SettingsModal
          visible={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          size={size}
          onSizeChange={setSize}
          model={model}
          onModelChange={setModel}
          imageModels={imageModels}
          mode={mode}
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

      {/* ModeMenu rendered at root level for proper positioning */}
      <ModeMenu
        visible={showModeMenu}
        onClose={() => setShowModeMenu(false)}
        currentMode={mode}
        onModeSelect={setMode}
        buttonRef={plusButtonRef}
      />

      {/* Delete Confirmation Dialog */}
      {console.log('🎭 [IMAGES] Modal render check - deleteConfirm:', !!deleteConfirm, deleteConfirm)}
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
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={cancelDelete}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonDelete]}
                onPress={confirmDelete}
              >
                <Text style={styles.modalButtonTextDelete}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ---------- styles ----------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: 44,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    fontSize: 32,
    color: '#00E0C7',
    fontFamily: 'Lato-Bold',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#F9FAFB',
    fontFamily: 'Lato-Bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  close: {
    fontSize: 22,
    color: '#9CA3AF',
    fontFamily: 'Lato-Bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#F9FAFB',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    color: '#D1D5DB',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#374151',
  },
  modalButtonDelete: {
    backgroundColor: '#DC2626',
  },
  modalButtonTextCancel: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextDelete: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    color: '#F9FAFB',
    fontWeight: '700',
    fontSize: 20,
    fontFamily: 'Lato-Bold',
  },
  emptyHint: {
    color: '#9CA3AF',
    fontSize: 16,
    fontFamily: 'Lato-Regular',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    backgroundColor: '#000000',
  },
  uploadSection: {
    marginBottom: 16,
  },
  modelChangeNotification: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#00E0C7',
  },
  modelChangeIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  modelChangeText: {
    color: '#F9FAFB',
    fontSize: 14,
    fontFamily: 'Lato-Regular',
    flex: 1,
  },
});
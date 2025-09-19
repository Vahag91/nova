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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Haptic from 'react-native-haptic-feedback';
import { useImagesStore } from '../state/useImagesStore';
import { useSettingsStore } from '../state/useSettingsStore';
import {
  ImageCard,
  AdaptiveGrid,
  ProgressBar,
  InputComposer,
  GenerateButton,
  SettingsModal,
  ImageViewer,
  ErrorDisplay,
} from '../components/image-studio';

// ---------- helpers ----------
const isHttp = (u = '') => /^https?:\/\//i.test(u);
const isDataUri = (u = '') => /^data:image\/[a-zA-Z]+;base64,/i.test(u);
const looksBase64 = (u = '') => !isHttp(u) && !isDataUri(u) && /^[A-Za-z0-9+/=\s]+$/.test(u.slice(0, 80));
const normalizeImageUri = (url) => {
  if (!url) return '';
  if (isHttp(url) || isDataUri(url)) return url;
  if (looksBase64(url)) return `data:image/png;base64,${url.trim()}`;
  return url;
};

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
  
  // Animation refs
  const progressAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  // Stores
  const createJob = useImagesStore((s) => s.createJob);
  const jobs = useImagesStore((s) => s.jobs);
  const clearFailed = useImagesStore((s) => s.clearFailed);
  const models = useSettingsStore((s) => s.models);

  // Computed values
  const imageModels = useMemo(() => {
    const list = Object.entries(models || {}).filter(([, v]) => v?.caps?.imageGen);
    if (!list.length) return [{ key: 'runware-flux-dev', display: { name: 'FLUX.1 dev' }, provider: 'runware' }];
    return list.map(([key, v]) => ({ key, display: v.display || { name: key }, provider: v.provider }));
  }, [models]);

  const [model, setModel] = useState(imageModels[0]?.key || 'runware-flux-dev');
  
  useEffect(() => {
    if (imageModels.length > 0 && !imageModels.find((m) => m.key === model)) {
      setModel(imageModels[0].key);
    }
  }, [imageModels, model]);

  const images = useMemo(() => {
    const done = (jobs || []).filter((j) => j?.status === 'done');
    return done.flatMap((j, jdx) =>
      (j.images || []).map((img, idx) => ({
        ...img,
        id: img?.id || `${j.id || 'job'}:${jdx}:${idx}`,
        url: normalizeImageUri(img?.url),
        prompt: j.prompt,
        size: j.size || '1024x1024',
        model: j.model,
      }))
    );
  }, [jobs]);

  const canGenerate = prompt.trim().length > 0 && !busy;

  // ---------- actions ----------
  const onGenerate = useCallback(async () => {
    if (!canGenerate) return;
    
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
      await createJob({
        prompt: prompt.trim(),
        model,
        size,
        n: 1,
      });
      
      // Complete progress
      clearInterval(progressInterval);
      setGenerationProgress(100);
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
      
      Haptic.trigger('notificationSuccess');
      
      // Reset progress after delay
      setTimeout(() => {
        setGenerationProgress(0);
        progressAnim.setValue(0);
      }, 2000);
      
    } catch (e) {
      clearInterval(progressInterval);
      setError(String(e?.message || 'Image generation failed'));
      setGenerationProgress(0);
      progressAnim.setValue(0);
      Haptic.trigger('notificationError');
    } finally {
      setBusy(false);
    }
  }, [canGenerate, prompt, model, size, createJob, clearFailed, buttonScale, progressAnim]);

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
    const url = item?.url;
    const options = ['Insert to chat', isHttp(url) ? 'Open in browser' : null, 'Make variations', 'Cancel'].filter(Boolean);
    const handler = (ix) => {
      const label = options[ix];
      if (label === 'Insert to chat') insertAsMarkdown(item);
      else if (label === 'Open in browser') openImageExternally(url);
      else if (label === 'Make variations') setPrompt(`${prompt.trim()} — variation of previous image`);
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: options.length - 1, userInterfaceStyle: 'dark' },
        handler
      );
    } else {
      // Simple fallback: do the first useful action
      handler(0);
    }
  }, [insertAsMarkdown, openImageExternally, prompt]);

  // ---------- tile renderer ----------
  const renderTile = useCallback((item, _index, tileStyle) => {
    return (
      <ImageCard
        item={item}
        style={tileStyle}
        onPress={() => setViewer({ open: true, uri: item.url })}
        onLongPress={showTileActions}
        isGenerating={item.status === 'generating'}
      />
    );
  }, [showTileActions]);

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
          <Text style={styles.logo}>✨</Text>
          <Text style={styles.title}>Studio</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.creditPill}>
            <Text style={styles.creditBolt}>⚡</Text>
            <Text style={styles.creditText}>1</Text>
          </View>
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
          <AdaptiveGrid items={images} renderTile={renderTile} />
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
        <InputComposer
          prompt={prompt}
          onPromptChange={(text) => { setPrompt(text); if (error) setError(''); }}
          onGenerate={onGenerate}
          onClearPrompt={() => setPrompt('')}
          onOpenSettings={() => setSettingsOpen(true)}
          disabled={busy}
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

        {/* Generate Button */}
        <GenerateButton
          onPress={onGenerate}
          disabled={!canGenerate}
          busy={busy}
          modelName={models?.[model]?.display?.name || model}
          animatedValue={buttonScale}
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
      />

      {/* Image Viewer */}
      <ImageViewer
        visible={viewer.open}
        imageUri={viewer.uri}
        onClose={() => setViewer({ open: false, uri: '' })}
      />
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
  creditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creditBolt: {
    fontSize: 22,
    color: '#FBBF24',
    fontFamily: 'Lato-Bold',
  },
  creditText: {
    color: '#9CA3AF',
    fontWeight: '600',
    fontSize: 16,
    fontFamily: 'Lato-Bold',
  },
  close: {
    fontSize: 22,
    color: '#9CA3AF',
    fontFamily: 'Lato-Bold',
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
});
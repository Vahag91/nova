// app/src/screens/ImagesStudio.jsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Haptic from 'react-native-haptic-feedback';
import { useImagesStore } from '../state/useImagesStore';
import { useSettingsStore } from '../state/useSettingsStore';
import { colors } from '../styles/colors';

export default function ImagesStudio({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { seedPrompt = '', onInsertToChat } = route?.params || {};
  const [prompt, setPrompt] = useState(seedPrompt);
  const [size, setSize] = useState('1024x1024'); // '1024x576' | '576x1024'
  const [count, setCount] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const createJob = useImagesStore((s) => s.createJob);
  const jobs = useImagesStore((s) => s.jobs);

  // Only show models that can do images. Fallback to gpt-image-1 chip.
  const models = useSettingsStore((s) => s.models);
  const imageModels = useMemo(() => {
    const list = Object.entries(models || {}).filter(([, v]) => v?.caps?.image);
    if (!list.length) return [{ key: 'gpt-image-1', display: { name: 'gpt-image-1' } }];
    return list.map(([key, v]) => ({ key, display: v.display || { name: key } }));
  }, [models]);

  const [model, setModel] = useState(imageModels[0]?.key || 'gpt-image-1');

  const latest =
    jobs.find((j) => j.status === 'running') ||
    jobs.find((j) => j.status === 'done') ||
    null;

  const canGenerate = prompt.trim().length > 0 && !busy;

  function aspectFromSize(s) {
    // returns numeric aspect ratio (w/h) for the grid tiles
    if (s === '1024x576') return 1024 / 576; // ~1.78 (landscape)
    if (s === '576x1024') return 576 / 1024; // ~0.56 (portrait)
    return 1; // square
  }

  async function onGenerate() {
    if (!canGenerate) return;
    setError('');
    setBusy(true);
    Haptic.trigger('selection');
    try {
      await createJob({
        prompt: prompt.trim(),
        model,
        size,
        n: count,
      });
      Haptic.trigger('notificationSuccess');
    } catch (e) {
      setError(String(e?.message || 'Image generation failed'));
      Haptic.trigger('notificationError');
    } finally {
      setBusy(false);
    }
  }

  function insertJobAsMarkdown(job) {
    if (!job || !job.images?.length) return;
    const md = [
      `Here ${job.images.length > 1 ? 'are' : 'is'} ${job.images.length} image${
        job.images.length > 1 ? 's' : ''
      } for:`,
      ``,
      `> ${job.prompt}`,
      ``,
      ...job.images.map((img) => `![image](${img.url})`),
    ].join('\n');
    onInsertToChat?.(md);
    navigation.goBack();
  }

  function openImage(url) {
    if (!url) return;
    Linking.openURL(url).catch(() => {});
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Images</Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

          {/* Prompt */}
          <View style={styles.row}>
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Describe the image you want…"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
              multiline
              maxLength={4000}
            />
            {!!error && (
              <Text style={styles.errorText} numberOfLines={2}>
                {error}
              </Text>
            )}
          </View>

          {/* Model chips */}
          <FlatList
            data={imageModels}
            keyExtractor={(i) => i.key}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.row, { gap: 8, paddingVertical: 6 }]}
            renderItem={({ item }) => {
              const sel = item.key === model;
              return (
                <Pressable
                  onPress={() => setModel(item.key)}
                  style={[styles.chip, sel && styles.chipSel]}
                >
                  <Text
                    style={[styles.chipText, sel && styles.chipTextSel]}
                    numberOfLines={1}
                  >
                    {item.display?.name || item.key}
                  </Text>
                </Pressable>
              );
            }}
          />

          {/* Size + count */}
          <View style={[styles.row, { gap: 8 }]}>
            {['1024x1024', '1024x576', '576x1024'].map((s) => {
              const sel = size === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setSize(s)}
                  style={[styles.chip, sel && styles.chipSel]}
                >
                  <Text style={[styles.chipText, sel && styles.chipTextSel]}>
                    {s.replace('x', '×')}
                  </Text>
                </Pressable>
              );
            })}
            <View style={{ width: 8 }} />
            {[1, 2, 3, 4].map((n) => {
              const sel = count === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setCount(n)}
                  style={[styles.chip, sel && styles.chipSel]}
                >
                  <Text style={[styles.chipText, sel && styles.chipTextSel]}>
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Generate */}
          <Pressable
            disabled={!canGenerate}
            onPress={onGenerate}
            style={[styles.generate, !canGenerate && styles.generateDisabled]}
          >
            {busy ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.generateText}>Generate</Text>
            )}
          </Pressable>

          {/* Latest job */}
          {latest && (
            <>
              <View style={styles.subHeader}>
                <Text style={styles.subTitle}>
                  {latest.status === 'running' ? 'Generating…' : 'Latest'}
                </Text>
                {latest.status === 'done' && latest.images?.length > 0 && (
                  <Pressable onPress={() => insertJobAsMarkdown(latest)}>
                    <Text style={styles.insert}>Insert to chat</Text>
                  </Pressable>
                )}
              </View>

              {latest.status === 'running' && (
                <View style={styles.runningBox}>
                  <ActivityIndicator />
                  <Text style={styles.runningText}>Please wait…</Text>
                </View>
              )}

              {latest.status === 'done' && (
                <FlatList
                  data={latest.images || []}
                  keyExtractor={(i) => i.id}
                  numColumns={2}
                  columnWrapperStyle={{ gap: 8 }}
                  contentContainerStyle={{ paddingBottom: 12 }}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => openImage(item.url)}
                      style={[
                        styles.card,
                        { aspectRatio: aspectFromSize(size) },
                      ]}
                    >
                      <Image
                        source={{ uri: item.url }}
                        style={styles.image}
                        resizeMode="cover"
                      />
                    </Pressable>
                  )}
                />
              )}

              {latest.status === 'failed' && (
                <View style={styles.failedBox}>
                  <Text style={styles.failedText}>
                    Image generation failed.
                  </Text>
                </View>
              )}
            </>
          )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingBottom: 6,
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  close: { fontSize: 18, color: colors.text },

  row: { paddingHorizontal: 6, paddingVertical: 6 },
  input: {
    minHeight: 64,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: 10,
    fontSize: 14,
    color: colors.inputText,
    textAlignVertical: 'top',
  },
  errorText: { marginTop: 6, color: colors.error, fontSize: 12 },

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  chipSel: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
  chipText: { fontSize: 12, color: colors.text },
  chipTextSel: { color: colors.primary, fontWeight: '700' },

  generate: {
    marginHorizontal: 6,
    marginVertical: 8,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  generateDisabled: { opacity: 0.5 },
  generateText: { color: colors.buttonText, fontWeight: '800' },

  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginTop: 6,
    marginBottom: 6,
  },
  subTitle: { color: colors.textSecondary, fontWeight: '700' },
  insert: { color: colors.primary, fontWeight: '800' },

  runningBox: {
    height: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  runningText: { marginTop: 8, color: colors.textSecondary },

  failedBox: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 12,
    marginHorizontal: 6,
    padding: 12,
    backgroundColor: colors.error + '10',
  },
  failedText: { color: colors.error, fontWeight: '600' },

  card: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  image: { width: '100%', height: '100%' },
});

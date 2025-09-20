import React, { memo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ModelGuidance from './ModelGuidance';

const SettingsModal = memo(({
  visible,
  onClose,
  size,
  onSizeChange,
  model,
  onModelChange,
  imageModels = [],
  mode = 'text2img',
}) => {
  const insets = useSafeAreaInsets();

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleSizeChange = useCallback((newSize) => {
    onSizeChange?.(newSize);
  }, [onSizeChange]);

  const handleModelChange = useCallback((newModel) => {
    onModelChange?.(newModel);
  }, [onModelChange]);

  // Auto-adjust size when model changes to ensure compatibility
  useEffect(() => {
    const isSDXL = model === 'runware-sdxl-civitai';
    const currentPixels = parseInt(size.split('x')[0]) * parseInt(size.split('x')[1]);
    
    // If current size exceeds 1M pixels for SDXL, adjust to 1024x1024
    if (isSDXL && currentPixels > 1048576) {
      onSizeChange?.('1024x1024');
    }
  }, [model, size, onSizeChange]);

  const providerIcon = (modelKey = '', provider = '') => {
    const k = String(modelKey).toLowerCase();
    const p = String(provider).toLowerCase();
    if (p.includes('openai') || k.includes('gpt')) return '🧠';
    if (p.includes('anthropic') || k.includes('claude')) return '🎭';
    if (p.includes('google') || k.includes('gemini')) return '💎';
    return '🖼️';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={handleClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Text style={styles.sheetTitle}>Settings</Text>

        <Text style={styles.sheetLabel}>Size</Text>
        <View style={styles.rowInline}>
          {(() => {
            // Model-specific size options
            const isSDXL = model === 'runware-sdxl-civitai';
            const availableSizes = isSDXL 
              ? ['512x512', '1024x1024']  // SDXL: Limited to 1M pixels max
              : ['512x512', '1024x1024', '1024x1536', '1536x1024', '1280x1280'];  // FLUX: Full options up to 2M pixels
            
            return availableSizes.map((s) => {
              const sel = size === s;
              return (
                <Pressable 
                  key={s} 
                  onPress={() => handleSizeChange(s)} 
                  style={[styles.chip, sel && styles.chipSel]}
                >
                  <Text style={[styles.chipText, sel && styles.chipTextSel]}>
                    {s.replace('x', '×')}
                  </Text>
                </Pressable>
              );
            });
          })()}
        </View>

        <Text style={[styles.sheetLabel, { marginTop: 12 }]}>Model</Text>
        <View style={styles.rowInline}>
          {imageModels.map((m) => {
            const sel = m.key === model;
            return (
              <Pressable 
                key={m.key} 
                onPress={() => handleModelChange(m.key)} 
                style={[styles.chip, sel && styles.chipSel]}
              >
                <Text style={{ fontSize: 13, marginRight: 6 }}>
                  {providerIcon(m.key, m.provider)}
                </Text>
                <Text style={[styles.chipText, sel && styles.chipTextSel]} numberOfLines={1}>
                  {m.display?.name || m.key}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ModelGuidance model={model} mode={mode} />

        <Pressable onPress={handleClose} style={styles.sheetClose}>
          <Text style={styles.sheetCloseText}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
});

const styles = {
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 12,
  },
  sheetTitle: {
    color: '#F9FAFB',
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 8,
    fontFamily: 'Lato-Bold',
  },
  sheetLabel: {
    color: '#9CA3AF',
    fontWeight: '700',
    marginBottom: 6,
    fontFamily: 'Lato-Bold',
  },
  rowInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 999,
    backgroundColor: '#1E1E1E',
  },
  chipSel: {
    borderColor: '#00e0c6',
    backgroundColor: '#00e0c618',
  },
  chipText: {
    fontSize: 12,
    color: '#F9FAFB',
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  chipTextSel: {
    color: '#00e0c6',
    fontWeight: '800',
  },
  sheetClose: {
    alignSelf: 'flex-end',
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#00E0C7',
  },
  sheetCloseText: {
    color: '#000000',
    fontWeight: '800',
    fontFamily: 'Lato-Bold',
  },
};

export default SettingsModal;

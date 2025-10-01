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
import SvgIcon from '../SvgIcon';

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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.sheetTitle}>Settings</Text>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <SvgIcon name="close" size={20} color="#9CA3AF" />
          </Pressable>
        </View>

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
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    color: '#F9FAFB',
    fontWeight: '600',
    fontSize: 16,
    fontFamily: 'Lato-Bold',
  },
  closeButton: {
    padding: 4,
  },
  sheetLabel: {
    color: '#F9FAFB',
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 8,
    fontFamily: 'Lato-Bold',
  },
  rowInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  chipSel: {
    borderColor: '#8A42FF',
    backgroundColor: 'rgba(138, 66, 255, 0.15)',
  },
  chipText: {
    fontSize: 13,
    color: '#F9FAFB',
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  chipTextSel: {
    color: '#8A42FF',
    fontWeight: '600',
  },
  sheetClose: {
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#8A42FF',
  },
  sheetCloseText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    fontFamily: 'Lato-Bold',
  },
};

export default SettingsModal;

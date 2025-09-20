import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';

const ModeSelector = memo(({
  mode,
  onModeChange,
  disabled = false,
}) => {
  const handleModeChange = useCallback((newMode) => {
    onModeChange?.(newMode);
  }, [onModeChange]);

  const modes = [
    { key: 'text2img', label: 'Text to Image', icon: '🎨' },
    { key: 'img2img', label: 'Image to Image', icon: '🔄' },
    { key: 'inpaint', label: 'Inpaint', icon: '🖌️' },
    { key: 'outpaint', label: 'Outpaint', icon: '📐' },
    { key: 'redux', label: 'Redux', icon: '🎭' },
    { key: 'canny', label: 'Canny', icon: '📏' },
    { key: 'depth', label: 'Depth', icon: '🏔️' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Mode</Text>
      <View style={styles.modesContainer}>
        {modes.map((m) => {
          const selected = mode === m.key;
          return (
            <Pressable
              key={m.key}
              onPress={() => handleModeChange(m.key)}
              disabled={disabled}
              style={[styles.modeChip, selected && styles.modeChipSelected]}
            >
              <Text style={styles.modeIcon}>{m.icon}</Text>
              <Text style={[styles.modeText, selected && styles.modeTextSelected]} numberOfLines={1}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    color: '#9CA3AF',
    fontWeight: '700',
    marginBottom: 8,
    fontSize: 14,
    fontFamily: 'Lato-Bold',
  },
  modesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 20,
    backgroundColor: '#1E1E1E',
    minWidth: 80,
  },
  modeChipSelected: {
    borderColor: '#00E0C7',
    backgroundColor: '#00E0C718',
  },
  modeIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  modeText: {
    fontSize: 12,
    color: '#F9FAFB',
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  modeTextSelected: {
    color: '#00E0C7',
    fontWeight: '800',
  },
});

export default ModeSelector;

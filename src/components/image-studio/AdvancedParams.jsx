import React, { memo, useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AdvancedParams = memo(({
  visible,
  onClose,
  mode,
  params = {},
  onParamsChange,
}) => {
  const insets = useSafeAreaInsets();
  const [localParams, setLocalParams] = useState(params);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleParamChange = useCallback((key, value) => {
    const newParams = { ...localParams, [key]: value };
    setLocalParams(newParams);
    onParamsChange?.(newParams);
  }, [localParams, onParamsChange]);

  const handleSave = useCallback(() => {
    onParamsChange?.(localParams);
    onClose?.();
  }, [localParams, onParamsChange, onClose]);

  if (!visible) return null;

  const renderParam = (key, label, type = 'number', options = {}) => {
    const value = localParams[key] ?? options.default ?? '';
    
    return (
      <View style={styles.paramRow} key={key}>
        <Text style={styles.paramLabel}>{label}</Text>
        {type === 'number' ? (
          <TextInput
            style={styles.paramInput}
            value={String(value)}
            onChangeText={(text) => handleParamChange(key, parseFloat(text) || 0)}
            keyboardType="numeric"
            placeholder={String(options.default || '')}
            placeholderTextColor="#6B7280"
          />
        ) : type === 'text' ? (
          <TextInput
            style={styles.paramInput}
            value={String(value)}
            onChangeText={(text) => handleParamChange(key, text)}
            placeholder={options.placeholder || ''}
            placeholderTextColor="#6B7280"
          />
        ) : (
          <View style={styles.optionsContainer}>
            {options.options?.map((option) => (
              <Pressable
                key={option}
                onPress={() => handleParamChange(key, option)}
                style={[
                  styles.optionChip,
                  value === option && styles.optionChipSelected
                ]}
              >
                <Text style={[
                  styles.optionText,
                  value === option && styles.optionTextSelected
                ]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  };

  const getModeParams = () => {
    switch (mode) {
      case 'img2img':
        return (
          <>
            {renderParam('strength', 'Strength', 'number', { default: 0.85, min: 0, max: 1 })}
            {renderParam('steps', 'Steps', 'number', { default: 30, min: 1, max: 100 })}
            {renderParam('CFGScale', 'CFG Scale', 'number', { default: 9, min: 1, max: 20 })}
          </>
        );
      case 'inpaint':
        return (
          <>
            {renderParam('steps', 'Steps', 'number', { default: 30, min: 1, max: 100 })}
            {renderParam('CFGScale', 'CFG Scale', 'number', { default: 10, min: 1, max: 20 })}
          </>
        );
      case 'outpaint':
        return (
          <>
            {renderParam('blur', 'Blur', 'number', { default: 12, min: 0, max: 50 })}
            {renderParam('steps', 'Steps', 'number', { default: 30, min: 1, max: 100 })}
            {renderParam('CFGScale', 'CFG Scale', 'number', { default: 12, min: 1, max: 20 })}
          </>
        );
      case 'redux':
        return (
          <>
            {renderParam('steps', 'Steps', 'number', { default: 28, min: 1, max: 100 })}
            {renderParam('CFGScale', 'CFG Scale', 'number', { default: 9, min: 1, max: 20 })}
          </>
        );
      case 'canny':
      case 'depth':
        return (
          <>
            {renderParam('steps', 'Steps', 'number', { default: 30, min: 1, max: 100 })}
            {renderParam('CFGScale', 'CFG Scale', 'number', { default: 9, min: 1, max: 20 })}
          </>
        );
      default:
        return (
          <>
            {renderParam('steps', 'Steps', 'number', { default: 30, min: 1, max: 100 })}
            {renderParam('CFGScale', 'CFG Scale', 'number', { default: 9, min: 1, max: 20 })}
          </>
        );
    }
  };

  return (
    <View style={[styles.backdrop, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.container}>
        <Text style={styles.title}>Advanced Parameters</Text>
        
        <View style={styles.paramsContainer}>
          {getModeParams()}
        </View>

        <View style={styles.actions}>
          <Pressable onPress={handleClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable onPress={handleSave} style={styles.saveButton}>
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  container: {
    backgroundColor: '#1E1E1E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#374151',
    padding: 16,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    color: '#F9FAFB',
    fontWeight: '800',
    fontSize: 18,
    marginBottom: 16,
    fontFamily: 'Lato-Bold',
  },
  paramsContainer: {
    marginBottom: 20,
  },
  paramRow: {
    marginBottom: 16,
  },
  paramLabel: {
    color: '#9CA3AF',
    fontWeight: '600',
    marginBottom: 6,
    fontSize: 14,
    fontFamily: 'Lato-Bold',
  },
  paramInput: {
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F9FAFB',
    fontSize: 16,
    fontFamily: 'Lato-Regular',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 16,
    backgroundColor: '#1E1E1E',
  },
  optionChipSelected: {
    borderColor: '#00E0C7',
    backgroundColor: '#00E0C718',
  },
  optionText: {
    color: '#F9FAFB',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  optionTextSelected: {
    color: '#00E0C7',
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#374151',
    alignItems: 'center',
  },
  cancelText: {
    color: '#F9FAFB',
    fontWeight: '600',
    fontSize: 16,
    fontFamily: 'Lato-Bold',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#00E0C7',
    alignItems: 'center',
  },
  saveText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 16,
    fontFamily: 'Lato-Bold',
  },
});

export default AdvancedParams;

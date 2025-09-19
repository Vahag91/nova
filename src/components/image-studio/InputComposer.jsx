import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
} from 'react-native';

const InputComposer = memo(({
  prompt,
  onPromptChange,
  onGenerate,
  onClearPrompt,
  onOpenSettings,
  maxLength = 4000,
  placeholder = "Describe your image...",
  disabled = false,
}) => {
  const handlePromptChange = useCallback((text) => {
    onPromptChange?.(text);
  }, [onPromptChange]);

  const handleClearPrompt = useCallback(() => {
    onClearPrompt?.();
  }, [onClearPrompt]);

  const handleOpenSettings = useCallback(() => {
    onOpenSettings?.();
  }, [onOpenSettings]);

  return (
    <View style={styles.composer}>
      <View style={styles.inputContainer}>
        <TextInput
          value={prompt}
          onChangeText={handlePromptChange}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          style={styles.input}
          maxLength={maxLength}
          multiline={false}
          returnKeyType="send"
          onSubmitEditing={onGenerate}
          editable={!disabled}
          accessibilityLabel="Image description input"
          accessibilityHint="Enter a description of the image you want to generate"
        />
        {prompt.length > 0 && (
          <Pressable 
            onPress={handleClearPrompt} 
            style={styles.clearButton}
            accessibilityLabel="Clear input"
          >
            <Text style={styles.clearIcon}>✕</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.charCounter}>
        {prompt.length}/{maxLength}
      </Text>
      <View style={styles.iconGroup}>
        <Pressable 
          style={styles.iconBtn} 
          onPress={() => { /* future: add reference */ }} 
          hitSlop={8}
          accessibilityLabel="Add reference image"
        >
          <Text style={styles.iconTxt}>➕</Text>
        </Pressable>
        <Pressable 
          style={styles.iconBtn} 
          onPress={handleOpenSettings} 
          hitSlop={8}
          accessibilityLabel="Open settings"
        >
          <Text style={styles.iconTxt}>⚙️</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = {
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderWidth: 0,
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: '#F9FAFB',
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontFamily: 'Lato-Regular',
  },
  clearButton: {
    padding: 4,
    marginRight: 8,
  },
  clearIcon: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  charCounter: {
    color: '#6B7280',
    fontSize: 12,
    marginRight: 8,
    minWidth: 60,
    textAlign: 'right',
  },
  iconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  iconBtn: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  iconTxt: {
    fontSize: 22,
    color: '#9CA3AF',
  },
};

export default InputComposer;

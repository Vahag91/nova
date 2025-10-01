import React, { memo, useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
} from 'react-native';
import SvgIcon from '../SvgIcon';

const InputComposer = memo(({
  prompt,
  onPromptChange,
  onGenerate,
  onClearPrompt,
  onOpenSettings,
  onModeChange,
  currentMode = 'text2img',
  maxLength = 4000,
  placeholder = "Describe your image...",
  disabled = false,
  // Expose button ref to parent
  plusButtonRef,
  // Auto-expanding input settings
  minInputHeight = 40,
  maxInputHeight = 120,
  // Selected image for img2img mode
  selectedImageUri,
  onRemoveSelectedImage,
  // Photo gallery selection
  onOpenPhotoGallery,
  // Model information
  currentModel,
  modelChanged,
  originalModel,
}) => {
  // Auto-expanding input state
  const [isExpanded, setIsExpanded] = useState(false);
  const handlePromptChange = useCallback((text) => {
    onPromptChange?.(text);
  }, [onPromptChange]);

  const handleClearPrompt = useCallback(() => {
    onClearPrompt?.();
  }, [onClearPrompt]);

  const handleOpenSettings = useCallback(() => {
    onOpenSettings?.();
  }, [onOpenSettings]);

  const handlePlusPress = useCallback(() => {
    onOpenPhotoGallery?.();
  }, [onOpenPhotoGallery]);

  // Handle content size changes for responsive height
  const handleContentSizeChange = useCallback((event) => {
    const { height } = event.nativeEvent.contentSize;
    if (height && height > 0) {
      // Just track if we're expanded, don't control the height
      setIsExpanded(height > minInputHeight);
    }
  }, [minInputHeight]);

  return (
    <View style={[
      styles.composer,
      isExpanded && styles.composerExpanded
    ]}>
      {/* Selected Image Preview (for img2img mode) */}
      {selectedImageUri && (
        <View style={styles.selectedImageContainer}>
          <View style={styles.selectedImagePreview}>
            <Image 
              source={{ uri: selectedImageUri }} 
              style={styles.selectedImage}
              resizeMode="cover"
            />
            <Pressable
              style={styles.selectedImageRemoveButton}
              onPress={onRemoveSelectedImage}
              disabled={disabled}
            >
              <Text style={styles.selectedImageRemoveIcon}>✕</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Input field with clear button and camera icon */}
      <View style={styles.inputContainer}>
        {/* Text input */}
        <TextInput
          value={prompt}
          onChangeText={handlePromptChange}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          style={[
            styles.input,
            {
              maxHeight: maxInputHeight,
            }
          ]}
          maxLength={maxLength}
          multiline={true}
          returnKeyType="send"
          onSubmitEditing={onGenerate}
          editable={!disabled}
          onContentSizeChange={handleContentSizeChange}
          textAlignVertical={isExpanded ? "top" : "center"}
          accessibilityLabel="Image description input"
          accessibilityHint="Enter a description of the image you want to generate"
        />
        
        {/* Model selector on the left */}
        <Pressable
          style={styles.modelButton}
          onPress={onOpenSettings}
          hitSlop={8}
          accessibilityLabel="Open model settings"
          accessibilityHint="Tap to change model and settings"
        >
          <Text style={styles.modelButtonText}>
            {currentModel || 'Model'}
          </Text>
          {modelChanged && (
            <Text style={styles.modelChangedDot}>•</Text>
          )}
        </Pressable>

        {/* Camera icon on the right */}
        <View
          ref={plusButtonRef}
          collapsable={false}
          style={{ borderRadius: 8 }}
        >
          <Pressable
            style={styles.cameraButtonRight}
            onPress={handlePlusPress}
            hitSlop={8}
            accessibilityLabel="Open photo gallery"
          >
            <SvgIcon name="photo" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
        
        {/* Clear button on the right */}
        {prompt.length > 0 && (
          <Pressable
            onPress={handleClearPrompt}
            style={styles.clearButtonRight}
            accessibilityLabel="Clear input"
          >
            <SvgIcon name="close" size={18} color="#9CA3AF" />
          </Pressable>
        )}
      </View>


      {/* ModeMenu moved to root level in ImagesStudio.js */}
    </View>
  );
});

const styles = {
  composer: {
    flexDirection: 'column',
    backgroundColor: '#1E1E1E',
    borderColor: '#374151',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  composerExpanded: {
    paddingVertical: 12,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: '#F9FAFB',
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 2,
    paddingRight: 8,
    fontFamily: 'Lato-Regular',
    minHeight: 32,
    textAlignVertical: 'center',
    backgroundColor: 'transparent',
  },
  modelButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    backgroundColor: 'rgba(156, 163, 175, 0.1)',
    borderRadius: 8,
    minWidth: 60,
    maxWidth: 100,
  },
  modelButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
    textAlign: 'center',
  },
  modelChangedDot: {
    color: '#8A42FF',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: -2,
  },
  cameraButtonRight: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  clearButtonRight: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  activeIconBtn: {
    backgroundColor: 'rgba(0, 224, 199, 0.15)',
  },
  activeIconTxt: {
    color: '#00E0C7',
  },
  selectedImageContainer: {
    marginBottom: 8,
  },
  selectedImagePreview: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#374151',
    alignSelf: 'flex-start',
  },
  selectedImage: {
    width: 80,
    height: 80,
  },
  selectedImageRemoveButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedImageRemoveIcon: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
};

export default InputComposer;

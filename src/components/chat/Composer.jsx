import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { colors } from '../../styles/colors';

const noop = () => {};

export default function Composer({
  value,
  onChange,
  onSend,
  onStop,
  streaming,
  offline = false,
  placeholder = 'Type your message...',
  // Optional action handlers (safe no-ops by default)
  onCreateImagesPress = noop,
  onOpenCameraPress = noop,
  onSearchPress = noop,
  onClipboardPress = noop,
  onMicPress = noop,
  // UI options
  maxLength = 4000,
  minInputHeight = 40,
  maxInputHeight = 140,
  keyboardVerticalOffsetIOS = 8,
}) {
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const [inputHeight, setInputHeight] = useState(minInputHeight);
  const [isExpanded, setIsExpanded] = useState(false);

  // Animate quick actions tray
  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: expanded ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false, // height/opacity animation
    }).start();
  }, [expanded, expandAnim]);

  const canSend = useMemo(() => {
    return !streaming && !offline && value && value.trim().length > 0;
  }, [streaming, offline, value]);

  const showCounter = useMemo(() => {
    // Reveal counter when close to the limit
    return value && value.length >= Math.max(0, maxLength - 300);
  }, [value, maxLength]);

  const actionsHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 56],
  });
  const actionsOpacity = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const toggleActions = () => setExpanded((v) => !v);

  const handleSend = () => {
    if (canSend) onSend();
  };

  const handleStop = () => {
    console.log('Composer handleStop called, streaming:', streaming, 'onStop:', !!onStop);
    if (streaming && onStop) {
      console.log('Calling onStop');
      onStop();
    } else {
      console.log('Not calling onStop - streaming:', streaming, 'onStop exists:', !!onStop);
    }
  };

  // Handle content size changes for responsive height
  const handleContentSizeChange = (event) => {
    const { height } = event.nativeEvent.contentSize;
    if (height && height > 0) {
      const newHeight = Math.max(minInputHeight, Math.min(height, maxInputHeight));
      setInputHeight(newHeight);
      setIsExpanded(newHeight > minInputHeight);
    }
  };

  return (
    <View style={styles.wrapper}>

        {/* Quick Actions (animated tray) */}
        <Animated.View
          style={[
            styles.quickActionsContainer,
            { height: actionsHeight, opacity: actionsOpacity },
          ]}
          pointerEvents={expanded ? 'auto' : 'none'}
        >
          <View style={styles.quickActionsRow}>
            <ActionChip
              label="Create images"
              icon="🖼️"
              onPress={onCreateImagesPress}
              accessibilityLabel="Create images"
            />
            <ActionChip
              label="Open camera"
              icon="📷"
              onPress={onOpenCameraPress}
              accessibilityLabel="Open camera"
            />
            <ActionChip
              label="Search"
              icon="🔍"
              onPress={onSearchPress}
              accessibilityLabel="Search"
            />
            <ActionChip
              label="Clipboard"
              icon="📋"
              onPress={onClipboardPress}
              accessibilityLabel="Paste from clipboard"
            />
          </View>
        </Animated.View>

        {/* Input Card */}
        <View style={[
          styles.inputCard,
          isExpanded && styles.inputCardExpanded
        ]}>

          {/* Left accessory: + (expander) */}
          <TouchableOpacity
            onPress={toggleActions}
            style={styles.iconButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Hide quick actions' : 'Show quick actions'}
          >
            <Text style={styles.iconText}>＋</Text>
          </TouchableOpacity>
          {/* Multiline Input */}
          <View style={[
            styles.inputArea,
            isExpanded && styles.inputAreaExpanded
          ]}>
            <TextInput
              value={value}
              onChangeText={onChange}
              placeholder={placeholder}
              placeholderTextColor={colors.placeholder}
              style={[
                styles.input,
                {
                  maxHeight: maxInputHeight,
                },
              ]}
              editable={!streaming && !offline}
              multiline
              onContentSizeChange={handleContentSizeChange}
              maxLength={maxLength}
              autoCorrect
              autoCapitalize="sentences"
              keyboardAppearance={Platform.OS === 'ios' ? 'default' : undefined}
              selectionColor={colors.primary}
              underlineColorAndroid="transparent"
              textAlignVertical={isExpanded ? "top" : "center"}
              accessibilityLabel="Message input"
            />

            {/* Inline meta row under input (counter / status) */}
            <View style={styles.metaRow}>
              {offline ? (
                <Text style={styles.metaOffline}>Offline</Text>
              ) : streaming ? (
                <Text style={styles.metaStreaming}>Streaming…</Text>
              ) : showCounter ? (
                <Text style={styles.metaCounter}>{(value || '').length}/{maxLength}</Text>
              ) : null}
            </View>
          </View>

          {/* Right accessories: Mic + Send/Stop */}
          <View style={[
            styles.actionsRight,
            isExpanded && styles.actionsRightExpanded
          ]}>
            <TouchableOpacity
              onPress={onMicPress}
              style={[styles.iconButton, offline && styles.iconDisabled]}
              disabled={offline}
              accessibilityRole="button"
              accessibilityLabel="Voice input"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.iconText, offline && styles.iconTextDisabled]}>🎤</Text>
            </TouchableOpacity>

            {!streaming ? (
              <TouchableOpacity
                style={[styles.sendButton, (!canSend || offline) && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={!canSend || offline}
                accessibilityRole="button"
                accessibilityLabel={offline ? 'Offline' : 'Send message'}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.stopButton}
                onPress={handleStop}
                accessibilityRole="button"
                accessibilityLabel="Stop streaming"
              >
                <Text style={styles.stopButtonText}>Stop</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
  );
}

function ActionChip({ icon, label, onPress, accessibilityLabel }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.actionChip}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Text style={styles.actionChipIcon}>{icon}</Text>
      <Text style={styles.actionChipText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
  },

  /** Quick actions tray */
  quickActionsContainer: {
    overflow: 'hidden',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  actionChipIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  actionChipText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },

  /** Input Card */
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.inputBackground,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 52,
    // Shadow (iOS) + Elevation (Android)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  inputCardExpanded: {
    paddingVertical: 14,
    alignItems: 'flex-start',
  },
  inputAreaExpanded: {
    justifyContent: 'flex-start',
  },
  actionsRightExpanded: {
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
    paddingBottom: 4,
  },

  /** Left / right icon buttons */
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignSelf: 'flex-end',
  },
  iconText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  iconDisabled: {
    opacity: 0.4,
  },
  iconTextDisabled: {
    color: colors.textMuted,
  },
  /** Input area */
  inputArea: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'stretch',
    alignSelf: 'center',
  },
  input: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.inputText,
    paddingHorizontal: 0,
    paddingVertical: 6,
    borderRadius: 12,
    textAlignVertical: 'center',
    includeFontPadding: false,
    minHeight: 32,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingTop: 2,
    alignItems: 'center',
  },
  metaCounter: {
    fontSize: 11,
    color: colors.textMuted,
  },
  metaStreaming: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  metaOffline: {
    fontSize: 11,
    color: colors.error,
    fontWeight: '600',
  },

  /** Right actions group */
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-end',
  },

  /** Send / Stop buttons */
  sendButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: colors.buttonText,
    fontWeight: '700',
    fontSize: 13,
  },
  stopButton: {
    backgroundColor: colors.error,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  stopButtonText: {
    color: colors.buttonText,
    fontWeight: '700',
    fontSize: 13,
  },
});

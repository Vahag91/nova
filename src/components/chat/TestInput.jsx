// app/src/components/chat/TestInput.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Platform, Keyboard, Image, ScrollView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, Easing } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../styles/colors';

const noop = () => {};

const SendIcon = ({ color, size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M440-160v-487L216-423l-56-57 320-320 320 320-56 57-224-224v487h-80Z"/>
  </Svg>
);
const MicIcon = ({ color, size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M480-400q-50 0-85-35t-35-85v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q0 50-35 85t-85 35Zm0-240Zm-40 520v-123q-104-14-172-93t-68-184h80q0 83 58.5 141.5T480-320q83 0 141.5-58.5T680-520h80q0 105-68 184t-172 93v123h-80Zm40-360q17 0 28.5-11.5T520-520v-240q0-17-11.5-28.5T480-800q-17 0-28.5 11.5T440-760v240q0 17 11.5 28.5T480-480Z"/>
  </Svg>
);
const AddIcon = ({ color, size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"/>
  </Svg>
);
const MinusIcon = ({ color, size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M240-440v-80h480v80H240Z"/>
  </Svg>
);

function formatSecs(s) { const m = Math.floor(s/60), sec = s%60; return `${m}:${String(sec).padStart(2,'0')}`; }

function TestInput({
  value, onChange, onSend, onStop,
  streaming, offline=false,
  placeholder='Message Agarka...',
  onCreateImagesPress=noop, onOpenCameraPress=noop, onSearchPress=noop, onClipboardPress=noop,
  onMicPress=noop, onMicHoldStart=noop, onMicHoldEnd=noop,
  attachments=[], onRemoveAttachment=noop,
  maxLength=4000, minInputHeight=40, maxInputHeight=140,
  forceCollapsed=false, isRecording=false,
}) {
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useSharedValue(0);
  const [inputHeight, setInputHeight] = useState(minInputHeight);
  const [isExpanded, setIsExpanded] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const paddingAnim = useSharedValue(Platform.OS === 'ios' ? 22 : 16);

  // timer during recording
  const [recSecs, setRecSecs] = useState(0);
  useEffect(() => {
    let id;
    if (isRecording) { setRecSecs(0); id = setInterval(() => setRecSecs(s => s+1), 1000); }
    return () => id && clearInterval(id);
  }, [isRecording]);

  // pulsing mic
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (isRecording) pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
    else pulse.value = withTiming(0, { duration: 150 });
  }, [isRecording, pulse]);
  const micWrapStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.08 }], shadowOpacity: 0.25 + pulse.value * 0.25 }));

  // keyboard
  useEffect(() => {
    const s = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const h = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { s?.remove(); h?.remove(); };
  }, []);
  useEffect(() => {
    if (Platform.OS === 'ios') paddingAnim.value = withTiming(keyboardVisible ? 16 : 24, { duration: 250, easing: Easing.out(Easing.quad) });
  }, [keyboardVisible, paddingAnim]);

  useEffect(() => { if (forceCollapsed && expanded) setExpanded(false); }, [forceCollapsed, expanded]);
  useEffect(() => { expandAnim.value = withTiming(expanded ? 1 : 0, { duration: 180, easing: Easing.out(Easing.quad) }); }, [expanded, expandAnim]);

  const canSend = useMemo(() => {
    const hasText = !!(value && value.trim().length > 0);
    const hasImages = attachments?.length > 0;
    return !streaming && !offline && (hasText || hasImages);
  }, [streaming, offline, value, attachments]);

  const showCounter = useMemo(() => value && value.length >= Math.max(0, maxLength - 300), [value, maxLength]);

  const actionsAnimatedStyle = useAnimatedStyle(() => ({ height: expandAnim.value * 56, opacity: expandAnim.value }));
  const paddingAnimatedStyle = useAnimatedStyle(() => ({ paddingBottom: Platform.OS === 'ios' ? paddingAnim.value : 16 }));

  const toggleActions = () => setExpanded(v => !v);
  const handleSend = () => { if (canSend) onSend(); };
  const handleStop = () => { if (streaming && onStop) onStop(); else if (isRecording) onMicPress?.(); };

  const handleContentSizeChange = (e) => {
    const h = e.nativeEvent.contentSize?.height;
    if (!h) return;
    const newH = Math.max(minInputHeight, Math.min(h, maxInputHeight));
    setInputHeight(newH); setIsExpanded(newH > minInputHeight);
  };

  const onMicTap = () => { if (!offline) onMicPress?.(); };

  return (
    <Animated.View style={[styles.wrapper, paddingAnimatedStyle]}>
      <Animated.View style={[styles.quickActionsContainer, actionsAnimatedStyle]} pointerEvents={expanded ? 'auto' : 'none'}>
        <View style={styles.quickActionsRow}>
          <ActionChip label="Create images" icon="🖼️" onPress={onCreateImagesPress} />
          <ActionChip label="Open camera"  icon="📷" onPress={onOpenCameraPress} />
          <ActionChip label="Search"       icon="🔍" onPress={onSearchPress} />
          <ActionChip label="Clipboard"    icon="📋" onPress={onClipboardPress} />
        </View>
      </Animated.View>

      <View style={styles.inputContainer}>
        {attachments?.length > 0 && (
          <ScrollView horizontal style={styles.thumbRow} contentContainerStyle={{ paddingVertical: 2 }} showsHorizontalScrollIndicator={false}>
            {attachments.map((a, idx) => (
              <View key={a.id || `${a.uri}-${idx}`} style={styles.thumbWrap}>
                <Image source={{ uri: a.uri }} style={styles.thumb} />
                <TouchableOpacity onPress={() => onRemoveAttachment(a, idx)} style={styles.thumbRemove} accessibilityLabel="Remove image" hitSlop={{ top:6, bottom:6, left:6, right:6 }}>
                  <Text style={styles.thumbRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.inputArea}>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={isRecording ? 'Listening…' : placeholder}
            placeholderTextColor={colors.placeholder}
            style={[styles.input, { maxHeight: maxInputHeight }]}
            editable={!streaming && !offline && !isRecording}
            multiline
            onContentSizeChange={handleContentSizeChange}
            maxLength={maxLength}
            autoCorrect
            autoCapitalize="sentences"
            keyboardAppearance={Platform.OS === 'ios' ? 'default' : undefined}
            selectionColor={colors.primary}
            underlineColorAndroid="transparent"
            textAlignVertical={isExpanded ? 'top' : 'center'}
            accessibilityLabel="Message input"
            scrollEnabled={inputHeight >= maxInputHeight}
          />
          {value?.length > 0 && (
            <TouchableOpacity onPress={() => onChange('')} accessibilityLabel="Clear input" style={{ position: 'absolute', right: 6, top: 6, padding: 6 }}>
              <Svg height={18} width={18} viewBox="0 -960 960 960" fill="#8E8E93"><Path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></Svg>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.iconsRow}>
          <View style={styles.leftControls}>
            <TouchableOpacity onPress={toggleActions} style={[styles.plusButton, isRecording && styles.disabledBtn]} disabled={isRecording} accessibilityRole="button" accessibilityLabel={expanded ? 'Hide quick actions' : 'Show quick actions'}>
              {expanded ? <MinusIcon color="#FFFFFF" size={18} /> : <AddIcon color="#FFFFFF" size={18} />}
            </TouchableOpacity>
          </View>

          <View style={styles.rightControls}>
            <TouchableOpacity style={[styles.iconButton, (offline || isRecording) && styles.iconDisabled]} onPress={onClipboardPress} disabled={offline || isRecording} accessibilityRole="button" accessibilityLabel="Paste from clipboard">
              <Text style={styles.iconText}>📋</Text>
            </TouchableOpacity>

            <Animated.View style={[styles.micWrap, micWrapStyle]}>
              <TouchableOpacity
                style={[styles.micButton, isRecording && styles.micRecording, offline && styles.iconDisabled]}
                onPress={onMicTap}
                onPressIn={onMicHoldStart}
                onPressOut={onMicHoldEnd}
                disabled={offline}
                accessibilityRole="button"
                accessibilityLabel={isRecording ? 'Stop recording' : 'Start voice input'}
              >
                <MicIcon color={isRecording ? '#FFFFFF' : '#8E8E93'} size={18} />
                {isRecording && <View style={styles.redDot} />}
              </TouchableOpacity>
            </Animated.View>

            {!streaming ? (
              <TouchableOpacity style={[canSend ? styles.sendButtonActive : styles.sendButton, (offline || isRecording) && styles.sendButtonDisabled]} onPress={handleSend} disabled={!canSend || offline || isRecording} accessibilityRole="button" accessibilityLabel={offline ? 'Offline' : 'Send message'}>
                <SendIcon color={canSend && !isRecording ? '#FFFFFF' : '#000000'} size={18} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.stopButton} onPress={handleStop} accessibilityRole="button" accessibilityLabel="Stop">
                <Text style={styles.stopButtonText}>Stop</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.metaRow}>
          {offline ? (
            <Text style={styles.metaOffline}>Offline</Text>
          ) : isRecording ? (
            <Text style={styles.metaRecording}>Listening… {formatSecs(recSecs)}</Text>
          ) : streaming ? (
            <Text style={styles.metaStreaming}>Streaming…</Text>
          ) : showCounter ? (
            <Text style={styles.metaCounter}>{(value || '').length}/{maxLength}</Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

function ActionChip({ icon, label, onPress, accessibilityLabel }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.actionChip} accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} hitSlop={{ top:6, bottom:6, left:6, right:6 }}>
      <Text style={styles.actionChipIcon}>{icon}</Text>
      <Text style={styles.actionChipText}>{label}</Text>
    </TouchableOpacity>
  );
}

const THUMB = 48;

const styles = StyleSheet.create({
  wrapper: { backgroundColor: '#000000', borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 12, paddingTop: 8 },
  quickActionsContainer: { overflow: 'hidden', marginBottom: 8 },
  quickActionsRow: { flexDirection: 'row', paddingHorizontal: 4, gap: 8 },
  actionChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border, gap: 6 },
  actionChipIcon: { fontSize: 16 },
  actionChipText: { fontSize: 12, color: colors.text, fontFamily: 'Lato-Regular' },

  inputContainer: { backgroundColor: '#1C1C1E', padding: 16, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },

  thumbRow: { marginBottom: 8 },
  thumbWrap: { width: THUMB, height: THUMB, borderRadius: 10, marginRight: 6, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  thumb: { width: '100%', height: '100%' },
  thumbRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: '#000000CC', width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  thumbRemoveText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  inputArea: { marginBottom: 8 },
  input: { fontSize: 16, color: colors.text, fontFamily: 'Lato-Regular', paddingHorizontal: 0, paddingVertical: 8, textAlignVertical: 'top', includeFontPadding: false, minHeight: 40 },

  iconsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 0 },
  leftControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rightControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  plusButton: { backgroundColor: '#2C2C2E', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  disabledBtn: { opacity: 0.5 },

  iconButton: { padding: 6 },
  iconDisabled: { opacity: 0.5 },

  micWrap: { borderRadius: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowRadius: 6 },
  micButton: { padding: 6, borderRadius: 18, backgroundColor: '#1F1F1F', borderWidth: 1, borderColor: colors.border, position: 'relative' },
  micRecording: { backgroundColor: '#EA4335', borderColor: '#EA4335' },
  redDot: { position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },

  sendButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendButtonActive: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendButtonDisabled: { backgroundColor: '#FFFFFF', opacity: 0.5 },

  stopButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center' },
  stopButtonText: { fontSize: 12, color: '#FFFFFF', fontFamily: 'Lato-Bold' },

  metaRow: { alignItems: 'flex-end' },
  metaOffline: { fontSize: 11, color: colors.warning, fontFamily: 'Lato-Regular' },
  metaStreaming: { fontSize: 11, color: colors.primary, fontFamily: 'Lato-Regular' },
  metaRecording: { fontSize: 11, color: '#EA4335', fontFamily: 'Lato-Regular' },
  metaCounter: { fontSize: 11, color: colors.textSecondary, fontFamily: 'Lato-Regular' },
});

export default TestInput;

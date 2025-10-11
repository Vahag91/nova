import React, { useMemo, useState, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Platform, Keyboard, Image, ScrollView, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, useDerivedValue, withSpring, Easing } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../styles/colors';
import { useTranslation } from 'react-i18next';

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
const StopIcon = ({ color, size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M320-320h320v-320H320v320ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
  </Svg>
);
const TestIcon = ({ color, size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M320-280q17 0 28.5-11.5T360-320q0-17-11.5-28.5T320-360q-17 0-28.5 11.5T280-320q0 17 11.5 28.5T320-280Zm0-160q17 0 28.5-11.5T360-480q0-17-11.5-28.5T320-520q-17 0-28.5 11.5T280-480q0 17 11.5 28.5T320-440Zm0-160q17 0 28.5-11.5T360-640q0-17-11.5-28.5T320-680q-17 0-28.5 11.5T280-640q0 17 11.5 28.5T320-600Zm160 320q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm0-160q17 0 28.5-11.5T520-480q0-17-11.5-28.5T480-520q-17 0-28.5 11.5T440-480q0 17 11.5 28.5T480-440Zm0-160q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm160 320q17 0 28.5-11.5T680-320q0-17-11.5-28.5T640-360q-17 0-28.5 11.5T600-320q0 17 11.5 28.5T640-280Zm0-160q17 0 28.5-11.5T680-480q0-17-11.5-28.5T640-520q-17 0-28.5 11.5T600-480q0 17 11.5 28.5T640-440Zm0-160q17 0 28.5-11.5T680-640q0-17-11.5-28.5T640-680q-17 0-28.5 11.5T600-640q0 17 11.5 28.5T640-600ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z"/>
  </Svg>
);
const AddIcon = ({ color, size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"/>
  </Svg>
);
const PaletteIcon = ({ color = "#8A2BE2", size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 32.5-156t88-127Q256-817 330-848.5T488-880q80 0 151 27.5t124.5 76q53.5 48.5 85 115T880-518q0 115-70 176.5T640-280h-74q-9 0-12.5 5t-3.5 11q0 12 15 34.5t15 51.5q0 50-27.5 74T480-80Zm0-400Zm-220 40q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm120-160q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm200 0q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm120 160q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17ZM480-160q9 0 14.5-5t5.5-13q0-14-15-33t-15-57q0-42 29-67t71-25h70q66 0 113-38.5T800-518q0-121-92.5-201.5T488-800q-136 0-232 93t-96 227q0 133 93.5 226.5T480-160Z"/>
  </Svg>
);
const CameraIcon = ({ color = "#00BCD4", size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M480-260q75 0 127.5-52.5T660-440q0-75-52.5-127.5T480-620q-75 0-127.5 52.5T300-440q0 75 52.5 127.5T480-260Zm0-80q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29ZM160-120q-33 0-56.5-23.5T80-200v-480q0-33 23.5-56.5T160-760h126l74-80h240l74 80h126q33 0 56.5 23.5T880-680v480q0 33-23.5 56.5T800-120H160Zm0-80h640v-480H638l-73-80H395l-73 80H160v480Zm320-240Z"/>
  </Svg>
);
const ExploreIcon = ({ color = "#FF9800", size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="m300-300 280-80 80-280-280 80-80 280Zm180-120q-25 0-42.5-17.5T420-480q0-25 17.5-42.5T480-540q25 0 42.5 17.5T540-480q0 25-17.5 42.5T480-420Zm0 340q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Zm0-320Z"/>
  </Svg>
);

function TestInput({
  value, onChange, onSend, onStop,
  streaming, offline=false,
  placeholder,
  onCreateImagesPress=noop, onOpenCameraPress=noop, onSearchPress=noop, onClipboardPress=noop,
  onMicPress=noop, onMicHoldStart=noop, onMicHoldEnd=noop,
  navigation,
  attachments=[], onRemoveAttachment=noop,
  maxLength=4000, minInputHeight=40, maxInputHeight=140,
  forceCollapsed=false, isRecording=false,
  webSearchEnabled=false, // NEW: web search toggle state
}) {
  const { t } = useTranslation();
  

  const MENU_ITEM_HEIGHT = 52;
  const MENU_VISIBLE_HEIGHT = MENU_ITEM_HEIGHT * 3 + 2;
  const MENU_EXTRA_OFFSET_Y = 36;
  const MENU_Y_OFFSET = MENU_VISIBLE_HEIGHT + MENU_EXTRA_OFFSET_Y;
  const ANIMATION_DURATION = 300;
  const SPRING_CONFIG = { duration: 1200, overshootClamping: true, dampingRatio: 0.8 };
  const isOpen = useSharedValue(false);
  const webSearchTextVisible = useSharedValue(webSearchEnabled);
  const [renderMenu, setRenderMenu] = useState(false);
  const plusRef = React.useRef(null);
  const wrapperRef = React.useRef(null);
  const [anchor, setAnchor] = useState(null);
  const win = Dimensions.get('window');
  const [wrapperRect, setWrapperRect] = useState({ x: 0, y: 0, width: win.width, height: win.height });
  const [inputHeight, setInputHeight] = useState(minInputHeight);
  const [isExpanded, setIsExpanded] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const paddingAnim = useSharedValue(Platform.OS === 'ios' ? 22 : 16);

  // timer during recording
  const [recSecs, setRecSecs] = useState(0);
  useEffect(() => {
    let id;
    if (isRecording) { 
      setRecSecs(0); 
      id = setInterval(() => setRecSecs(s => s + 1), 1000);
    }
    return () => { if (id) clearInterval(id); };
  }, [isRecording]);

  // keyboard
  useEffect(() => {
    const s = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const h = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { s?.remove(); h?.remove(); };
  }, []);
  // measure wrapper rect
  const measureWrapper = () => wrapperRef.current?.measureInWindow((x, y, w, h) => setWrapperRect({ x, y, width: w, height: h }));
  useEffect(() => {
    measureWrapper();
    const sub = Dimensions.addEventListener?.('change', measureWrapper);
    return () => sub?.remove?.();
  }, []);
  useEffect(() => {
    if (Platform.OS === 'ios') paddingAnim.value = withTiming(keyboardVisible ? 16 : 24, { duration: 250, easing: Easing.out(Easing.quad) });
  }, [keyboardVisible, paddingAnim]);

  useEffect(() => { if (forceCollapsed && isOpen.value) isOpen.value = false; }, [forceCollapsed, isOpen]);
  
  useEffect(() => {
    webSearchTextVisible.value = withTiming(webSearchEnabled ? 1 : 0, { 
      duration: 250, 
      easing: Easing.out(Easing.quad) 
    });
  }, [webSearchEnabled, webSearchTextVisible]);

  const canSend = useMemo(() => {
    const hasText = !!(value && value.trim().length > 0);
    const hasImages = attachments?.length > 0;
    return !streaming && !offline && (hasText || hasImages);
  }, [streaming, offline, value, attachments]);

  const showCounter = useMemo(() => value && value.length >= Math.max(0, maxLength - 300), [value, maxLength]);

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: isOpen.value,
    zIndex: isOpen.value ? 1 : -1,
  }));

  const plusIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: isOpen.value ? '45deg' : '0deg' }],
  }));

  const getMenuItemStyle = (index) => {
    return useAnimatedStyle(() => {
      const scaleValue = isOpen.value ? 1 : 0;
      const translateValue = isOpen.value ? 0 : 20;
      return {
        opacity: scaleValue,
        transform: [
          { translateY: translateValue },
          { scale: scaleValue },
        ],
      };
    });
  };

  const menuItem1Style = getMenuItemStyle(0);
  const menuItem2Style = getMenuItemStyle(1);
  const menuItem3Style = getMenuItemStyle(2);

  const popoverAnimatedStyle = useAnimatedStyle(() => ({
    opacity: isOpen.value ? withTiming(1, { duration: ANIMATION_DURATION }) : withTiming(0, { duration: ANIMATION_DURATION }),
  }));
  const paddingAnimatedStyle = useAnimatedStyle(() => ({ paddingBottom: Platform.OS === 'ios' ? paddingAnim.value : 16 }));
  
  const webSearchTextAnimatedStyle = useAnimatedStyle(() => ({
    opacity: webSearchTextVisible.value,
    transform: [
      { scaleX: webSearchTextVisible.value },
      { translateX: webSearchTextVisible.value === 1 ? 0 : -10 }
    ],
  }));

  const measureAnchor = () => {
    if (plusRef.current?.measureInWindow) {
      plusRef.current.measureInWindow((x, y, w, h) => setAnchor({ x, y, width: w, height: h }));
    }
  };

  const toggleActions = () => {
    if (isOpen.value) {
      isOpen.value = false;
      setTimeout(() => setRenderMenu(false), ANIMATION_DURATION);
    } else {
      requestAnimationFrame(() => {
        measureAnchor();
        setRenderMenu(true);
        setTimeout(() => { isOpen.value = true; }, 50);
      });
    }
  };
  const handleSend = () => { if (canSend) onSend(); };
  const handleStop = () => { 
    if (streaming && onStop) onStop(); 
    else if (isRecording) onMicPress?.(); 
  };
  const handleContentSizeChange = (e) => {
    const h = e.nativeEvent.contentSize?.height;
    if (!h) return;
    const newH = Math.max(minInputHeight, Math.min(h, maxInputHeight));
    setInputHeight(newH); setIsExpanded(newH > minInputHeight);
  };
  const onMicTap = () => { if (!offline) onMicPress?.(); };

  return (
    <Animated.View ref={wrapperRef} onLayout={measureWrapper} style={[styles.wrapper, paddingAnimatedStyle]}>
      {renderMenu && (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropAnimatedStyle]}>
            <TouchableOpacity 
              activeOpacity={1} 
              onPress={toggleActions} 
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {anchor && (() => {
            const menuWidth = wrapperRect.width ;
            const halfMenuWidth = menuWidth / 2;
            return (
              <Animated.View pointerEvents="box-none" style={[styles.popoverContainer, popoverAnimatedStyle, {
                bottom: (MENU_ITEM_HEIGHT * 3 + 2) + 36 - 64,
                left: Math.max(8, Math.min(anchor.x - wrapperRect.x + anchor.width / 2 - halfMenuWidth, wrapperRect.width - menuWidth - 8)),
                width: menuWidth,
              }]}>
                <View style={styles.menuBox}>
                  <Animated.View style={menuItem1Style}>
                    <TouchableOpacity 
                      style={styles.menuItem} 
                      onPress={() => { toggleActions(); onCreateImagesPress?.(); }} 
                      accessibilityRole="button" 
                      accessibilityLabel={'Create images'}
                      activeOpacity={0.9}
                    >
                      <View style={[styles.menuIconContainer, styles.iconViolet]}>
                        <PaletteIcon color="#8A2BE2" size={28} />
                      </View>
                      <View style={styles.menuTextContainer}>
                        <Text style={styles.menuLabel} numberOfLines={1}>Create images</Text>
                        <Text style={styles.menuSubLabel} numberOfLines={1}>Generate AI artwork</Text>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                  
                  <Animated.View style={menuItem2Style}>
                    <TouchableOpacity 
                      style={styles.menuItem} 
                      onPress={() => { toggleActions(); onOpenCameraPress?.(); }} 
                      accessibilityRole="button" 
                      accessibilityLabel={'Camera'}
                      activeOpacity={0.9}
                    >
                      <View style={[styles.menuIconContainer, styles.iconCyan]}>
                        <CameraIcon color="#00BCD4" size={28} />
                      </View>
                      <View style={styles.menuTextContainer}>
                        <Text style={styles.menuLabel} numberOfLines={1}>Camera</Text>
                        <Text style={styles.menuSubLabel} numberOfLines={1}>Take or select photos</Text>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                  
                  <Animated.View style={menuItem3Style}>
                    <TouchableOpacity 
                      style={[styles.menuItem, styles.menuItemLast]} 
                      onPress={() => { toggleActions(); onSearchPress?.(); }} 
                      accessibilityRole="button" 
                      accessibilityLabel={'Search the web'}
                      activeOpacity={0.9}
                    >
                      <View style={[styles.menuIconContainer, styles.iconOrange]}>
                        <ExploreIcon color="#FF9800" size={28} />
                      </View>
                      <View style={styles.menuTextContainer}>
                        <Text style={styles.menuLabel} numberOfLines={1}>Web search</Text>
                        <Text style={styles.menuSubLabel} numberOfLines={1}>Find recent info</Text>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              </Animated.View>
            );
          })()}
        </>
      )}

      <View style={styles.inputContainer}>
        {attachments?.length > 0 && (
          <ScrollView horizontal style={styles.thumbRow} contentContainerStyle={{ paddingVertical: 2 }} showsHorizontalScrollIndicator={false}>
            {attachments.map((a, idx) => (
              <View key={a.id || `${a.uri}-${idx}`} style={styles.thumbWrap}>
                <Image source={{ uri: a.uri }} style={styles.thumb} />
                <TouchableOpacity onPress={() => onRemoveAttachment(a, idx)} style={styles.thumbRemove} accessibilityLabel={'Remove image'} hitSlop={{ top:6, bottom:6, left:6, right:6 }}>
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
            placeholder={'Message'}
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
            accessibilityLabel={'Message input'}
            scrollEnabled={inputHeight >= maxInputHeight}
          />
          {value?.length > 0 && (
            <TouchableOpacity onPress={() => onChange('')} accessibilityLabel={'Clear input'} style={{ position: 'absolute', right: 6, top: 6, padding: 6 }}>
              <Svg height={18} width={18} viewBox="0 -960 960 960" fill="#8E8E93"><Path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></Svg>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.iconsRow}>
          <View style={styles.leftControls}>
            <TouchableOpacity ref={plusRef} onPress={toggleActions} style={[styles.plusButton, isRecording && styles.disabledBtn]} disabled={isRecording} accessibilityRole="button" accessibilityLabel={'Quick actions'}>
              <Animated.View style={plusIconStyle}>
                <AddIcon color="#FFFFFF" size={18} />
              </Animated.View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.webSearchToggle, offline && styles.iconDisabled]}
              onPress={() => { if (!offline) onSearchPress?.(); }}
              disabled={offline}
              accessibilityRole="button"
              accessibilityLabel={webSearchEnabled ? 'Disable web search' : 'Enable web search'}
            >
              <ExploreIcon 
                color={webSearchEnabled ? "#007AFF" : "#FFFFFF"} 
                size={18} 
              />
              {webSearchEnabled && (
                <Animated.View style={webSearchTextAnimatedStyle}>
                  <Text style={styles.webSearchText}>Web Search</Text>
                </Animated.View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.rightControls}>
            {/* Test Paywall Button */}
            {navigation && (
              <TouchableOpacity
                style={[styles.testButton, offline && styles.iconDisabled]}
                onPress={() => navigation.navigate('PaywallScreen')}
                disabled={offline}
                accessibilityRole="button"
                accessibilityLabel={'Test Paywall'}
              >
                <TestIcon color="#FF6B6B" size={16} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.micButton, offline && styles.iconDisabled]}
              onPress={() => { if (!offline) onMicPress?.(); }}
              onLongPress={() => { if (!offline) onMicPress?.(); }}
              onPressIn={onMicHoldStart}
              onPressOut={onMicHoldEnd}
              disabled={offline}
              accessibilityRole="button"
              accessibilityLabel={'Start voice input'}
              delayLongPress={500}
            >
              <MicIcon color="#FFFFFF" size={18} />
            </TouchableOpacity>

            {!streaming ? (
              <TouchableOpacity style={[canSend ? styles.sendButtonActive : styles.sendButton, (offline || isRecording) && styles.sendButtonDisabled]} onPress={handleSend} disabled={!canSend || offline || isRecording} accessibilityRole="button" accessibilityLabel={offline ? 'Offline' : 'Send message'}>
                <SendIcon color={canSend && !isRecording ? '#FFFFFF' : '#000000'} size={18} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.stopButton} onPress={handleStop} accessibilityRole="button" accessibilityLabel={'Stop'}>
                <StopIcon color="#FFFFFF" size={22} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.metaRow}>
          {offline ? (
            <Text style={styles.metaOffline}>Offline</Text>
          ) : showCounter && !streaming ? (
            <Text style={styles.metaCounter}>{(value || '').length}/{maxLength}</Text>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const THUMB = 48;

const styles = StyleSheet.create({
  wrapper: { backgroundColor: '#000000', paddingHorizontal: 12, paddingTop: 8, position: 'relative' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.2)', zIndex: 998 },
  popoverContainer: { position: 'absolute', zIndex: 1000, elevation: 50, padding: 12 },
  menuBox: { 
    backgroundColor: 'rgba(10, 9, 9, 0.75)',
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000', 
    shadowOpacity: 0.8, 
    shadowRadius: 30, 
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
    padding: 10
  },
  menuItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 7,
    backgroundColor: 'transparent',
    borderRadius: 18,
    marginBottom: 4
  },
  menuItemLast: { marginBottom: 0 },
  menuIconContainer: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: 20 },
  iconViolet: {},
  iconCyan: {},
  iconOrange: {},
  menuTextContainer: { flex: 1 },
  menuLabel: { color: '#E0E0E0', fontSize: 17, fontWeight: '600', fontFamily: 'Lato-BoldItalic', marginBottom: 3 },
  menuSubLabel: { color: '#A0A0A0', fontSize: 14, fontFamily: 'Lato-Regular' },

  inputContainer: { backgroundColor: '#1C1C1E',
    //  padding: 16,
     paddingVertical:12,
     paddingHorizontal:16,
      borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },

  thumbRow: { marginBottom: 8 },
  thumbWrap: { width: THUMB, height: THUMB, borderRadius: 10, marginRight: 6, borderWidth: 1, borderColor: colors.border },
  thumb: { width: '100%', height: '100%', borderRadius: 9 },
  thumbRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: '#000000CC', width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  thumbRemoveText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  inputArea: { marginBottom: 8 },
  input: { fontSize: 16, color: colors.text, fontFamily: 'Lato-Regular', paddingHorizontal: 0, paddingVertical: 8, textAlignVertical: 'top', includeFontPadding: false, minHeight: 40 },

  iconsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 0 },
  leftControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rightControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  plusButton: { backgroundColor: '#2C2C2E', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  webSearchToggle: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#2C2C2E', 
    minWidth: 32,
    height: 32,
    paddingHorizontal: 8, 
    borderRadius: 16, 
    marginLeft: 4,
    justifyContent: 'center'
  },
  webSearchText: { 
    color: '#007AFF', 
    fontSize: 12, 
    fontFamily: 'Lato-Regular', 
    marginLeft: 6 
  },
  disabledBtn: { opacity: 0.5 },

  iconButton: { padding: 6 },
  iconDisabled: { opacity: 0.5 },

  micButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1F1F1F', borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  testButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1F1F1F', borderWidth: 1, borderColor: '#FF6B6B', justifyContent: 'center', alignItems: 'center', marginRight: 4 },

  sendButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendButtonActive: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendButtonDisabled: { backgroundColor: '#FFFFFF', opacity: 0.5 },

  stopButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },

  metaRow: { alignItems: 'flex-end' },
  metaOffline: { fontSize: 11, color: colors.warning, fontFamily: 'Lato-Regular' },
  metaStreaming: { fontSize: 11, color: colors.primary, fontFamily: 'Lato-Regular' },
  metaRecording: { fontSize: 11, color: '#EA4335', fontFamily: 'Lato-Regular' },
  metaCounter: { fontSize: 11, color: colors.textSecondary, fontFamily: 'Lato-Regular' },
});

export default TestInput;

import { IMAGE_STUDIO_ENABLED } from '../../constants/featureFlags';
import SvgIcon from '../SvgIcon';
import { useWorkspaceTranslation } from '../../i18n/useWorkspaceTranslation';
import React, { useMemo, useState, useEffect, useCallback, memo, useRef, useContext } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Image, ScrollView, Modal, Dimensions, Keyboard, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, interpolate, Extrapolation } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
// --- NEW IMPORT ---
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../styles/colors';
import { useTranslation } from 'react-i18next';
import { SubscriptionAccessContext } from '../../context/SubscriptionContext';
import { setPendingPremiumAction } from '../../state/premiumActions';
import { resolvePremiumStatus } from '../../lib/resolvePremiumStatus';
import { perfCancel, perfEnd, perfLog, perfStart } from '../../lib/perfTrace';
import {
  formatFileSize,
  isAttachmentReady,
  isDocumentAttachment,
  isImageAttachment,
} from '../../lib/documentAttachments';

const noop = () => { };

const SendIcon = ({ color, size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M440-160v-487L216-423l-56-57 320-320 320 320-56 57-224-224v487h-80Z" />
  </Svg>
);
const MicIcon = ({ color, size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M480-400q-50 0-85-35t-35-85v-240q0-50 35-85t85-35q50 0 85 35t35 85v240q0 50-35 85t-85 35Zm0-240Zm-40 520v-123q-104-14-172-93t-68-184h80q0 83 58.5 141.5T480-320q83 0 141.5-58.5T680-520h80q0 105-68 184t-172 93v123h-80Zm40-360q17 0 28.5-11.5T520-520v-240q0-17-11.5-28.5T480-800q-17 0-28.5 11.5T440-760v240q0 17 11.5 28.5T480-480Z" />
  </Svg>
);
const StopIcon = ({ color, size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M320-320h320v-320H320v320Z" />
  </Svg>
);
const TestIcon = ({ color, size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M320-280q17 0 28.5-11.5T360-320q0-17-11.5-28.5T320-360q-17 0-28.5 11.5T280-320q0 17 11.5 28.5T320-280Zm0-160q17 0 28.5-11.5T360-480q0-17-11.5-28.5T320-520q-17 0-28.5 11.5T280-480q0 17 11.5 28.5T320-440Zm0-160q17 0 28.5-11.5T360-640q0-17-11.5-28.5T320-680q-17 0-28.5 11.5T280-640q0 17 11.5 28.5T320-600Zm160 320q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm0-160q17 0 28.5-11.5T520-480q0-17-11.5-28.5T480-520q-17 0-28.5 11.5T440-480q0 17 11.5 28.5T480-440Zm0-160q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm160 320q17 0 28.5-11.5T680-320q0-17-11.5-28.5T640-360q-17 0-28.5 11.5T600-320q0 17 11.5 28.5T640-280Zm0-160q17 0 28.5-11.5T680-480q0-17-11.5-28.5T640-520q-17 0-28.5 11.5T600-480q0 17 11.5 28.5T640-440Zm0-160q17 0 28.5-11.5T680-640q0-17-11.5-28.5T640-680q-17 0-28.5 11.5T600-640q0 17 11.5 28.5T640-600ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z" />
  </Svg>
);
const AddIcon = ({ color, size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" />
  </Svg>
);
const PaletteIcon = ({ color = "#8A2BE2", size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M480-80q-82 0-155-31.5t-127.5-86Q143-252 111.5-325T80-480q0-83 32.5-156t88-127Q256-817 330-848.5T488-880q80 0 151 27.5t124.5 76q53.5 48.5 85 115T880-518q0 115-70 176.5T640-280h-74q-9 0-12.5 5t-3.5 11q0 12 15 34.5t15 51.5q0 50-27.5 74T480-80Zm0-400Zm-220 40q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm120-160q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm200 0q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17Zm120 160q26 0 43-17t17-43q0-26-17-43t-43-17q-26 0-43 17t-17 43q0 26 17 43t43 17ZM480-160q9 0 14.5-5t5.5-13q0-14-15-33t-15-57q0-42 29-67t71-25h70q66 0 113-38.5T800-518q0-121-92.5-201.5T488-800q-136 0-232 93t-96 227q0 133 93.5 226.5T480-160Z" />
  </Svg>
);
const CameraIcon = ({ color = "#00BCD4", size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M480-260q75 0 127.5-52.5T660-440q0-75-52.5-127.5T480-620q-75 0-127.5 52.5T300-440q0 75 52.5 127.5T480-260Zm0-80q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29ZM160-120q-33 0-56.5-23.5T80-200v-480q0-33 23.5-56.5T160-760h126l74-80h240l74 80h126q33 0 56.5 23.5T880-680v480q0 33-23.5 56.5T800-120H160Zm0-80h640v-480H638l-73-80H395l-73 80H160v480Zm320-240Z" />
  </Svg>
);
const FileIcon = ({ color = "#5AC8FA", size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h280l240 240v480q0 33-23.5 56.5T680-80H240Zm240-520h200L480-800v200ZM240-160h440v-360H400v-280H240v640Zm80-120h280v-80H320v80Zm0-160h280v-80H320v80Z" />
  </Svg>
);
const ExploreIcon = ({ color = "#FF9800", size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="m300-300 280-80 80-280-280 80-80 280Zm180-120q-25 0-42.5-17.5T420-480q0-25 17.5-42.5T480-540q25 0 42.5 17.5T540-480q0 25-17.5 42.5T480-420Zm0 340q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Zm0-320Z" />
  </Svg>
);

function TestInput({
  value, onChange, onSend, onStop,
  streaming, offline = false,
  placeholder,
  onCreateImagesPress = noop, onOpenCameraPress = noop, onOpenFilePress = noop, onSearchPress = noop, onClipboardPress = noop,
  onMicPress = noop, onMicHoldStart = noop, onMicHoldEnd = noop,
  navigation,
  attachments = [], onRemoveAttachment = noop, onRetryAttachment = noop,
  maxLength = 4000, counterLimit = maxLength, minInputHeight = 40, maxInputHeight = 140,
  forceCollapsed = false, isRecording = false,
  webSearchEnabled = false,
  imagePickerActive = false,
  documentPickerActive = false,
  onOpenVideoPress = noop, videoEnabled = false, videoPickerActive = false,
}) {
  const { t } = useTranslation();
  const { c } = useWorkspaceTranslation();
  const subscription = useContext(SubscriptionAccessContext);
  
  // Safe area for bottom padding (home bar)
  const insets = useSafeAreaInsets();
  
  const handleWebSearchPress = useCallback(async () => {
    if (await resolvePremiumStatus(subscription)) {
      onSearchPress();
      return;
    }
    setPendingPremiumAction(() => {
      try {
        onSearchPress();
      } catch (error) {
      }
    });
    try {
      navigation?.navigate('PaywallScreen', { returnTo: 'Chat' });
    } catch (error) {
    }
  }, [navigation, onSearchPress, subscription]);

  const handleDocumentPress = useCallback(async () => {
    if (await resolvePremiumStatus(subscription)) {
      onOpenFilePress();
      return;
    }
    setPendingPremiumAction(() => {
      try {
        onOpenFilePress();
      } catch {}
    });
    try {
      navigation?.navigate('PaywallScreen', { returnTo: 'Chat' });
    } catch {}
  }, [navigation, onOpenFilePress, subscription]);

  const safe = useCallback((fn, ...args) => {
    if (typeof fn !== 'function') return;
    try { fn(...args); } catch {}
  }, []);

  const MENU_ITEM_HEIGHT = 52;
  const OPEN_DURATION_MS = 220;
  const CLOSE_DURATION_MS = 180;
  const isOpen = useSharedValue(0);
  const webSearchTextVisible = useSharedValue(webSearchEnabled);
  const [renderMenu, setRenderMenu] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOpenRef = useRef(false);
  const closeTimeoutRef = useRef(null);
  const openFallbackTimeoutRef = useRef(null);
  const openAfterKeyboardHideTimeoutRef = useRef(null);
  const plusRef = useRef(null);
  const inputRef = useRef(null);
  const inputFocusedRef = useRef(false);
  const keyboardVisibleRef = useRef(false);
  const pendingOpenAfterKeyboardHideRef = useRef(false);
  const openedFromKeyboardRef = useRef(false);
  const refocusAfterCloseRef = useRef(false);
  const [anchor, setAnchor] = useState(null);
  // Android can report a new window height while the IME animates. Subscribing
  // the entire input tree with a live dimension hook makes every icon/menu node
  // render during that animation. Menu geometry only needs live dimensions
  // while the menu exists.
  const [menuViewport, setMenuViewport] = useState(() => Dimensions.get('window'));
  const [inputHeight, setInputHeight] = useState(minInputHeight);
  const [isExpanded, setIsExpanded] = useState(false);
  const lastLoggedInputHeightRef = useRef(minInputHeight);

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

  useEffect(() => {
    perfLog('chat.input.mounted', {
      maxLength,
      minInputHeight,
      maxInputHeight,
    });
    return () => {
      perfLog('chat.input.unmounted');
    };
  }, [maxInputHeight, maxLength, minInputHeight]);

  useEffect(() => {
    webSearchTextVisible.value = withTiming(webSearchEnabled ? 1 : 0, {
      duration: 250,
      easing: Easing.out(Easing.quad)
    });
  }, [webSearchEnabled, webSearchTextVisible]);

  const imageAttachments = useMemo(
    () => (Array.isArray(attachments) ? attachments.filter(isImageAttachment) : []),
    [attachments],
  );
  const documentAttachments = useMemo(
    () => (Array.isArray(attachments) ? attachments.filter(a => isDocumentAttachment(a) || a.kind === 'video') : []),
    [attachments],
  );
  const attachmentsReady = useMemo(
    () => (Array.isArray(attachments) ? attachments.every(isAttachmentReady) : true),
    [attachments],
  );

  const canSend = useMemo(() => {
    const hasText = !!(value && value.trim().length > 0);
    const hasAttachments = attachments?.length > 0;
    return !streaming && !offline && attachmentsReady && (hasText || hasAttachments);
  }, [streaming, offline, value, attachments, attachmentsReady]);

  const useLatoForInput = useMemo(() => {
    const text = value ?? '';
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) > 0x7f) return false;
    }
    return true;
  }, [value]);

  const showCounter = useMemo(
    () => value && value.length >= Math.max(0, counterLimit - 300),
    [counterLimit, value],
  );

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: isOpen.value,
  }));

  const plusIconStyle = useAnimatedStyle(() => {
    const deg = interpolate(isOpen.value, [0, 1], [0, 45], Extrapolation.CLAMP);
    return { transform: [{ rotate: `${deg}deg` }] };
  });

  const useMenuItemStyle = index =>
    useAnimatedStyle(() => {
      const start = index * 0.08;
      const t = Math.min(1, Math.max(0, (isOpen.value - start) / (1 - start)));
      const translateValue = (1 - t) * 12;
      return {
        opacity: t,
        transform: [
          { translateY: translateValue },
          { scale: 0.98 + 0.02 * t },
        ],
      };
    });

  const menuItem1Style = useMenuItemStyle(0);
  const menuItem2Style = useMenuItemStyle(1);
  const menuItem3Style = useMenuItemStyle(2);
  const menuItem4Style = useMenuItemStyle(3);

  const popoverAnimatedStyle = useAnimatedStyle(() => ({
    opacity: isOpen.value,
    transform: [
      { translateY: (1 - isOpen.value) * 6 },
      { scale: 0.98 + 0.02 * isOpen.value },
    ],
  }));

  const webSearchTextAnimatedStyle = useAnimatedStyle(() => ({
    opacity: webSearchTextVisible.value,
    transform: [
      { scaleX: webSearchTextVisible.value },
      { translateX: webSearchTextVisible.value === 1 ? 0 : -10 }
    ],
  }));

  const measureAnchor = useCallback((cb) => {
    const plus = plusRef.current;
    if (!plus || typeof plus.measureInWindow !== 'function') return;
    plus.measureInWindow((x, y, w, h) => {
      const next = { x, y, width: w, height: h };
      setAnchor(next);
      if (typeof cb === 'function') cb(next);
    });
  }, []);

  const clearMenuTimers = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (openFallbackTimeoutRef.current) {
      clearTimeout(openFallbackTimeoutRef.current);
      openFallbackTimeoutRef.current = null;
    }
    if (openAfterKeyboardHideTimeoutRef.current) {
      clearTimeout(openAfterKeyboardHideTimeoutRef.current);
      openAfterKeyboardHideTimeoutRef.current = null;
    }
  }, []);

  const closeActionsImmediately = useCallback(() => {
    clearMenuTimers();
    pendingOpenAfterKeyboardHideRef.current = false;
    refocusAfterCloseRef.current = false;
    openedFromKeyboardRef.current = false;
    menuOpenRef.current = false;
    isOpen.value = 0;
    setMenuOpen(false);
    setRenderMenu(false);
    setAnchor(null);
    perfCancel('chat.input.menu.open', { mode: 'immediate-close' });
    perfCancel('chat.input.menu.close', { mode: 'immediate-close' });
  }, [clearMenuTimers, isOpen]);

  const closeActions = useCallback(() => {
    perfStart('chat.input.menu.close', {
      openedFromKeyboard: openedFromKeyboardRef.current,
    });
    clearMenuTimers();
    pendingOpenAfterKeyboardHideRef.current = false;
    menuOpenRef.current = false;
    isOpen.value = withTiming(0, {
      duration: CLOSE_DURATION_MS,
      easing: Easing.out(Easing.quad),
    });
    closeTimeoutRef.current = setTimeout(() => {
      setMenuOpen(false);
      setRenderMenu(false);
      setAnchor(null);
      closeTimeoutRef.current = null;

      const shouldRefocus = refocusAfterCloseRef.current;
      refocusAfterCloseRef.current = false;
      openedFromKeyboardRef.current = false;
      if (shouldRefocus) {
        requestAnimationFrame(() => inputRef.current?.focus?.());
      }
      perfEnd('chat.input.menu.close', {
        refocused: shouldRefocus,
      });
    }, CLOSE_DURATION_MS);
  }, [CLOSE_DURATION_MS, clearMenuTimers, isOpen]);

  const openMenuNow = useCallback(() => {
    if (menuOpenRef.current) return;
    clearMenuTimers();
    setMenuViewport(Dimensions.get('window'));
    menuOpenRef.current = true;
    setMenuOpen(true);
    setRenderMenu(true);
    isOpen.value = 0;
    isOpen.value = withTiming(1, {
      duration: OPEN_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
    requestAnimationFrame(() => {
      measureAnchor();
      requestAnimationFrame(() => {
        if (menuOpenRef.current) measureAnchor();
      });
    });
    openFallbackTimeoutRef.current = setTimeout(() => {
      if (menuOpenRef.current) measureAnchor();
      openFallbackTimeoutRef.current = null;
    }, 250);
    perfEnd('chat.input.menu.open', {
      viaKeyboardDismiss: openedFromKeyboardRef.current,
    });
  }, [OPEN_DURATION_MS, clearMenuTimers, isOpen, measureAnchor]);

  const openActions = useCallback(() => {
    if (menuOpenRef.current) return;
    perfStart('chat.input.menu.open', {
      keyboardVisible: keyboardVisibleRef.current,
      inputFocused: inputFocusedRef.current,
    });
    clearMenuTimers();

    const shouldDismissKeyboard = !!(inputFocusedRef.current || keyboardVisibleRef.current);
    openedFromKeyboardRef.current = shouldDismissKeyboard;

    if (shouldDismissKeyboard) {
      perfLog('chat.input.menu.waiting_for_keyboard_hide');
      pendingOpenAfterKeyboardHideRef.current = true;
      inputRef.current?.blur?.();
      Keyboard.dismiss();
      openAfterKeyboardHideTimeoutRef.current = setTimeout(() => {
        if (!pendingOpenAfterKeyboardHideRef.current) return;
        pendingOpenAfterKeyboardHideRef.current = false;
        openAfterKeyboardHideTimeoutRef.current = null;
        openMenuNow();
      }, 350);
      return;
    }

    openMenuNow();
  }, [clearMenuTimers, openMenuNow]);

  const toggleActions = useCallback(() => {
    if (menuOpenRef.current) {
      refocusAfterCloseRef.current = openedFromKeyboardRef.current;
      closeActions();
      return;
    }

    if (pendingOpenAfterKeyboardHideRef.current) {
      pendingOpenAfterKeyboardHideRef.current = false;
      clearMenuTimers();
      requestAnimationFrame(() => inputRef.current?.focus?.());
      return;
    }

    openActions();
  }, [clearMenuTimers, closeActions, openActions]);

  useEffect(() => {
    if (!menuOpen) return;
    requestAnimationFrame(measureAnchor);
  }, [menuOpen, measureAnchor, menuViewport.height, menuViewport.width]);

  useEffect(() => {
    if (!renderMenu) return undefined;
    const dimensionSubscription = Dimensions.addEventListener('change', ({ window }) => {
      if (menuOpenRef.current && window) setMenuViewport(window);
    });
    return () => dimensionSubscription?.remove?.();
  }, [renderMenu]);

  useEffect(() => {
    return () => clearMenuTimers();
  }, [clearMenuTimers]);

  useEffect(() => {
    const showEvent = 'keyboardDidShow';
    const hideEvent = 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      keyboardVisibleRef.current = true;
      perfLog('chat.input.keyboard.show');
      if (menuOpenRef.current) closeActionsImmediately();
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardVisibleRef.current = false;
      perfLog('chat.input.keyboard.hide', {
        pendingMenuOpen: pendingOpenAfterKeyboardHideRef.current,
      });
      if (!pendingOpenAfterKeyboardHideRef.current) return;
      pendingOpenAfterKeyboardHideRef.current = false;
      clearMenuTimers();
      openMenuNow();
    });

    return () => {
      showSub?.remove?.();
      hideSub?.remove?.();
    };
  }, [clearMenuTimers, closeActionsImmediately, openMenuNow]);

  const handleCameraActionPress = useCallback(() => {
    if (imagePickerActive) return;
    closeActionsImmediately();
    requestAnimationFrame(() => safe(onOpenCameraPress));
  }, [closeActionsImmediately, imagePickerActive, onOpenCameraPress, safe]);

  const handleCreateImagesActionPress = useCallback(() => {
    closeActionsImmediately();
    requestAnimationFrame(() => safe(onCreateImagesPress));
  }, [closeActionsImmediately, onCreateImagesPress, safe]);

  const handleWebSearchActionPress = useCallback(() => {
    closeActionsImmediately();
    requestAnimationFrame(() => safe(handleWebSearchPress));
  }, [closeActionsImmediately, handleWebSearchPress, safe]);

  const handleDocumentActionPress = useCallback(() => {
    if (documentPickerActive) return;
    closeActionsImmediately();
    requestAnimationFrame(() => safe(handleDocumentPress));
  }, [closeActionsImmediately, documentPickerActive, handleDocumentPress, safe]);

  useEffect(() => {
    if (forceCollapsed && menuOpenRef.current) {
      closeActionsImmediately();
    }
  }, [forceCollapsed, closeActionsImmediately]);

  const handleSend = () => { if (canSend) safe(onSend); };
  const handleStop = () => {
    perfLog('chat.input.stop_pressed', {
      streaming,
      isRecording,
    });
    if (streaming && onStop) safe(onStop);
    else if (isRecording) safe(onMicPress);
  };
  const handleContentSizeChange = (e) => {
    const h = e.nativeEvent.contentSize?.height;
    if (!h) return;
    const newH = Math.max(minInputHeight, Math.min(h, maxInputHeight));
    if (newH !== lastLoggedInputHeightRef.current) {
      lastLoggedInputHeightRef.current = newH;
      perfLog('chat.input.height_changed', {
        height: newH,
      });
    }
    setInputHeight(newH); setIsExpanded(newH > minInputHeight);
  };

  return (
    <View
      onLayout={() => { if (menuOpenRef.current) measureAnchor(); }}
      style={[styles.wrapper, { paddingBottom: Math.max(8, insets.bottom) }]}
    >
      {renderMenu && (
        <Modal
          transparent
          visible
          statusBarTranslucent
          onRequestClose={() => safe(closeActions)}
        >
          <View style={styles.modalRoot}>
            <Animated.View
              pointerEvents={menuOpen ? 'auto' : 'none'}
              style={[StyleSheet.absoluteFill, styles.backdrop, backdropAnimatedStyle]}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => safe(closeActions)}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

            {anchor && (() => {
              const menuWidth = Math.min(menuViewport.width - 16, 360);
              const halfMenuWidth = menuWidth / 2;
              const fallbackBottom = (MENU_ITEM_HEIGHT * 4 + 2) + 36 - 64;
              const gap = 12;
              const hasAnchorY = typeof anchor.y === 'number' && Number.isFinite(anchor.y) && anchor.y > 0 && anchor.y < menuViewport.height;
              const bottomOffset = hasAnchorY ? Math.max(8, menuViewport.height - anchor.y + gap) : fallbackBottom;
              return (
                <Animated.View
                  pointerEvents={menuOpen ? 'box-none' : 'none'}
                  style={[styles.popoverContainer, popoverAnimatedStyle, {
                  bottom: bottomOffset,
                  left: Math.max(8, Math.min(anchor.x + anchor.width / 2 - halfMenuWidth, menuViewport.width - menuWidth - 8)),
                  width: menuWidth,
                }]}>
                  <View style={styles.menuBox}>
                    {IMAGE_STUDIO_ENABLED ? (
                    <Animated.View style={menuItem1Style}>
                      <TouchableOpacity
                        style={styles.menuItem}
                        onPress={handleCreateImagesActionPress}
                        accessibilityRole="button"
                        accessibilityLabel={t('chat.createImages')}
                        activeOpacity={0.9}
                      >
                        <View style={[styles.menuIconContainer, styles.iconViolet]}>
                          <PaletteIcon color="#8A2BE2" size={28} />
                        </View>
                        <View style={styles.menuTextContainer}>
                          <Text style={styles.menuLabel} numberOfLines={1}>{t('chat.createImages')}</Text>
                          <Text style={styles.menuSubLabel} numberOfLines={1}>{t('chat.generateAiArtwork')}</Text>
                        </View>
                      </TouchableOpacity>
                    </Animated.View>
                    ) : null}

                    <Animated.View style={menuItem2Style}>
                      <TouchableOpacity
                        style={[styles.menuItem, imagePickerActive && styles.disabledBtn]}
                        onPress={handleCameraActionPress}
                        disabled={imagePickerActive}
                        accessibilityRole="button"
                        accessibilityLabel={t('chat.camera')}
                        activeOpacity={0.9}
                      >
                        <View style={[styles.menuIconContainer, styles.iconCyan]}>
                          <CameraIcon color="#00BCD4" size={28} />
                        </View>
                        <View style={styles.menuTextContainer}>
                          <Text style={styles.menuLabel} numberOfLines={1}>{t('chat.camera')}</Text>
                          <Text style={styles.menuSubLabel} numberOfLines={1}>{t('chat.takeOrSelectPhotos')}</Text>
                        </View>
                      </TouchableOpacity>
                    </Animated.View>

                    <Animated.View style={menuItem3Style}>
                      <TouchableOpacity
                        style={[styles.menuItem, documentPickerActive && styles.disabledBtn]}
                        onPress={handleDocumentActionPress}
                        disabled={documentPickerActive}
                        accessibilityRole="button"
                        accessibilityLabel={t('chat.files.upload', { defaultValue: 'Upload file' })}
                        activeOpacity={0.9}
                      >
                        <View style={[styles.menuIconContainer, styles.iconBlue]}>
                          <FileIcon color="#5AC8FA" size={28} />
                        </View>
                        <View style={styles.menuTextContainer}>
                          <Text style={styles.menuLabel} numberOfLines={1}>
                            {t('chat.files.upload', { defaultValue: 'Upload file' })}
                          </Text>
                          <Text style={styles.menuSubLabel} numberOfLines={1}>
                            {t('chat.files.supportedTypes', { defaultValue: 'PDF, DOCX, TXT or CSV' })}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </Animated.View>

                    <Animated.View style={menuItem4Style}>
                      {videoEnabled && (
                        <TouchableOpacity
                          testID="chat-upload-video"
                          style={[styles.menuItem, videoPickerActive && styles.disabledBtn]}
                          disabled={videoPickerActive || streaming}
                          onPress={() => { closeActionsImmediately(); requestAnimationFrame(() => safe(onOpenVideoPress)); }}
                          accessibilityRole="button"
                          accessibilityLabel={c('uploadVideo', 'Upload video')}
                        >
                          <View style={[styles.menuIconContainer, styles.iconViolet]}>
                            <SvgIcon name="workspace-video" size={28} color="#D1BDEB" />
                          </View>
                          <View style={styles.menuTextContainer}>
                            <Text style={styles.menuLabel}>{c('uploadVideo', 'Upload video')}</Text>
                            <Text style={styles.menuSubLabel}>{c('videoChatMenu', 'Understand scenes, speech & key moments')}</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.menuItem, styles.menuItemLast]}
                        onPress={handleWebSearchActionPress}
                        accessibilityRole="button"
                        accessibilityLabel={t('chat.webSearch.toggleLabel', { defaultValue: 'Search the web' })}
                        activeOpacity={0.9}
                      >
                        <View style={[styles.menuIconContainer, styles.iconOrange]}>
                          <ExploreIcon color="#FF9800" size={28} />
                        </View>
                        <View style={styles.menuTextContainer}>
                          <Text style={styles.menuLabel} numberOfLines={1}>{t('chat.webSearch.title', { defaultValue: 'Web search' })}</Text>
                          <Text style={styles.menuSubLabel} numberOfLines={1}>{t('chat.webSearch.subtitle', { defaultValue: 'Find recent info' })}</Text>
                        </View>
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                </Animated.View>
              );
            })()}
          </View>
        </Modal>
      )}

      <View style={styles.inputContainer}>
        {imageAttachments.length > 0 && (
          <ScrollView horizontal style={styles.thumbRow} contentContainerStyle={{ paddingVertical: 2 }} showsHorizontalScrollIndicator={false}>
            {imageAttachments
              .filter(a => a && typeof a.uri === 'string' && a.uri.length > 0)
              .map((a, idx) => (
                <View key={a.id || `${a.uri}-${idx}`} style={styles.thumbWrap}>
                  <Image source={{ uri: a.uri }} style={styles.thumb} />
                  <TouchableOpacity onPress={() => safe(onRemoveAttachment, a, idx)} style={styles.thumbRemove} accessibilityLabel={t('chat.removeImage')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Text style={styles.thumbRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
          </ScrollView>
        )}

        {documentAttachments.length > 0 && (
          <ScrollView
            horizontal
            style={styles.documentRow}
            contentContainerStyle={styles.documentRowContent}
            showsHorizontalScrollIndicator={false}
          >
            {documentAttachments.map((attachment, index) => {
              const busy = attachment.status === 'queued' || attachment.status === 'uploading' || attachment.status === 'processing';
              const failed = attachment.status === 'error';
              const secondary = failed
                ? t('chat.files.failed', { defaultValue: 'Upload failed' })
                : busy
                  ? `${Math.round((attachment.progress || 0) * 100)}%`
                  : formatFileSize(attachment.size);
              return (
                <View
                  key={attachment.id || `${attachment.name}-${index}`}
                  style={[styles.documentChip, failed && styles.documentChipFailed]}
                >
                  <View style={styles.documentIconWrap}>
                    {busy ? (
                      <ActivityIndicator size="small" color="#5AC8FA" />
                    ) : (
                      attachment.kind === 'video'
                        ? <SvgIcon name="workspace-video" color="#D1BDEB" size={22} />
                        : <FileIcon color={failed ? '#FF6B6B' : '#5AC8FA'} size={20} />
                    )}
                  </View>
                  <View style={styles.documentTextWrap}>
                    <Text style={styles.documentName} numberOfLines={1}>{attachment.name}</Text>
                    {!!secondary && (
                      <Text style={[styles.documentMeta, failed && styles.documentMetaFailed]} numberOfLines={1}>
                        {secondary}
                      </Text>
                    )}
                  </View>
                  {failed && !!attachment.uri && (
                    <TouchableOpacity
                      onPress={() => safe(onRetryAttachment, attachment, index)}
                      accessibilityLabel={t('chat.files.retry', { defaultValue: 'Retry upload' })}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.documentRetry}
                    >
                      <Text style={styles.documentRetryText}>
                        {t('chat.files.retryShort', { defaultValue: 'Retry' })}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => safe(onRemoveAttachment, attachment, index)}
                    accessibilityLabel={t('chat.files.remove', { defaultValue: 'Remove file' })}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.documentRemove}
                  >
                    <Text style={styles.documentRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.inputArea}>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChange}
            placeholder={t('chat.messagePlaceholder')}
            placeholderTextColor={colors.placeholder}
            style={[styles.input, useLatoForInput && styles.inputLato, { maxHeight: maxInputHeight }]}
            editable={!streaming && !offline && !isRecording}
            multiline
            onContentSizeChange={handleContentSizeChange}
            maxLength={maxLength}
            autoCorrect
            autoCapitalize="sentences"
            selectionColor={colors.primary}
            underlineColorAndroid="transparent"
            textAlignVertical={isExpanded ? 'top' : 'center'}
            accessibilityLabel={t('chat.messageInput')}
            scrollEnabled={inputHeight >= maxInputHeight}
            onFocus={() => {
              inputFocusedRef.current = true;
              keyboardVisibleRef.current = true;
              perfLog('chat.input.focus', {
                valueLength: value?.length || 0,
              });
              if (menuOpenRef.current) closeActionsImmediately();
            }}
            onBlur={() => {
              inputFocusedRef.current = false;
              perfLog('chat.input.blur');
            }}
          />
          {value?.length > 0 && (
            <TouchableOpacity
              onPress={() => onChange('')}
              accessibilityLabel={t('chat.clearInput')}
              style={{ position: 'absolute', right: -14, top: 4, padding: 6 }}>
              <Svg height={18} width={18} viewBox="0 -960 960 960" fill="#8E8E93"><Path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" /></Svg>
            </TouchableOpacity>
          )}

        </View>
          <View style={styles.iconsRow}>
            <View style={styles.leftControls}>
            <View ref={plusRef} collapsable={false} onLayout={() => { if (menuOpenRef.current) measureAnchor(); }}>
              <TouchableOpacity onPress={() => safe(toggleActions)} style={[styles.plusButton, isRecording && styles.disabledBtn]} disabled={isRecording} accessibilityRole="button" accessibilityLabel={t('chat.quickActionsLabel', { defaultValue: 'Quick actions' })}>
                <Animated.View style={plusIconStyle}>
                  <AddIcon color="#FFFFFF" size={18} />
                </Animated.View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.webSearchToggle, offline && styles.iconDisabled]}
              onPress={() => { if (!offline) safe(handleWebSearchPress); }}
              disabled={offline}
              accessibilityRole="button"
              accessibilityLabel={webSearchEnabled ? t('chat.webSearch.disable', { defaultValue: 'Disable web search' }) : t('chat.webSearch.enable', { defaultValue: 'Enable web search' })}
            >
              <ExploreIcon
                color={webSearchEnabled ? "#007AFF" : "#FFFFFF"}
                size={18}
              />
              {webSearchEnabled && (
                <Animated.View style={webSearchTextAnimatedStyle}>
                  <Text style={styles.webSearchText}>{t('chat.webSearch.label', { defaultValue: 'Web Search' })}</Text>
                </Animated.View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.rightControls}>
            <TouchableOpacity
              style={[styles.micButton, offline && styles.iconDisabled]}
              onPress={() => { if (!offline) safe(onMicPress); }}
              onPressIn={() => safe(onMicHoldStart)}
              onPressOut={() => safe(onMicHoldEnd)}
              disabled={offline}
              accessibilityRole="button"
              accessibilityLabel={t('chat.startVoiceInput')}
            >
              <MicIcon color="#FFFFFF" size={18} />
            </TouchableOpacity>

            {!streaming ? (
              <TouchableOpacity style={[canSend ? styles.sendButtonActive : styles.sendButton, (offline || isRecording) && styles.sendButtonDisabled]} onPress={() => {
                perfLog('chat.input.send_pressed', {
                  textLength: value?.trim?.().length || 0,
                  attachments: Array.isArray(attachments) ? attachments.length : 0,
                  canSend,
                  offline,
                  isRecording,
                });
                handleSend();
              }} disabled={!canSend || offline || isRecording} accessibilityRole="button" accessibilityLabel={offline ? t('chat.offline') : t('chat.sendMessage')}>
                <SendIcon color={canSend && !isRecording ? '#FFFFFF' : '#000000'} size={23} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.stopButton} onPress={handleStop} accessibilityRole="button" accessibilityLabel={t('chat.stop')}>
                <StopIcon color="#000000" size={34} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.metaRow}>
          {showCounter && !streaming ? (
            <Text style={styles.metaCounter}>{(value || '').length}/{counterLimit}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const THUMB = 48;

const styles = StyleSheet.create({
  wrapper: { backgroundColor: '#000000', paddingHorizontal: 12, paddingTop: 8, position: 'relative' },
  modalRoot: { flex: 1 },
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
  iconBlue: {},
  menuTextContainer: { flex: 1 },
  menuLabel: { color: '#E0E0E0', fontSize: 17, fontWeight: '600', fontFamily: 'Lato-BoldItalic', marginBottom: 3 },
  menuSubLabel: { color: '#A0A0A0', fontSize: 14, fontFamily: 'Lato-Regular' },

  inputContainer: {
    backgroundColor: '#1e1e1e',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8
  },

  thumbRow: { marginBottom: 8 },
  thumbWrap: { width: THUMB, height: THUMB, borderRadius: 10, marginRight: 6, borderWidth: 1, borderColor: colors.border },
  thumb: { width: '100%', height: '100%', borderRadius: 9 },
  thumbRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: '#000000CC', width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  thumbRemoveText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  documentRow: { marginBottom: 8 },
  documentRowContent: { gap: 8, paddingVertical: 2 },
  documentChip: {
    width: 220,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: '#262628',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  documentChipFailed: { borderColor: 'rgba(255,107,107,0.6)' },
  documentIconWrap: { width: 28, alignItems: 'center', justifyContent: 'center' },
  documentTextWrap: { flex: 1, marginLeft: 8, marginRight: 8 },
  documentName: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Lato-Bold' },
  documentMeta: { color: colors.textSecondary, fontSize: 11, marginTop: 2, fontFamily: 'Lato-Regular' },
  documentMetaFailed: { color: '#FF8A8A' },
  documentRetry: { minHeight: 28, justifyContent: 'center', paddingHorizontal: 6 },
  documentRetryText: { color: '#5AC8FA', fontSize: 11, fontFamily: 'Lato-Bold' },
  documentRemove: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  documentRemoveText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  inputArea: { marginBottom: 8 },
  input: {
    fontSize: 16,
    color: colors.text,
    paddingHorizontal: 0,
    paddingVertical: 8,
    paddingRight: 14,
    textAlignVertical: 'top',
    includeFontPadding: false,
    minHeight: 40
  },
  inputLato: {
    fontFamily: 'Lato-Regular',
  },

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

  sendButton: { width: 38, height: 38, borderRadius: 24, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendButtonActive: { width: 38, height: 38, borderRadius: 24, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  sendButtonDisabled: { backgroundColor: '#FFFFFF', opacity: 0.5 },

  stopButton: { width: 38, height: 38, borderRadius: 24, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },

  metaRow: { alignItems: 'flex-end' },
  metaStreaming: { fontSize: 11, color: colors.primary, fontFamily: 'Lato-Regular' },
  metaRecording: { fontSize: 11, color: '#EA4335', fontFamily: 'Lato-Regular' },
  metaCounter: { fontSize: 11, color: colors.textSecondary, fontFamily: 'Lato-Regular' },
});

const areEqual = (prev, next) => {
  if (prev.value !== next.value) return false;
  if (prev.streaming !== next.streaming) return false;
  if (prev.offline !== next.offline) return false;
  if (prev.forceCollapsed !== next.forceCollapsed) return false;
  if (prev.isRecording !== next.isRecording) return false;
  if (prev.webSearchEnabled !== next.webSearchEnabled) return false;
  if (prev.imagePickerActive !== next.imagePickerActive) return false;
  if (prev.documentPickerActive !== next.documentPickerActive) return false;
  if (prev.videoPickerActive !== next.videoPickerActive || prev.videoEnabled !== next.videoEnabled || prev.onOpenVideoPress !== next.onOpenVideoPress) return false;
  if (prev.maxLength !== next.maxLength) return false;
  if (prev.counterLimit !== next.counterLimit) return false;
  const pA = Array.isArray(prev.attachments) ? prev.attachments : [];
  const nA = Array.isArray(next.attachments) ? next.attachments : [];
  if (pA.length !== nA.length) return false;
  for (let i = 0; i < pA.length; i++) {
    if (pA[i]?.id !== nA[i]?.id) return false;
    if (pA[i]?.status !== nA[i]?.status) return false;
    if (pA[i]?.progress !== nA[i]?.progress) return false;
  }
  return true;
};

export default memo(TestInput, areEqual);

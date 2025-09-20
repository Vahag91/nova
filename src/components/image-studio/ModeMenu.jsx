import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, Animated, Dimensions, Modal,
  TouchableWithoutFeedback, StyleSheet, Keyboard
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const modes = [
  { key: 'text2img', label: 'Text to Image', icon: '🎨' },
  { key: 'img2img', label: 'Image to Image', icon: '🔄' },
];

const ITEM_H = 40, PAD_V = 8, MARGIN = 8, MENU_W = 204; // 240 - 15% = 204

function measureInWindowAsync(ref) {
  return new Promise(resolve => {
    if (!ref?.current || !ref.current.measureInWindow) return resolve(null);
    ref.current.measureInWindow((x, y, w, h) => resolve({ x, y, width: w, height: h }));
  });
}

const ModeMenu = memo(({ visible, onClose, currentMode, onModeSelect, buttonRef }) => {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = Dimensions.get('window');

  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.98)).current;
  const slideY = useRef(new Animated.Value(8)).current;

  const [anchor, setAnchor] = useState(null);

  const menuH = useMemo(() => modes.length * ITEM_H + PAD_V * 2, []);
  const animateIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(slideY,{ toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 260, friction: 22 }),
    ]).start();
  }, [fade, slideY, scale]);

  // measure on open + re-measure shortly after (Android/layout settle)
  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    (async () => {
      const first = await measureInWindowAsync(buttonRef);
      if (mounted) setAnchor(first);
      // re-measure next frame
      requestAnimationFrame(async () => {
        const second = await measureInWindowAsync(buttonRef);
        if (mounted && second) setAnchor(second);
        animateIn();
      });
    })();

    return () => {
      mounted = false;
      fade.setValue(0); scale.setValue(0.98); slideY.setValue(8);
    };
  }, [visible, buttonRef, animateIn, fade, scale, slideY]);

  // re-measure on rotation / screen change
  useEffect(() => {
    if (!visible) return;
    const sub = Dimensions.addEventListener?.('change', async () => {
      const m = await measureInWindowAsync(buttonRef);
      if (m) setAnchor(m);
    });
    return () => sub?.remove?.();
  }, [visible, buttonRef]);

  // re-measure when keyboard shows/hides (footer may shift)
  useEffect(() => {
    if (!visible) return;
    const show = Keyboard.addListener('keyboardDidShow', async () => {
      const m = await measureInWindowAsync(buttonRef);
      if (m) setAnchor(m);
    });
    const hide = Keyboard.addListener('keyboardDidHide', async () => {
      const m = await measureInWindowAsync(buttonRef);
      if (m) setAnchor(m);
    });
    return () => { show.remove(); hide.remove(); };
  }, [visible, buttonRef]);

  const handleModeSelect = useCallback((m) => {
    onModeSelect?.(m);
    onClose?.();
  }, [onModeSelect, onClose]);

  if (!visible || !anchor) return null;

  // placement: prefer ABOVE, else BELOW; align RIGHT edge to button's RIGHT edge
  const tryTop = anchor.y - menuH - MARGIN - 5; // Move 5px higher
  const placeAbove = tryTop >= (insets.top + MARGIN);
  const top = placeAbove
    ? tryTop
    : Math.min(anchor.y + anchor.height + MARGIN, screenH - menuH - MARGIN);

  const rightEdge = anchor.x + anchor.width;
  let left = rightEdge - MENU_W - 15; // right align, moved 15px left
  left = Math.max(MARGIN, Math.min(left, screenW - MENU_W - MARGIN));

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent={false}  // avoid coord mismatch
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.dropdown,
          { top, left, width: MENU_W, opacity: fade, transform: [{ scale }, { translateY: slideY }] }
        ]}
      >
        <View style={styles.dropdownContent}>
          {modes.map((m, i) => {
            const sel = m.key === currentMode;
            return (
              <Pressable
                key={m.key}
                style={[styles.item, sel && styles.itemSel]}
                onPress={() => handleModeSelect(m.key)}
                android_ripple={{ color: 'rgba(255,255,255,0.1)' }}
                accessibilityLabel={m.label}
              >
                <Text style={styles.icon}>{m.icon}</Text>
                <Text style={[styles.label, sel && styles.labelSel]}>{m.label}</Text>
                {sel && <Text style={styles.check}>✓</Text>}
                {i < modes.length - 1 && <View style={styles.divider} />}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  dropdown: { position: 'absolute', zIndex: 9999 },
  dropdownContent: {
    backgroundColor: 'rgba(28,28,30,0.95)',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#38383A',
    paddingVertical: PAD_V,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 20,
    overflow: 'hidden',
  },
  item: { paddingHorizontal: 14, paddingVertical: 8, minHeight: ITEM_H, flexDirection: 'row', alignItems: 'center' },
  itemSel: { backgroundColor: 'rgba(64,64,66,0.9)' },
  icon: { width: 22, textAlign: 'center', fontSize: 16, color: '#fff', marginRight: 10 },
  label: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  labelSel: { color: '#00E0C7', fontWeight: '700' },
  check: { color: '#00E0C7', fontSize: 16, fontWeight: '700' },
  divider: { position: 'absolute', left: 12, right: 12, bottom: 0, height: StyleSheet.hairlineWidth, backgroundColor: '#38383A' },
});

export default ModeMenu;
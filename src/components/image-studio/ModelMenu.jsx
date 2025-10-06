// components/image-studio/ModelMenu.js
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
  StyleSheet,
  Easing,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';

const EDGE_MARGIN = 16;           // min distance from screen edge
const MAX_MENU_WIDTH = 220;
const MAX_MENU_HEIGHT = 360;
const ITEM_HEIGHT = 48;
const ELEVATION = 12;

const ModelMenu = memo(({ visible, onClose, model, onModelChange, imageModels = [], buttonRef }) => {
  const { t } = useTranslation();
  const [rendered, setRendered] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const { width: winW, height: winH } = Dimensions.get('window');

  // animations - smooth slide from bottom
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuTranslateY = useRef(new Animated.Value(50)).current; // Slide from bottom
  const menuScale = useRef(new Animated.Value(0.95)).current; // Subtle scale

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      setRendered(true);
      // Start opening animation - smooth and elegant
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(menuOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(menuTranslateY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.back(1.2)), // Smooth back easing
          useNativeDriver: true,
        }),
        Animated.timing(menuScale, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else if (rendered) {
      // Start closing animation - smooth and quick
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(menuOpacity, {
          toValue: 0,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(menuTranslateY, {
          toValue: 50,
          duration: 250,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(menuScale, {
          toValue: 0.95,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setRendered(false);
        // Reset values for next opening
        backdropOpacity.setValue(0);
        menuOpacity.setValue(0);
        menuTranslateY.setValue(50);
        menuScale.setValue(0.95);
      });
    }
  }, [visible, rendered, backdropOpacity, menuOpacity, menuScale, menuTranslateY]);

  const measureAnchor = useCallback(() => {
    if (!buttonRef?.current?.measureInWindow) return;
    requestAnimationFrame(() => {
      buttonRef.current.measureInWindow((x, y, w, h) => {
        setAnchor({ x, y, width: w, height: h });
      });
    });
  }, [buttonRef]);

  useEffect(() => {
    if (!rendered) return;
    measureAnchor();
    const sub = Dimensions.addEventListener?.('change', measureAnchor);
    return () => sub?.remove?.();
  }, [rendered, measureAnchor]);

  const close = useCallback(() => onClose?.(), [onClose]);

  // placement math
  const { top, left, width: menuW, openDown, arrowLeft, estimatedH } = useMemo(() => {
    const w = Math.min(MAX_MENU_WIDTH, winW - EDGE_MARGIN * 2);
    const estH = Math.min(MAX_MENU_HEIGHT, 8 + imageModels.length * ITEM_HEIGHT); // rough pre-layout height
    const a = anchor || { x: winW / 2 - 22, y: 64, width: 44, height: 44 };

    const anchorMidX = a.x + a.width / 2;
    let l = Math.round(anchorMidX - w / 2);
    l = Math.max(EDGE_MARGIN, Math.min(l, winW - EDGE_MARGIN - w));

    const roomBelow = winH - (a.y + a.height) - EDGE_MARGIN;
    const openDownwards = roomBelow >= estH || a.y < winH / 2;

    const t = openDownwards
      ? Math.round(a.y + a.height + 8)
      : Math.round(Math.max(EDGE_MARGIN, a.y - estH - 28));

    const arrowX = Math.round(anchorMidX - l); // within menu box

    return { top: t, left: l, width: w, openDown: openDownwards, arrowLeft: arrowX, estimatedH: estH };
  }, [anchor, imageModels.length, winW, winH]);

  const onSelect = useCallback((k) => { onModelChange?.(k); close(); }, [onModelChange, close]);


  if (!rendered) return null;

  return (
    <Modal visible={rendered} transparent animationType="none" onRequestClose={close}>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      {/* Popover (anchored) */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.container,
          {
            top, left, width: menuW,
            transform: [
              { translateY: menuTranslateY },
              { scale: menuScale }
            ],
            opacity: menuOpacity,
          },
        ]}
      >
        {/* Arrow */}
        <View
          style={[
            styles.arrow,
            openDown ? styles.arrowUp : styles.arrowDown,
            { left: Math.max(12, Math.min(menuW - 12, arrowLeft)) },
          ]}
        />

        {/* Menu */}
        <View style={[styles.menu, { maxHeight: MAX_MENU_HEIGHT }]}>
          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{t('modelSelector.title')}</Text>
          </View>
          
          {imageModels.map((m, idx) => {
            const isSelected = m.key === model;
            const last = idx === imageModels.length - 1;
            return (
              <Pressable
                key={m.key}
                onPress={() => onSelect(m.key)}
                style={[styles.item, isSelected && styles.itemSelected, !last && styles.itemDivider]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={styles.itemIcon}>🖼️</Text>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[styles.itemLabel, isSelected && styles.itemLabelSelected]}>
                    {m.display?.name || m.key}
                  </Text>
                  {!!m.provider && (
                    <Text numberOfLines={1} style={styles.itemSubLabel}>
                      {m.provider}
                    </Text>
                  )}
                </View>
                {isSelected ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.25)' },

  container: {
    position: 'absolute',
    marginLeft: -38, // Move 48px to the left (20% of 240px)
  },

  arrow: {
    position: 'absolute',
    width: 12,
    height: 12,
    transform: [{ rotate: '45deg' }],
    backgroundColor: '#1E1E1E',
    borderColor: '#2B2F36',
    borderLeftWidth: 1,
    borderTopWidth: 1,
  },
  arrowUp: { top: -6 },
  arrowDown: { bottom: -6 },

  menu: {
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2B2F36',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: ELEVATION,
  },
  titleContainer: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  title: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
    textAlign: 'center',
  },

  item: {
    height: ITEM_HEIGHT,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  itemDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  itemSelected: {
    backgroundColor: 'rgba(138, 66, 255, 0.1)',
  },
  itemIcon: { width: 20, textAlign: 'center', fontSize: 15 },
  itemLabel: { color: '#F3F4F6', fontSize: 14, fontWeight: '600' },
  itemLabelSelected: { color: '#8A42FF' },
  itemSubLabel: { color: '#9CA3AF', fontSize: 11, marginTop: 2 },
  check: { color: '#8A42FF', fontSize: 16, marginLeft: 6, fontWeight: '700' },
});

export default ModelMenu;
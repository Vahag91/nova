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
import SvgIcon from '../SvgIcon';
import {
  formatModelProvider,
  getModelVisuals,
  hexToRgba,
} from '../../utils/modelVisuals';

const EDGE_MARGIN = 16;           // min distance from screen edge
const MAX_MENU_WIDTH = 240;
const MAX_MENU_HEIGHT = 320;
const ITEM_HEIGHT = 50;
const ELEVATION = 12;

const ModelMenu = memo(({ visible, onClose, model, onModelChange, imageModels = [], buttonRef }) => {
  const { t } = useTranslation();
  const [rendered, setRendered] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const { width: winW, height: winH } = Dimensions.get('window');
  const safeModels = useMemo(() => Array.isArray(imageModels) ? imageModels : [], [imageModels]);

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
      try {
        buttonRef.current.measureInWindow((x, y, w, h) => {
          setAnchor({ x, y, width: w, height: h });
        });
      } catch {}
    });
  }, [buttonRef]);

  useEffect(() => {
    if (!rendered) return;
    measureAnchor();
    const sub = Dimensions.addEventListener?.('change', measureAnchor);
    return () => sub?.remove?.();
  }, [rendered, measureAnchor]);

  const close = useCallback(() => {
    try { onClose?.(); } catch {}
  }, [onClose]);

  // placement math
  const { top, left, width: menuW, openDown, arrowLeft, estimatedH } = useMemo(() => {
    const w = Math.min(MAX_MENU_WIDTH, winW - EDGE_MARGIN * 2);
    const estH = Math.min(MAX_MENU_HEIGHT, 8 + safeModels.length * ITEM_HEIGHT); // rough pre-layout height
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
  }, [anchor, safeModels.length, winW, winH]);

  const onSelect = useCallback((k) => {
    try { onModelChange?.(k); } catch {}
    close();
  }, [onModelChange, close]);


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
          
          {safeModels.map((m, idx) => {
            const isSelected = m.key === model;
            const visuals = getModelVisuals(m.provider);
            const providerLabel = formatModelProvider(m.provider);
            const last = idx === safeModels.length - 1;
            return (
              <Pressable
                key={m.key}
                onPress={() => onSelect(m.key)}
                style={[
                  styles.item,
                  isSelected && styles.itemSelected,
                  last && styles.itemLast,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                <SvgIcon
                  name={visuals.icon}
                  size={15}
                  color={hexToRgba(visuals.accent, 0.85)}
                />
                <View style={styles.itemText}>
                  <Text
                    numberOfLines={1}
                    style={[styles.itemLabel, isSelected && styles.itemLabelSelected]}
                  >
                    {m.display?.name || m.key}
                  </Text>
                  <Text numberOfLines={1} style={styles.itemProvider}>
                    {providerLabel}
                  </Text>
                </View>
                {isSelected ? <Text style={styles.checkGlyph}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.28)' },

  container: {
    position: 'absolute',
  },

  arrow: {
    position: 'absolute',
    width: 12,
    height: 12,
    transform: [{ rotate: '45deg' }],
    backgroundColor: 'rgba(23,23,28,0.98)',
    borderColor: 'rgba(124,92,255,0.22)',
    borderLeftWidth: 1,
    borderTopWidth: 1,
  },
  arrowUp: { top: -6 },
  arrowDown: { bottom: -6 },

  menu: {
    backgroundColor: 'rgba(15,16,22,0.96)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 6,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: ELEVATION,
  },
  titleContainer: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
  },
  title: {
    color: '#E6E8FF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontFamily: 'Lato-Bold',
  },

  item: {
    minHeight: ITEM_HEIGHT,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  itemSelected: {
    backgroundColor: 'rgba(124,92,255,0.12)',
  },
  itemLast: { borderBottomWidth: 0 },
  itemText: { flex: 1, gap: 2 },
  itemLabel: {
    color: '#F4F6FD',
    fontSize: 15,
    fontFamily: 'Lato-Bold',
    flexShrink: 1,
  },
  itemLabelSelected: { color: '#FFFFFF' },
  itemProvider: {
    color: 'rgba(214,220,232,0.62)',
    fontSize: 11,
    fontFamily: 'Lato-Regular',
  },
  checkGlyph: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginLeft: 6 },
});

export default ModelMenu;

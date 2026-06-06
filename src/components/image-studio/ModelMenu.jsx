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
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import SvgIcon from '../SvgIcon';
import {
  formatModelProvider,
  getModelVisuals,
} from '../../utils/modelVisuals';
import { getImageModelPrice } from '../../utils/imagePricing';
import Svg, { Path } from 'react-native-svg';

const EDGE_MARGIN = 16;           // min distance from screen edge
const MAX_MENU_WIDTH = 420; // wider to properly align labels, coins and check
const MAX_MENU_HEIGHT = 360;
const ITEM_HEIGHT = 56;
const ELEVATION = 12;
const MENU_OPEN_OFFSET = 18;
const BACKDROP_PRESS_DELAY_MS = 180;

const ModelMenu = memo(({ visible, onClose, model, onModelChange, imageModels = [], buttonRef }) => {
  const { t } = useTranslation();
  const [rendered, setRendered] = useState(false);
  const [menuReady, setMenuReady] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const { width: winW, height: winH } = Dimensions.get('window');
  const safeModels = useMemo(() => Array.isArray(imageModels) ? imageModels : [], [imageModels]);
  const openCycleRef = useRef(0);
  const backdropPressEnabledRef = useRef(false);
  const backdropPressTimerRef = useRef(null);

  // animations - smooth slide from bottom
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuTranslateY = useRef(new Animated.Value(MENU_OPEN_OFFSET)).current;
  const menuScale = useRef(new Animated.Value(0.95)).current; // Subtle scale

  const clearBackdropPressTimer = useCallback(() => {
    if (backdropPressTimerRef.current) {
      clearTimeout(backdropPressTimerRef.current);
      backdropPressTimerRef.current = null;
    }
  }, []);

  const resetAnimatedValues = useCallback(() => {
    backdropOpacity.setValue(0);
    menuOpacity.setValue(0);
    menuTranslateY.setValue(MENU_OPEN_OFFSET);
    menuScale.setValue(0.95);
  }, [backdropOpacity, menuOpacity, menuScale, menuTranslateY]);

  const enableBackdropPress = useCallback(() => {
    clearBackdropPressTimer();
    backdropPressEnabledRef.current = false;
    backdropPressTimerRef.current = setTimeout(() => {
      backdropPressEnabledRef.current = true;
      backdropPressTimerRef.current = null;
    }, BACKDROP_PRESS_DELAY_MS);
  }, [clearBackdropPressTimer]);

  const measureAnchor = useCallback((onMeasured) => {
    if (!buttonRef?.current?.measureInWindow) {
      onMeasured?.(null);
      return;
    }
    requestAnimationFrame(() => {
      try {
        buttonRef.current.measureInWindow((x, y, w, h) => {
          if (![x, y, w, h].every(Number.isFinite)) {
            onMeasured?.(null);
            return;
          }
          const nextAnchor = { x, y, width: w, height: h };
          setAnchor(nextAnchor);
          onMeasured?.(nextAnchor);
        });
      } catch {
        onMeasured?.(null);
      }
    });
  }, [buttonRef]);

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      const cycleId = openCycleRef.current + 1;
      openCycleRef.current = cycleId;
      setRendered(true);
      setMenuReady(false);
      backdropPressEnabledRef.current = false;
      clearBackdropPressTimer();
      resetAnimatedValues();

      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      measureAnchor((nextAnchor) => {
        if (openCycleRef.current !== cycleId) return;
        setMenuReady(true);
        enableBackdropPress();
        Animated.parallel([
          Animated.timing(menuOpacity, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(menuTranslateY, {
            toValue: 0,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(menuScale, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else if (rendered) {
      openCycleRef.current += 1;
      backdropPressEnabledRef.current = false;
      clearBackdropPressTimer();
      // Start closing animation - smooth and quick
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 160,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(menuOpacity, {
          toValue: 0,
          duration: 160,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(menuTranslateY, {
          toValue: MENU_OPEN_OFFSET,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(menuScale, {
          toValue: 0.95,
          duration: 160,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setRendered(false);
        setMenuReady(false);
        resetAnimatedValues();
      });
    }
  }, [
    visible,
    rendered,
    backdropOpacity,
    menuOpacity,
    menuScale,
    menuTranslateY,
    clearBackdropPressTimer,
    enableBackdropPress,
    measureAnchor,
    resetAnimatedValues,
  ]);

  useEffect(() => {
    if (!rendered) return;
    const remeasureAnchor = () => measureAnchor();
    const sub = Dimensions.addEventListener?.('change', remeasureAnchor);
    return () => sub?.remove?.();
  }, [rendered, measureAnchor]);

  useEffect(() => () => {
    clearBackdropPressTimer();
  }, [clearBackdropPressTimer]);

  const close = useCallback(() => {
    try { onClose?.(); } catch {}
  }, [onClose]);

  // placement math
  const { top, left, width: menuW, openDown, arrowLeft } = useMemo(() => {
    const w = Math.min(MAX_MENU_WIDTH, winW - EDGE_MARGIN * 2);
    const estH = Math.min(MAX_MENU_HEIGHT, 8 + safeModels.length * ITEM_HEIGHT); // rough pre-layout height
    const a = anchor || { x: winW / 2 - 22, y: 64, width: 44, height: 44 };

    const anchorMidX = a.x + a.width / 2;
    let l = Math.round(anchorMidX - w / 2);
    l = Math.max(EDGE_MARGIN, Math.min(l, winW - EDGE_MARGIN - w));

    const roomBelow = winH - (a.y + a.height) - EDGE_MARGIN;
    const openDownwards = roomBelow >= estH || a.y < winH / 2;

    const menuTop = openDownwards
      ? Math.round(a.y + a.height + 8)
      : Math.round(Math.max(EDGE_MARGIN, a.y - estH - 28));

    const arrowX = Math.round(anchorMidX - l); // within menu box

    return { top: menuTop, left: l, width: w, openDown: openDownwards, arrowLeft: arrowX };
  }, [anchor, safeModels.length, winW, winH]);

  const onSelect = useCallback((k) => {
    try { onModelChange?.(k); } catch {}
    close();
  }, [onModelChange, close]);


  if (!rendered) return null;

  return (
    <Modal
      visible={rendered}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={close}
    >
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (backdropPressEnabledRef.current) {
              close();
            }
          }}
        />
      </Animated.View>

      {/* Popover (anchored) */}
      {menuReady ? (
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
            
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            >
              {safeModels.map((m, idx) => {
                const isSelected = m.key === model;
                const visuals = getModelVisuals(m.provider, m.key);
                const descriptor = visuals.tagline || formatModelProvider(m.provider);
                const cost = getImageModelPrice(m.key);
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
                    {/* Left section: icon + name + descriptor */}
                    <View style={styles.rowLeft}>
                      <SvgIcon name={visuals.icon} size={28} color="#FFFFFF" />
                      <View style={styles.itemText}>
                        <Text
                          numberOfLines={1}
                          style={[styles.itemLabel, isSelected && styles.itemLabelSelected]}
                        >
                          {m.display?.name || m.key}
                        </Text>
                        <Text numberOfLines={2} style={styles.itemProvider}>
                          {descriptor}
                        </Text>
                      </View>
                    </View>

                    {/* Right section: coin pill + check (aligned) */}
                    <View style={styles.rowRight}>
                      <View style={styles.coinPill}>
                        <Svg height={12} width={12} viewBox="0 -960 960 960" fill="#FF9500">
                          <Path d="M480-120q-151 0-255.5-46.5T120-280v-400q0-66 105.5-113T480-840q149 0 254.5 47T840-680v400q0 67-104.5 113.5T480-120Zm0-479q89 0 179-25.5T760-679q-11-29-100.5-55T480-760q-91 0-178.5 25.5T200-679q14 30 101.5 55T480-599Zm0 199q42 0 81-4t74.5-11.5q35.5-7.5 67-18.5t57.5-25v-120q-26 14-57.5 25t-67 18.5Q600-528 561-524t-81 4q-42 0-82-4t-75.5-11.5Q287-543 256-554t-56-25v120q25 14 56 25t66.5 18.5Q358-408 398-404t82 4Zm0 200q46 0 93.5-7t87.5-18.5q40-11.5 67-26t32-29.5v-98q-26 14-57.5 25t-67 18.5Q600-328 561-324t-81 4q-42 0-82-4t-75.5-11.5Q287-343 256-354t-56-25v99q5 15 31.5 29t66.5 25.5q40 11.5 88 18.5t94 7Z" />
                        </Svg>
                        <Text style={styles.coinPillText}>{cost}</Text>
                      </View>
                      <View style={styles.checkWrap}>
                        <SvgIcon name="check" size={22} color={isSelected ? '#FFFFFF' : 'transparent'} />
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Animated.View>
      ) : null}
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

  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  item: {
    minHeight: ITEM_HEIGHT,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1, flexGrow: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 10, flexShrink: 0 },
  itemSelected: {},
  itemLast: { borderBottomWidth: 0 },
  itemText: { flex: 1, justifyContent: 'center', gap: 1 },
  itemLabel: {
    color: '#F4F6FD',
    fontSize: 15,
    fontFamily: 'Lato-Bold',
    flexShrink: 1,
  },
  itemLabelSelected: { color: '#FFFFFF' },
  itemProvider: {
    flex: 1,
    color: 'rgba(214,220,232,0.62)',
    fontSize: 11,
    letterSpacing: 0.3,
    fontFamily: 'Lato-Regular',
    marginRight: 8,
    lineHeight: 15,
    padding:1,
    marginBottom:4
  },
  coinPill: {
    minWidth: 56,
    height: 26,
    borderRadius: 14,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  coinPillText: { color: '#FFFFFF', fontSize: 12, fontFamily: 'Lato-Bold' },
  checkWrap: { width: 28, alignItems: 'center' },
});

export default ModelMenu;

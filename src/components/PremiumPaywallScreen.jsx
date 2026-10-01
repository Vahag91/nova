import { IMAGE_STUDIO_ENABLED } from '../constants/featureFlags';
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Easing,
  Image,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

import SvgIcon from './SvgIcon';
import { SubscriptionContext } from '../context/SubscriptionContext';
import {
  consumePendingPremiumAction,
  clearPendingPremiumAction,
} from '../state/premiumActions';
import { navigate as navigateRoot } from '../navigation/rootNavigation';
import { ONE_TIME_OFFER_KEY } from '../constants/storageKeys';
import { ONE_TIME_OFFER_PAYWALL_ENABLED } from '../constants/featureFlags';
import {
  PAYWALL_CLOSE_LOCK_MS,
  shouldDelayPaywallClose,
} from '../lib/paywallCloseGate';

const LEGACY_HERO_IMAGE = require('../../assets/images/paywall/PaywallGirls.webp');
const HERO_IMAGE = require('../../assets/images/paywall/cloud-ai-intelligence-hero-v2-optimized.jpg');
const HERO_SURFACE_FALLBACK_MS = 1500;
const PAYWALL_STORY_DURATION_MS = 8000;
const CLOSE_CONTROL_SIZE = 34;
const CLOSE_CONTROL_CENTER = CLOSE_CONTROL_SIZE / 2;
const CLOSE_CONTROL_TOP_GAP = 18;
const CLOSE_RING_RADIUS = 14;
const CLOSE_RING_CIRCUMFERENCE = 2 * Math.PI * CLOSE_RING_RADIUS;
const CLOSE_SPINNER_COLOR = '#8A8F93';
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const PLAY_SUBSCRIPTIONS_URL =
  'https://play.google.com/store/account/subscriptions';

// Matches the v3 onboarding so the paywall reads as the same product.
// Deliberately separate from COLORS: the legacy paywall below still uses that.
const EDITORIAL = {
  background: '#05070A',
  surface: 'rgba(255,255,255,0.055)',
  border: 'rgba(255,255,255,0.16)',
  accent: '#0ABAB5',
  accentSoft: 'rgba(10,186,181,0.14)',
  // Older dormant styles still reference these names. Mapping them to the
  // same three-color system keeps rollback code intact without adding colors.
  violet: '#0ABAB5',
  violetSoft: 'rgba(10,186,181,0.14)',
  cream: '#FFFFFF',
  onCream: '#05070A',
  title: '#FFFFFF',
  body: 'rgba(255,255,255,0.64)',
};

const COLORS = {
  background: '#030405',
  control: 'rgba(24, 27, 28, 0.94)',
  controlBorder: 'rgba(104, 109, 111, 0.55)',
  selectedControl: 'rgba(24, 30, 31, 0.97)',
  accent: '#19D5D0',
  accentBright: '#22E5D4',
  primaryText: '#F4F5F5',
  secondaryText: '#A5A7A9',
  mutedText: '#747779',
  ctaStart: '#3A4042',
  ctaEnd: '#292E30',
};

// Rollback switch: the complete original paywall is preserved later in this
// file and can be restored without touching any billing code.
export const PAYWALL_EXPERIENCE_VERSION = 'v3';
const USE_TIMELINE_PAYWALL = PAYWALL_EXPERIENCE_VERSION === 'v3';

const clamp = (value, minimum, maximum) =>
  Math.min(Math.max(value, minimum), maximum);

export function shouldStartPaywallEntrance({
  heroSurfaceReady,
  isPremium,
  isClosing,
}) {
  return heroSurfaceReady && !isPremium && !isClosing;
}

function CloseIcon({ color = COLORS.primaryText, size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6 6l12 12M18 6 6 18"
        fill="none"
        stroke={color}
        strokeWidth="2.35"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function ImageStudioIcon({ size = 18, color = COLORS.accent }) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960" fill={color}>
      <Path d="m176-120-56-56 301-302-181-45 198-123-17-234 179 151 216-88-87 217 151 178-234-16-124 198-45-181-301 301Zm24-520-80-80 80-80 80 80-80 80Zm355 197 48-79 93 7-60-71 35-86-86 35-71-59 7 92-79 49 90 22 23 90Zm165 323-80-80 80-80 80 80-80 80ZM569-570Z" />
    </Svg>
  );
}

function SelectionRadio({ selected, editorial }) {
  return (
    <View
      style={[
        styles.radioOuter,
        selected && styles.radioOuterSelected,
        selected && editorial && styles.radioOuterEditorial,
      ]}
    >
      {selected ? (
        <View style={[styles.radioInner, editorial && styles.radioInnerEditorial]} />
      ) : null}
    </View>
  );
}

function TrialSwitch({ value, onPress, disabled }) {
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.switchTrack, !value && styles.switchTrackOff]}
    >
      <View style={[styles.switchThumb, value && styles.switchThumbOn]} />
    </TouchableOpacity>
  );
}

function PlanCard({
  title,
  badge,
  supportingText,
  price,
  period,
  inlinePrice = false,
  selected,
  onPress,
  compact,
  editorial = false,
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.planCard,
        compact && styles.planCardCompact,
        selected && styles.planCardSelected,
        editorial && styles.planCardEditorial,
        selected && editorial && styles.planCardEditorialSelected,
      ]}
    >
      <View style={styles.planIdentity}>
        <SelectionRadio editorial={editorial} selected={selected} />
        <View style={styles.planCopy}>
          <View style={styles.planTitleRow}>
            <Text style={styles.planTitle}>{title}</Text>
            {badge ? (
              <LinearGradient
                colors={editorial ? [EDITORIAL.cream, EDITORIAL.cream] : ['#77E7C0', '#5DD7C1']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.savingsBadge}
              >
                <Text style={styles.savingsBadgeText}>{badge}</Text>
              </LinearGradient>
            ) : null}
          </View>
          {supportingText ? (
            <Text
              style={[
                styles.supportingText,
                selected && styles.supportingTextSelected,
                selected && editorial && styles.supportingTextEditorial,
              ]}
            >
              {supportingText}
            </Text>
          ) : null}
        </View>
      </View>

      {!inlinePrice ? (
        <View style={styles.priceColumn}>
          <Text
            style={[
              styles.planPrice,
              !selected && styles.annualPrice,
              !selected && editorial && styles.annualPriceEditorial,
            ]}
          >
            {price}
          </Text>
          <Text style={styles.planPeriod}>{period}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function TimelinePlanCard({
  badge,
  onPress,
  period,
  price,
  secondary,
  selected,
  title,
}) {
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        styles.timelinePlanCard,
        selected && styles.timelinePlanCardSelected,
        selected && styles.timelinePlanCardSelectedCyan,
      ]}
    >
      {badge ? (
        <View
          style={[
            styles.timelinePlanBadge,
            selected && styles.timelinePlanBadgeSelected,
            selected && styles.timelinePlanBadgeSelectedCyan,
          ]}
        >
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.76}
            numberOfLines={1}
            style={[
              styles.timelinePlanBadgeText,
              selected && styles.timelinePlanBadgeTextSelected,
            ]}
          >
            {badge}
          </Text>
        </View>
      ) : null}
      <View style={styles.timelinePlanHeader}>
        <Text numberOfLines={1} style={styles.timelinePlanTitle}>
          {title}
        </Text>
        <SelectionRadio editorial selected={selected} />
      </View>
      <View style={styles.timelinePlanPriceRow}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.78}
          numberOfLines={1}
          style={styles.timelinePlanPrice}
        >
          {price}
        </Text>
        <Text numberOfLines={1} style={styles.timelinePlanPeriod}>
          / {period}
        </Text>
      </View>
      {secondary ? (
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.74}
          numberOfLines={2}
          style={styles.timelinePlanSecondary}
        >
          {secondary}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

function BillingTimeline({ compact, items, storyProgress }) {
  const storyBeats = [
    [0, 0.08, 0.26],
    [0.28, 0.5, 0.7],
    [0.68, 0.9, 1],
  ];

  return (
    <View
      style={[
        styles.billingTimeline,
        compact && styles.billingTimelineCompact,
      ]}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const beat = storyBeats[index] || storyBeats[storyBeats.length - 1];
        const haloOpacity = storyProgress.interpolate({
          inputRange: beat,
          outputRange: [0, 0.72, 0],
        });
        const haloScale = storyProgress.interpolate({
          inputRange: beat,
          outputRange: [0.78, 1.42, 1.7],
        });
        return (
          <View
            key={item.title}
            style={[
              styles.billingTimelineRow,
              compact && styles.billingTimelineRowCompact,
            ]}
          >
            <View style={styles.billingTimelineRail}>
              <View style={styles.billingTimelineDotWrap}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.billingTimelineHalo,
                    {
                      opacity: haloOpacity,
                      transform: [{ scale: haloScale }],
                    },
                  ]}
                />
                <View
                  style={[
                    styles.billingTimelineDot,
                    index === 1 && styles.billingTimelineDotMiddle,
                    isLast && styles.billingTimelineDotFinal,
                  ]}
                >
                  <SvgIcon
                    color={isLast ? EDITORIAL.title : EDITORIAL.onCream}
                    name={item.icon}
                    size={16}
                  />
                </View>
              </View>
              {!isLast ? (
                <View style={styles.billingTimelineLine} />
              ) : (
                <View style={styles.billingTimelineTail} />
              )}
            </View>
            <View style={styles.billingTimelineCopy}>
              <Text style={styles.billingTimelineTitle}>{item.title}</Text>
              <Text style={styles.billingTimelineBody}>{item.body}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PremiumPaywallContent({
  navigation,
  onClose,
  onExit,
  onPresented,
  onRestore,
  route,
}) {
  const {
    availablePackages,
    offeredPackages,
    fetchOfferings,
    purchasePackage,
    restorePurchases,
    isPremium,
    restoring,
    subscriptionReady,
    offeringsState,
    paymentsEnabled,
  } = useContext(SubscriptionContext) || {};
  const insets = useSafeAreaInsets();
  const { t: tr, i18n } = useTranslation();
  const { width, height } = useWindowDimensions();

  const justPurchasedRef = useRef(false);
  const isClosingRef = useRef(false);
  const exitCommittedRef = useRef(false);
  const closeFallbackTimerRef = useRef(null);
  const premiumActionHandledRef = useRef(false);
  const offeringsAttemptedRef = useRef(false);
  const transitionProgress = useRef(new Animated.Value(0)).current;
  const offerStoryProgress = useRef(new Animated.Value(0)).current;
  const closeRevealProgress = useRef(new Animated.Value(0)).current;
  const showOneTimeAfterClose = route.params?.showOneTimeOfferAfterClose;
  const afterCloseNavigateTo = route.params?.afterCloseNavigateTo;
  const delayCloseForPaywall =
    USE_TIMELINE_PAYWALL || shouldDelayPaywallClose(route.params);

  const [selectedPlan, setSelectedPlan] = useState('weekly');
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [closeReady, setCloseReady] = useState(!delayCloseForPaywall);
  const [heroSurfaceReady, setHeroSurfaceReady] = useState(
    USE_TIMELINE_PAYWALL,
  );
  const [surfaceVisible, setSurfaceVisible] = useState(USE_TIMELINE_PAYWALL);
  const [transitionActive, setTransitionActive] = useState(true);

  const displayPackages = {
    weekly: availablePackages?.weekly || offeredPackages?.weekly,
    yearly: availablePackages?.yearly || offeredPackages?.yearly,
  };
  const hasYearly = !!displayPackages.yearly;
  const hasWeekly = !!displayPackages.weekly;
  const selectedNativePackage =
    selectedPlan === 'yearly'
      ? availablePackages?.yearly
      : availablePackages?.weekly;
  const pricingIsLoading =
    paymentsEnabled &&
    !hasYearly &&
    !hasWeekly &&
    (offeringsState === 'idle' || offeringsState === 'loading');
  const isBusy = purchaseLoading || restoring;
  const weeklyHasFreeTrial = !!(
    availablePackages?.weekly?.product?.defaultOption?.freePhase ||
    availablePackages?.weekly?.product?.subscriptionOptions?.some(
      option => option?.freePhase,
    ) ||
    offeredPackages?.weekly?.product?.hasFreeTrial
  );
  const trialEnabled = selectedPlan === 'weekly' && weeklyHasFreeTrial;

  const layout = useMemo(() => {
    const compactWidth = width < 360;
    const compactHeight = height < 720;
    const compact = compactWidth || compactHeight;
    const horizontalPadding = clamp(width * 0.05, 16, 22);
    const contentWidth = Math.min(560, width - horizontalPadding * 2);

    return {
      compact,
      compactHeight,
      horizontalPadding,
      contentWidth,
      titleSize: compactWidth ? 27 : 30,
      subtitleSize: compactWidth ? 15 : 16,
      heroToTrialSpacing: compact ? 16 : 24,
    };
  }, [height, width]);

  useEffect(() => {
    if (
      !shouldStartPaywallEntrance({
        heroSurfaceReady,
        isPremium,
        isClosing: isClosingRef.current,
      })
    ) {
      return undefined;
    }

    const animation = Animated.timing(transitionProgress, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    const startAnimation = () => {
      animation.start(({ finished }) => {
        if (finished) {
          setTransitionActive(false);
          onPresented?.();
        }
      });
    };
    let frameId;
    if (USE_TIMELINE_PAYWALL) {
      // The active surface starts hidden by the animated value itself, so it
      // needs only one layout frame before its native-driver entrance begins.
      frameId = requestAnimationFrame(startAnimation);
    } else {
      frameId = requestAnimationFrame(() => {
        frameId = requestAnimationFrame(() => {
          setSurfaceVisible(true);
          frameId = requestAnimationFrame(startAnimation);
        });
      });
    }
    return () => {
      cancelAnimationFrame(frameId);
      animation.stop();
    };
  }, [heroSurfaceReady, isPremium, onPresented, transitionProgress]);

  useEffect(() => {
    if (heroSurfaceReady) return undefined;
    const timeoutId = setTimeout(
      () => setHeroSurfaceReady(true),
      HERO_SURFACE_FALLBACK_MS,
    );
    return () => clearTimeout(timeoutId);
  }, [heroSurfaceReady]);

  useEffect(() => {
    if (
      subscriptionReady &&
      paymentsEnabled &&
      (offeringsState === 'idle' || offeringsState === 'error') &&
      !offeringsAttemptedRef.current
    ) {
      offeringsAttemptedRef.current = true;
      try {
        fetchOfferings?.();
      } catch {}
    }
  }, [
    fetchOfferings,
    hasWeekly,
    hasYearly,
    offeringsState,
    paymentsEnabled,
    subscriptionReady,
  ]);

  useEffect(() => {
    setSelectedPlan(hasWeekly || !hasYearly ? 'weekly' : 'yearly');
  }, [hasWeekly, hasYearly]);

  useEffect(() => {
    if (USE_TIMELINE_PAYWALL) {
      setCloseReady(false);
      closeRevealProgress.setValue(0);
      const timeoutId = setTimeout(() => {
        setCloseReady(true);
        Animated.spring(closeRevealProgress, {
          toValue: 1,
          damping: 16,
          stiffness: 190,
          mass: 0.8,
          useNativeDriver: true,
        }).start();
      }, PAYWALL_STORY_DURATION_MS);

      return () => clearTimeout(timeoutId);
    }

    if (!delayCloseForPaywall) {
      setCloseReady(true);
      return undefined;
    }

    setCloseReady(false);
    const timeoutId = setTimeout(
      () => setCloseReady(true),
      PAYWALL_CLOSE_LOCK_MS,
    );
    return () => clearTimeout(timeoutId);
  }, [closeRevealProgress, delayCloseForPaywall]);

  useEffect(() => {
    if (!USE_TIMELINE_PAYWALL) return undefined;

    offerStoryProgress.setValue(0);
    const animation = Animated.timing(offerStoryProgress, {
      toValue: 1,
      duration: PAYWALL_STORY_DURATION_MS,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [offerStoryProgress]);

  useEffect(() => {
    if (selectedPlan === 'yearly' && !hasYearly) {
      setSelectedPlan(hasWeekly ? 'weekly' : 'yearly');
      return;
    }
    if (selectedPlan === 'weekly' && !hasWeekly) {
      setSelectedPlan(hasYearly ? 'yearly' : 'weekly');
    }
  }, [hasWeekly, hasYearly, selectedPlan]);

  const performClose = useCallback(() => {
    if (exitCommittedRef.current) {
      return;
    }
    exitCommittedRef.current = true;
    isClosingRef.current = false;
    if (closeFallbackTimerRef.current !== null) {
      clearTimeout(closeFallbackTimerRef.current);
      closeFallbackTimerRef.current = null;
    }
    clearPendingPremiumAction();
    const shouldShowOneTime =
      ONE_TIME_OFFER_PAYWALL_ENABLED &&
      showOneTimeAfterClose &&
      !isPremium &&
      !justPurchasedRef.current;

    justPurchasedRef.current = false;
    if (onExit?.({ showOneTimeOffer: shouldShowOneTime }) === true) {
      return;
    }
    if (shouldShowOneTime) {
      AsyncStorage.setItem(ONE_TIME_OFFER_KEY, String(Date.now())).catch(
        () => {},
      );
      if (navigation?.replace) {
        navigation.replace('OneTimeOfferScreen');
      } else {
        navigateRoot('OneTimeOfferScreen');
      }
      return;
    }

    if (afterCloseNavigateTo) {
      try {
        navigateRoot(afterCloseNavigateTo);
        return;
      } catch {}
    }

    if (onClose) {
      onClose();
    } else if (navigation?.canGoBack()) {
      navigation.goBack();
    }
  }, [
    afterCloseNavigateTo,
    isPremium,
    navigation,
    onClose,
    onExit,
    showOneTimeAfterClose,
  ]);

  const animateDismiss = useCallback(() => {
    if (isClosingRef.current || exitCommittedRef.current) {
      return;
    }
    isClosingRef.current = true;
    setTransitionActive(true);

    const finishDismissal = () => {
      performClose();
    };
    closeFallbackTimerRef.current = setTimeout(finishDismissal, 400);

    Animated.timing(transitionProgress, {
      toValue: 0,
      duration: 220,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(finishDismissal);
  }, [performClose, transitionProgress]);

  useEffect(() => {
    return () => {
      if (closeFallbackTimerRef.current !== null) {
        clearTimeout(closeFallbackTimerRef.current);
        closeFallbackTimerRef.current = null;
      }
    };
  }, []);

  const handleClose = useCallback(() => {
    if (!closeReady) {
      return;
    }
    animateDismiss();
  }, [animateDismiss, closeReady]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        handleClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [handleClose]);

  const completePremiumFlow = useCallback(() => {
    justPurchasedRef.current = true;
    if (!premiumActionHandledRef.current) {
      premiumActionHandledRef.current = true;
      consumePendingPremiumAction();
    }
    animateDismiss();
  }, [animateDismiss]);

  useEffect(() => {
    if (!isPremium) {
      premiumActionHandledRef.current = false;
      return;
    }
    completePremiumFlow();
  }, [completePremiumFlow, isPremium]);

  const handleRestore = async () => {
    if (!paymentsEnabled) {
      Alert.alert(
        tr('paywall.unavailableTitle'),
        tr('paywall.unavailableMessage'),
      );
      return;
    }

    try {
      const info = await restorePurchases?.();
      onRestore?.();
      const entitlements = info?.entitlements?.active || {};
      if (Object.keys(entitlements).length > 0 || isPremium) {
        completePremiumFlow();
        return;
      }
      Alert.alert(
        tr('paywall.restoreEmptyTitle'),
        tr('paywall.restoreEmptyMessage'),
      );
    } catch {
      Alert.alert(
        tr('paywall.restoreFailedTitle'),
        tr('paywall.restoreFailedMessage'),
      );
    }
  };

  const handleContinue = async () => {
    if (purchaseLoading) {
      return;
    }
    if (!paymentsEnabled) {
      Alert.alert(
        tr('paywall.unavailableTitle'),
        tr('paywall.unavailableMessage'),
      );
      return;
    }

    let sourcePackages = availablePackages;
    let selectedPackage =
      selectedPlan === 'yearly'
        ? sourcePackages?.yearly
        : sourcePackages?.weekly;

    if (!selectedPackage && fetchOfferings) {
      sourcePackages = await fetchOfferings();
      selectedPackage =
        selectedPlan === 'yearly'
          ? sourcePackages?.yearly
          : sourcePackages?.weekly;
    }

    if (!selectedPackage) {
      Alert.alert(
        tr('paywall.productsUnavailableTitle'),
        tr('paywall.productsUnavailableMessage'),
      );
      return;
    }

    try {
      setPurchaseLoading(true);
      await purchasePackage?.(selectedPackage);
      completePremiumFlow();
    } catch (error) {
      const wasCancelled =
        error?.userCancelled === true ||
        error?.code === 'USER_CANCELLED' ||
        error?.code === 'PURCHASE_CANCELLED_ERROR';
      if (!wasCancelled) {
        Alert.alert(
          tr('paywall.purchaseFailedTitle'),
          tr('paywall.purchaseFailedMessage'),
        );
      }
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handleRetryOfferings = useCallback(() => {
    if (!paymentsEnabled || offeringsState === 'loading') {
      return;
    }
    offeringsAttemptedRef.current = true;
    try {
      fetchOfferings?.();
    } catch {}
  }, [fetchOfferings, offeringsState, paymentsEnabled]);

  const toggleTrial = () => {
    if (isBusy) {
      return;
    }
    if (trialEnabled && hasYearly) {
      setSelectedPlan('yearly');
    } else if (hasWeekly) {
      setSelectedPlan('weekly');
    }
  };

  const yearlyProduct = displayPackages.yearly?.product;
  const weeklyProduct = displayPackages.weekly?.product;
  const yearlyPrice =
    yearlyProduct?.priceString ||
    tr('paywall.plans.yearly.defaultPrice', { defaultValue: '' });
  const weeklyPrice =
    weeklyProduct?.priceString ||
    tr('paywall.plans.weekly.defaultPrice', { defaultValue: '' });
  // Numeric prices (same currency, locale-independent).
  const yearlyValue =
    typeof yearlyProduct?.price === 'number' ? yearlyProduct.price : null;
  const weeklyValue =
    typeof weeklyProduct?.price === 'number' ? weeklyProduct.price : null;

  // Format the annual plan's weekly equivalent with the store currency and
  // active locale. This preserves comma decimals and non-Latin digits.
  const yearlyPerWeekPrice = (() => {
    if (yearlyValue == null || yearlyValue <= 0) {
      return null;
    }
    const perWeek = yearlyValue / 52;
    const currencyCode = String(
      yearlyProduct?.currencyCode || yearlyProduct?.currency || 'USD',
    ).toUpperCase();
    try {
      return new Intl.NumberFormat(
        i18n?.resolvedLanguage || i18n?.language || undefined,
        {
          style: 'currency',
          currency: currencyCode,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      ).format(perWeek);
    } catch {
      return `${currencyCode} ${perWeek.toFixed(2)}`;
    }
  })();

  // Savings badge, calculated live from the annual vs. weekly price.
  const weeklyAnnualized = weeklyValue != null ? weeklyValue * 52 : null;
  const savePercent =
    yearlyValue != null &&
    yearlyValue > 0 &&
    weeklyAnnualized != null &&
    weeklyAnnualized > yearlyValue
      ? Math.round((1 - yearlyValue / weeklyAnnualized) * 100)
      : null;
  // Reuse the localized "Save 83%" wording and swap only the number, so every
  // language keeps its own phrasing. Hidden when it can't be computed.
  const saveBadge =
    savePercent != null
      ? tr('paywall.premium.saveBadge', { defaultValue: 'Save 83%' }).replace(
          /\d+/,
          String(savePercent),
        )
      : null;
  const plansAreUnavailable =
    !paymentsEnabled ||
    (!hasYearly && !hasWeekly && offeringsState === 'error') ||
    (offeringsState === 'ready' && !hasYearly && !hasWeekly);
  const premiumCopy = {
    headline: tr('paywall.premium.headline'),
    subtitle: `${tr('paywall.premium.subtitleLine1')}\n${tr(
      'paywall.premium.subtitleLine2',
    )}`,
    enableTrial: tr('paywall.premium.enableTrial'),
    annual: tr('paywall.premium.annual'),
    saveBadge,
    year: tr('paywall.premium.year'),
    week: tr('paywall.premium.week'),
    terms: tr('paywall.premium.termsOfUse'),
    privacy: tr('paywall.premium.privacyPolicy'),
  };
  const ctaLabel = trialEnabled
    ? tr('paywall.ctaFreeTrial', { defaultValue: 'Try It For Free' })
    : tr('paywall.cta', { defaultValue: 'Continue' });

  // Image Studio credits granted per plan (mirrors the legacy paywall).
  const imageStudioCredits = selectedPlan === 'yearly' ? 15000 : 600;
  const formattedImageStudioCredits = (() => {
    try {
      return new Intl.NumberFormat(
        i18n?.resolvedLanguage || i18n?.language || undefined,
        { maximumFractionDigits: 0 },
      ).format(imageStudioCredits);
    } catch {
      return String(imageStudioCredits).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
  })();
  const imageStudioPeriod = tr(
    `paywall.features.period.${
      selectedPlan === 'yearly' ? 'yearly' : 'weekly'
    }`,
    { defaultValue: selectedPlan === 'yearly' ? 'yearly' : 'weekly' },
  );
  const imageStudioTemplate = tr('paywall.features.imageStudio', {
    defaultValue: 'Get Image Studio {{credits}} credits {{period}}',
  }).replace('{{period}}', imageStudioPeriod);
  const [imageStudioLead, imageStudioTrail = ''] =
    imageStudioTemplate.split('{{credits}}');

  // The surface fades in as well as lifts. Onboarding stays mounted underneath
  // until onPresented fires, so this reads as a cross-fade out of the last
  // onboarding screen rather than the paywall snapping over it.
  const fullScreenTransitionStyle = {
    opacity: surfaceVisible ? transitionProgress : 0,
    transform: [
      {
        translateY: transitionProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
      {
        scale: transitionProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [1.02, 1],
        }),
      },
    ],
  };
  const v3Copy = (key, defaultValue, values = {}) =>
    tr(`paywall.v3.${key}`, { defaultValue, ...values });
  // Keep the original trial sentence intact for the legacy branch and its
  // purchase-presentation contract.
  // prettier-ignore
  const legacyWeeklyOfferTerms = `${tr('paywall.plans.weekly.trialThen')} ${weeklyPrice} / ${premiumCopy.week}`;

  if (USE_TIMELINE_PAYWALL) {
    const timelineHeadline = trialEnabled
      ? v3Copy('trial.headline', 'Unlock all premium features')
      : v3Copy('annual.headline', 'Unlock Cloud AI Premium');
    const timelineItems = trialEnabled
      ? [
          {
            icon: 'check-bold',
            title: v3Copy('trial.todayTitle', 'Today'),
            body: v3Copy(
              'trial.todayBody',
              'Unlock every premium feature. No payment is due now.',
            ),
          },
          {
            icon: 'calendar-check',
            title: v3Copy('trial.checkTitle', 'In 2 days — Reminder'),
            body: v3Copy(
              'trial.checkBody',
              "We'll send you a notification that your trial is ending soon.",
            ),
          },
          {
            icon: 'flag',
            title: v3Copy('trial.billingTitle', 'In 3 days'),
            body: v3Copy(
              'trial.billingBody',
              'Billing starts automatically unless you cancel anytime before.',
            ),
          },
        ]
      : [
          {
            icon: 'check-bold',
            title: v3Copy('annual.todayTitle', 'Today — premium starts'),
            body: v3Copy(
              'annual.todayBody',
              'Unlock every premium AI feature immediately.',
            ),
          },
          {
            icon: 'calendar-check',
            title: v3Copy('annual.billingTitle', 'Billed annually'),
            body: v3Copy(
              'annual.billingBody',
              '{{price}} gives you one full year of access.',
              { price: yearlyPrice },
            ),
          },
          {
            icon: 'flag',
            title: v3Copy('annual.renewalTitle', 'Renews yearly'),
            body: v3Copy(
              'annual.renewalBody',
              'Cancel anytime in Google Play before your renewal date.',
            ),
          },
        ];
    const timelineCtaLabel = trialEnabled
      ? v3Copy('trial.cta', 'Start My 3-Day Free Trial')
      : v3Copy('annual.cta', 'Continue');
    const closeRevealStyle = {
      opacity: closeRevealProgress,
      transform: [
        {
          scale: closeRevealProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.72, 1],
          }),
        },
      ],
    };
    const closeRingOffset = offerStoryProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [CLOSE_RING_CIRCUMFERENCE, 0],
    });

    return (
      <Animated.View
        renderToHardwareTextureAndroid={transitionActive}
        style={[styles.screen, styles.timelineScreen, fullScreenTransitionStyle]}
      >
        <StatusBar
          backgroundColor="transparent"
          barStyle="light-content"
          translucent
        />
        <Image
          fadeDuration={0}
          pointerEvents="none"
          resizeMethod="resize"
          resizeMode="cover"
          source={HERO_IMAGE}
          style={styles.timelineAtmosphere}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[
            'rgba(10,186,181,0.07)',
            'rgba(10,186,181,0.018)',
            EDITORIAL.background,
          ]}
          locations={[0, 0.3, 0.7]}
          style={styles.heroFade}
        />

        <View style={styles.chrome}>
          {closeReady ? (
            <Animated.View
              style={[
                styles.closeButton,
                { top: insets.top + CLOSE_CONTROL_TOP_GAP },
                closeRevealStyle,
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={tr('paywall.close')}
                onPress={handleClose}
                style={styles.closeButtonTouchTarget}
              >
                <View style={styles.timelineCloseButtonDisc}>
                  <CloseIcon color={EDITORIAL.title} size={14} />
                </View>
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <View
              pointerEvents="none"
              style={[
                styles.closeButton,
                { top: insets.top + CLOSE_CONTROL_TOP_GAP },
              ]}
            >
              <Svg height={CLOSE_CONTROL_SIZE} width={CLOSE_CONTROL_SIZE}>
                <Circle
                  cx={CLOSE_CONTROL_CENTER}
                  cy={CLOSE_CONTROL_CENTER}
                  fill="transparent"
                  r={CLOSE_RING_RADIUS}
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth={2}
                />
                <AnimatedCircle
                  cx={CLOSE_CONTROL_CENTER}
                  cy={CLOSE_CONTROL_CENTER}
                  fill="transparent"
                  origin={`${CLOSE_CONTROL_CENTER}, ${CLOSE_CONTROL_CENTER}`}
                  r={CLOSE_RING_RADIUS}
                  rotation="-90"
                  stroke={CLOSE_SPINNER_COLOR}
                  strokeDasharray={`${CLOSE_RING_CIRCUMFERENCE} ${CLOSE_RING_CIRCUMFERENCE}`}
                  strokeDashoffset={closeRingOffset}
                  strokeLinecap="round"
                  strokeWidth={2}
                />
              </Svg>
            </View>
          )}

          <ScrollView
            bounces={false}
            contentContainerStyle={[
              styles.timelineScrollContent,
              {
                paddingHorizontal: layout.horizontalPadding,
                paddingTop: insets.top + 66,
                paddingBottom: Math.max(insets.bottom + 8, 14),
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.timelineContent, { maxWidth: layout.contentWidth }]}>
              <View style={styles.timelineHeaderBlock}>
                <Text style={styles.timelineEyebrow}>
                  {v3Copy('eyebrow', 'CLOUD AI PREMIUM')}
                </Text>
                <View
                  style={[
                    styles.timelineHeadlineSlot,
                    layout.compact && styles.timelineHeadlineSlotCompact,
                  ]}
                >
                  <Text
                    adjustsFontSizeToFit
                    minimumFontScale={0.68}
                    numberOfLines={2}
                    style={[
                      styles.timelineHeadline,
                      layout.compact && styles.timelineHeadlineCompact,
                    ]}
                  >
                    {timelineHeadline}
                  </Text>
                </View>
              </View>

              <BillingTimeline
                compact={layout.compact}
                items={timelineItems}
                storyProgress={offerStoryProgress}
              />

              {pricingIsLoading ? (
                <View
                  accessibilityLiveRegion="polite"
                  style={styles.timelinePriceLoadingCard}
                >
                  <ActivityIndicator color={EDITORIAL.cream} size="small" />
                  <Text
                    style={[
                      styles.priceLoadingText,
                      styles.timelinePriceLoadingText,
                    ]}
                  >
                    {tr('chat.loading')}
                  </Text>
                </View>
              ) : plansAreUnavailable ? (
                <View
                  style={[styles.unavailableCard, styles.timelineUnavailableCard]}
                >
                  <Text
                    style={[
                      styles.unavailableTitle,
                      styles.timelineUnavailableTitle,
                    ]}
                  >
                    {tr('paywall.productsUnavailableTitle')}
                  </Text>
                  <Text
                    style={[
                      styles.unavailableMessage,
                      styles.timelineUnavailableMessage,
                    ]}
                  >
                    {tr('paywall.productsUnavailableMessage')}
                  </Text>
                  {paymentsEnabled && offeringsState === 'error' ? (
                    <TouchableOpacity
                      accessibilityRole="button"
                      activeOpacity={0.8}
                      onPress={handleRetryOfferings}
                      style={[styles.retryButton, styles.timelineRetryButton]}
                    >
                      <Text
                        style={[
                          styles.retryButtonText,
                          styles.timelineRetryButtonText,
                        ]}
                      >
                        {tr('common.retry')}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <View style={styles.timelinePlans} accessibilityRole="radiogroup">
                  {hasYearly ? (
                    <TimelinePlanCard
                      badge={premiumCopy.saveBadge}
                      onPress={() => !isBusy && setSelectedPlan('yearly')}
                      period={
                        yearlyPerWeekPrice
                          ? premiumCopy.week
                          : premiumCopy.year
                      }
                      price={yearlyPerWeekPrice || yearlyPrice}
                      secondary={
                        yearlyPerWeekPrice
                          ? `${yearlyPrice} / ${premiumCopy.year}`
                          : null
                      }
                      selected={selectedPlan === 'yearly'}
                      title={premiumCopy.annual}
                    />
                  ) : null}
                  {hasWeekly ? (
                    <TimelinePlanCard
                      badge={
                        weeklyHasFreeTrial
                          ? v3Copy('trial.badge', '3 DAYS FREE')
                          : null
                      }
                      onPress={() => !isBusy && setSelectedPlan('weekly')}
                      period={premiumCopy.week}
                      price={weeklyPrice}
                      selected={selectedPlan === 'weekly'}
                      secondary={
                        weeklyHasFreeTrial
                          ? v3Copy('trial.cardNote', 'After the free trial')
                          : tr('paywall.plans.weekly.subtitle')
                      }
                      title={tr('paywall.plans.weekly.title')}
                    />
                  ) : null}
                </View>
              )}

              <View
                accessibilityElementsHidden={!trialEnabled}
                importantForAccessibility={
                  trialEnabled ? 'auto' : 'no-hide-descendants'
                }
                style={[
                  styles.timelineNoPaymentRow,
                  (!trialEnabled || plansAreUnavailable) &&
                    styles.timelineNoPaymentRowHidden,
                ]}
              >
                <SvgIcon
                  color={EDITORIAL.body}
                  name="lock-bold"
                  size={16}
                />
                <Text style={styles.timelineNoPaymentText}>
                  {v3Copy('trial.noPayment', 'No Payment Due Now')}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                accessibilityRole="button"
                disabled={
                  isBusy || plansAreUnavailable || !selectedNativePackage
                }
                onPress={handleContinue}
                style={[
                  styles.timelineCtaButton,
                  (isBusy || plansAreUnavailable || !selectedNativePackage) &&
                    styles.disabled,
                ]}
              >
                <LinearGradient
                  colors={[EDITORIAL.accent, EDITORIAL.accent]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.timelineCtaGradient}
                >
                  {purchaseLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text
                      adjustsFontSizeToFit
                      minimumFontScale={0.78}
                      numberOfLines={1}
                      style={styles.timelineCtaText}
                    >
                      {timelineCtaLabel}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.legalRow}>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    Linking.openURL('https://aicloudsolutions.app/terms')
                  }
                  style={styles.legalButton}
                >
                  <Text style={styles.timelineLegalText}>
                    {premiumCopy.terms}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.75}
                  accessibilityState={{
                    disabled:
                      purchaseLoading || restoring || !subscriptionReady,
                  }}
                  disabled={purchaseLoading || restoring || !subscriptionReady}
                  onPress={handleRestore}
                  style={styles.legalButton}
                >
                  {restoring ? (
                    <ActivityIndicator color={EDITORIAL.body} size="small" />
                  ) : (
                    <Text style={styles.timelineLegalText}>
                      {tr('paywall.restore')}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() =>
                    Linking.openURL(
                      'https://aicloudsolutions.app/privacy/chatcloud',
                    )
                  }
                  style={styles.legalButton}
                >
                  <Text style={styles.timelineLegalText}>
                    {premiumCopy.privacy}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Animated.View>
    );
  }

  // Legacy paywall presentation preserved intentionally for instant rollback.
  return (
    <Animated.View
      renderToHardwareTextureAndroid={transitionActive}
      style={[styles.screen, fullScreenTransitionStyle]}
    >
      <StatusBar
        backgroundColor="transparent"
        barStyle="light-content"
        translucent
      />
      <Image
        fadeDuration={0}
        onError={() => setHeroSurfaceReady(true)}
        onLoad={() => setHeroSurfaceReady(true)}
        source={LEGACY_HERO_IMAGE}
        resizeMethod="resize"
        resizeMode="cover"
        style={styles.heroImage}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(0,0,0,0.06)',
          'rgba(0,0,0,0.13)',
          'rgba(3,4,5,0.83)',
          COLORS.background,
        ]}
        locations={[0, 0.36, 0.53, 0.64]}
        style={styles.heroFade}
      />

      <View style={styles.chrome}>
        {closeReady ? (
          <TouchableOpacity
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={tr('paywall.close')}
            onPress={handleClose}
            style={[styles.closeButton, { top: insets.top + 30 }]}
          >
            <View style={styles.closeButtonDisc}>
              <CloseIcon size={14} />
            </View>
          </TouchableOpacity>
        ) : null}

        <View
          style={[
            styles.staticBody,
            {
              paddingHorizontal: layout.horizontalPadding,
              paddingTop: insets.top + 16,
              paddingBottom: Math.max(insets.bottom + 8, 16),
            },
          ]}
        >
          <View style={styles.topSpacer} />
          <View style={[styles.content, { maxWidth: layout.contentWidth }]}>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.86}
              numberOfLines={1}
              style={[styles.headline, { fontSize: layout.titleSize }]}
            >
              {premiumCopy.headline}
            </Text>
            <Text style={[styles.subtitle, { fontSize: layout.subtitleSize }]}>
              {premiumCopy.subtitle}
            </Text>

            {IMAGE_STUDIO_ENABLED ? (
            <View style={styles.imageStudioBanner}>
              <ImageStudioIcon size={17} />
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                numberOfLines={1}
                style={styles.imageStudioText}
              >
                {imageStudioLead}
                <Text style={styles.imageStudioCredits}>
                  {formattedImageStudioCredits}
                </Text>
                {imageStudioTrail}
              </Text>
            </View>
            ) : null}

            <View style={{ height: layout.heroToTrialSpacing }} />

            {weeklyHasFreeTrial ? (
              <View style={styles.trialRow}>
                <Text style={styles.trialLabel} numberOfLines={2}>
                  {premiumCopy.enableTrial}
                </Text>
                <TrialSwitch
                  disabled={isBusy || !hasWeekly}
                  onPress={toggleTrial}
                  value={trialEnabled}
                />
              </View>
            ) : null}

            {pricingIsLoading ? (
              <View
                accessibilityLiveRegion="polite"
                style={styles.priceLoadingCard}
              >
                <ActivityIndicator color={COLORS.accent} size="small" />
                <Text style={styles.priceLoadingText}>
                  {tr('chat.loading')}
                </Text>
              </View>
            ) : plansAreUnavailable ? (
              <View style={styles.unavailableCard}>
                <Text style={styles.unavailableTitle}>
                  {tr('paywall.productsUnavailableTitle')}
                </Text>
                <Text style={styles.unavailableMessage}>
                  {tr('paywall.productsUnavailableMessage')}
                </Text>
                {paymentsEnabled && offeringsState === 'error' ? (
                  <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.8}
                    onPress={handleRetryOfferings}
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryButtonText}>
                      {tr('common.retry')}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <View style={styles.plans} accessibilityRole="radiogroup">
                {hasYearly && (
                  <PlanCard
                    badge={premiumCopy.saveBadge}
                    compact={layout.compact}
                    onPress={() => !isBusy && setSelectedPlan('yearly')}
                    period={premiumCopy.year}
                    price={yearlyPrice}
                    selected={selectedPlan === 'yearly'}
                    supportingText={
                      yearlyPerWeekPrice
                        ? `${yearlyPerWeekPrice} / ${premiumCopy.week}`
                        : null
                    }
                    title={premiumCopy.annual}
                  />
                )}
                {hasWeekly && (
                  <PlanCard
                    compact={layout.compact}
                    onPress={() => !isBusy && setSelectedPlan('weekly')}
                    period={premiumCopy.week}
                    price={weeklyPrice}
                    selected={selectedPlan === 'weekly'}
                    supportingText={
                      weeklyHasFreeTrial
                        ? null
                        : tr('paywall.plans.weekly.subtitle')
                    }
                    title={tr('paywall.plans.weekly.title')}
                  />
                )}
              </View>
            )}

                {trialEnabled ? (
                  <Text style={styles.offerTermsPrimary}>
                    {legacyWeeklyOfferTerms}
                  </Text>
            ) : null}
            <TouchableOpacity
              accessibilityRole="link"
              activeOpacity={0.75}
              onPress={() => Linking.openURL(PLAY_SUBSCRIPTIONS_URL)}
              style={styles.manageSubscriptionLink}
            >
              <Text style={styles.offerTermsSecondary}>
                {`${tr('paywall.plans.weekly.subtitle')} · Google Play`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              accessibilityRole="button"
              disabled={isBusy || plansAreUnavailable || !selectedNativePackage}
              onPress={handleContinue}
              style={[
                styles.ctaButton,
                (isBusy || plansAreUnavailable || !selectedNativePackage) &&
                  styles.disabled,
              ]}
            >
              <LinearGradient
                colors={[COLORS.ctaStart, COLORS.ctaEnd]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.ctaGradient}
              >
                {purchaseLoading ? (
                  <ActivityIndicator color={COLORS.primaryText} />
                ) : (
                  <Text style={styles.ctaText}>{ctaLabel}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.legalRow}>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() =>
                  Linking.openURL('https://aicloudsolutions.app/terms')
                }
                style={styles.legalButton}
              >
                <Text style={styles.legalText}>{premiumCopy.terms}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.75}
                accessibilityState={{
                  disabled: purchaseLoading || restoring || !subscriptionReady,
                }}
                disabled={purchaseLoading || restoring || !subscriptionReady}
                onPress={handleRestore}
                style={styles.legalButton}
              >
                {restoring ? (
                  <ActivityIndicator color={COLORS.mutedText} size="small" />
                ) : (
                  <Text style={styles.legalText}>{tr('paywall.restore')}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() =>
                  Linking.openURL(
                    'https://aicloudsolutions.app/privacy/chatcloud',
                  )
                }
                style={styles.legalButton}
              >
                <Text style={styles.legalText}>{premiumCopy.privacy}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export function StandalonePremiumPaywallScreen({ routeParams, ...props }) {
  return (
    <PremiumPaywallContent
      {...props}
      navigation={null}
      route={{ params: routeParams || {} }}
    />
  );
}

export default function PremiumPaywallScreen(props) {
  const navigation = useNavigation();
  const route = useRoute();
  return (
    <PremiumPaywallContent {...props} navigation={navigation} route={route} />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  v2Screen: {
    backgroundColor: EDITORIAL.background,
  },
  timelineScreen: {
    backgroundColor: EDITORIAL.background,
  },
  chrome: {
    ...StyleSheet.absoluteFillObject,
  },
  heroImage: {
    position: 'absolute',
    top: '-3%',
    right: 0,
    bottom: '-1%',
    left: 0,
    width: '100%',
    height: '104%',
  },
  v2HeroImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    width: '100%',
    height: '64%',
  },
  timelineAtmosphere: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    width: '100%',
    height: '48%',
    opacity: 0.18,
  },
  heroFade: {
    ...StyleSheet.absoluteFillObject,
  },
  closeButton: {
    position: 'absolute',
    left: 12,
    zIndex: 5,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonTouchTarget: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonDisc: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  v2CloseButtonDisc: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(5,7,10,0.42)',
  },
  timelineCloseButtonDisc: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  staticBody: {
    flex: 1,
    width: '100%',
  },
  topSpacer: {
    flex: 1,
    minHeight: 8,
  },
  v2TopSpacer: {
    flex: 1,
    minHeight: 150,
  },
  v2TopSpacerCompact: {
    minHeight: 92,
  },
  content: {
    width: '100%',
    alignSelf: 'center',
  },
  timelineScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  timelineContent: {
    width: '100%',
    alignSelf: 'center',
  },
  timelineHeaderBlock: {
    width: '100%',
  },
  timelineEyebrow: {
    color: EDITORIAL.body,
    fontFamily: 'Lato-Bold',
    fontSize: 11,
    letterSpacing: 2.4,
    textAlign: 'center',
  },
  timelineHeadline: {
    alignSelf: 'center',
    maxWidth: 430,
    color: EDITORIAL.title,
    fontFamily: 'Lato-Bold',
    fontSize: 31,
    fontWeight: '700',
    lineHeight: 36,
    letterSpacing: -0.9,
    textAlign: 'center',
  },
  timelineHeadlineCompact: {
    fontSize: 27,
    lineHeight: 31,
  },
  timelineHeadlineSlot: {
    height: 68,
    marginTop: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineHeadlineSlotCompact: {
    height: 58,
  },
  timelineSubtitleSlot: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineSubtitle: {
    color: EDITORIAL.body,
    fontFamily: 'Lato-Regular',
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
  },
  billingTimeline: {
    width: '100%',
    alignSelf: 'center',
    marginTop: 20,
    paddingTop: 5,
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  billingTimelineCompact: {
    marginTop: 14,
    paddingTop: 3,
  },
  billingTimelineRow: {
    height: 76,
    flexDirection: 'row',
  },
  billingTimelineRowCompact: {
    height: 68,
  },
  billingTimelineRail: {
    width: 38,
    alignItems: 'center',
  },
  billingTimelineDotWrap: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billingTimelineHalo: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(10,186,181,0.34)',
  },
  billingTimelineDot: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: EDITORIAL.accent,
  },
  billingTimelineDotMiddle: {
    backgroundColor: EDITORIAL.violet,
  },
  billingTimelineDotFinal: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    backgroundColor: EDITORIAL.background,
  },
  billingTimelineLine: {
    flex: 1,
    width: 6,
    marginVertical: -1,
    borderRadius: 3,
    backgroundColor: 'rgba(10,186,181,0.34)',
  },
  billingTimelineTail: {
    flex: 1,
    width: 6,
    minHeight: 22,
    marginTop: -1,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  billingTimelineCopy: {
    flex: 1,
    paddingLeft: 14,
    paddingRight: 4,
    paddingBottom: 14,
  },
  billingTimelineTitle: {
    color: EDITORIAL.title,
    fontFamily: 'Lato-Bold',
    fontSize: 17,
    lineHeight: 21,
  },
  billingTimelineBody: {
    marginTop: 4,
    color: EDITORIAL.body,
    fontFamily: 'Lato-Regular',
    fontSize: 13,
    lineHeight: 17,
  },
  timelinePlans: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    paddingTop: 10,
  },
  timelinePlanCard: {
    flex: 1,
    minWidth: 0,
    height: 106,
    paddingHorizontal: 13,
    paddingTop: 14,
    paddingBottom: 11,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: EDITORIAL.border,
    backgroundColor: EDITORIAL.surface,
  },
  timelinePlanCardSelected: {
    borderWidth: 1,
  },
  timelinePlanCardSelectedCyan: {
    borderColor: EDITORIAL.accent,
    backgroundColor: EDITORIAL.surface,
  },
  timelinePlanCardSelectedViolet: {
    borderColor: EDITORIAL.violet,
    backgroundColor: EDITORIAL.violetSoft,
  },
  timelinePlanBadge: {
    position: 'absolute',
    top: -11,
    right: 10,
    maxWidth: '84%',
    height: 22,
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: EDITORIAL.border,
    backgroundColor: EDITORIAL.background,
  },
  timelinePlanBadgeSelected: {
    borderColor: 'transparent',
  },
  timelinePlanBadgeSelectedCyan: {
    backgroundColor: EDITORIAL.accent,
  },
  timelinePlanBadgeSelectedViolet: {
    backgroundColor: EDITORIAL.violet,
  },
  timelinePlanBadgeText: {
    color: EDITORIAL.cream,
    fontFamily: 'Lato-Bold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  timelinePlanBadgeTextSelected: {
    color: EDITORIAL.onCream,
  },
  timelinePlanHeader: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelinePlanTitle: {
    flex: 1,
    color: EDITORIAL.title,
    fontFamily: 'Lato-Bold',
    fontSize: 15,
  },
  timelinePlanPriceRow: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 9,
  },
  timelinePlanPrice: {
    flexShrink: 1,
    color: EDITORIAL.title,
    fontFamily: 'Lato-Bold',
    fontSize: 17,
    lineHeight: 20,
  },
  timelinePlanPeriod: {
    flexShrink: 1,
    color: EDITORIAL.body,
    fontFamily: 'Lato-Regular',
    fontSize: 10,
  },
  timelinePlanSecondary: {
    marginTop: 3,
    color: EDITORIAL.body,
    fontFamily: 'Lato-Regular',
    fontSize: 10,
    lineHeight: 13,
  },
  timelinePriceLoadingCard: {
    height: 112,
    marginTop: 17,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: EDITORIAL.border,
    backgroundColor: EDITORIAL.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  timelineNoPaymentRow: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 11,
  },
  timelineNoPaymentRowHidden: {
    opacity: 0,
  },
  timelineNoPaymentText: {
    color: EDITORIAL.title,
    fontFamily: 'Lato-Bold',
    fontSize: 14,
  },
  timelineCtaButton: {
    height: 56,
    marginTop: 20,
    overflow: 'hidden',
    borderRadius: 28,
    backgroundColor: EDITORIAL.accent,
  },
  timelineCtaGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 28,
  },
  timelineCtaText: {
    color: '#FFFFFF',
    fontFamily: 'Lato-Bold',
    fontSize: 16,
    fontWeight: '700',
  },
  timelineRenewalLink: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  timelineRenewalText: {
    color: EDITORIAL.body,
    fontFamily: 'Lato-Regular',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  timelinePriceLoadingText: {
    color: EDITORIAL.body,
  },
  timelineUnavailableCard: {
    borderColor: EDITORIAL.border,
    backgroundColor: EDITORIAL.surface,
  },
  timelineUnavailableTitle: {
    color: EDITORIAL.title,
  },
  timelineUnavailableMessage: {
    color: EDITORIAL.body,
  },
  timelineRetryButton: {
    borderColor: EDITORIAL.accent,
  },
  timelineRetryButtonText: {
    color: EDITORIAL.accent,
  },
  timelineLegalText: {
    color: EDITORIAL.body,
    fontFamily: 'Lato-Regular',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  headline: {
    color: COLORS.accent,
    fontFamily: 'Lato-Bold',
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.55,
    textAlign: 'center',
  },
  v2EyebrowRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 7,
  },
  v2EyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: EDITORIAL.cream,
  },
  v2Eyebrow: {
    color: EDITORIAL.body,
    fontFamily: 'Lato-Bold',
    fontSize: 11,
    letterSpacing: 2.5,
  },
  v2Headline: {
    alignSelf: 'center',
    maxWidth: 430,
    color: EDITORIAL.title,
    fontFamily: 'Lato-Bold',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 37,
    letterSpacing: -1,
    textAlign: 'center',
  },
  v2HeadlineCompact: {
    fontSize: 27,
    lineHeight: 31,
  },
  v2Subtitle: {
    marginTop: 5,
    color: EDITORIAL.body,
    fontFamily: 'Lato-Bold',
    fontSize: 14,
    lineHeight: 19,
    textAlign: 'center',
  },
  v2SubtitleCompact: {
    fontSize: 13,
    lineHeight: 17,
  },
  valuePillRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 11,
  },
  valuePill: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 29,
    paddingHorizontal: 8,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(173,188,211,0.15)',
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  valuePillIcon: {
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valuePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: EDITORIAL.cream,
  },
  valuePillText: {
    color: '#C5CDDA',
    fontFamily: 'Lato-Bold',
    fontSize: 10,
  },
  v2CreditsBanner: {
    alignSelf: 'center',
    maxWidth: '100%',
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(44,229,216,0.24)',
    backgroundColor: 'rgba(34,211,199,0.07)',
  },
  v2CreditsNumber: {
    color: EDITORIAL.title,
    fontFamily: 'Lato-Bold',
  },
  v2CreditsText: {
    flexShrink: 1,
    color: EDITORIAL.body,
    fontFamily: 'Lato-Bold',
    fontSize: 12,
  },
  subtitle: {
    marginTop: 3,
    color: COLORS.secondaryText,
    fontFamily: 'Lato-Regular',
    lineHeight: 22,
    textAlign: 'center',
  },
  imageStudioBanner: {
    marginTop: 12,
    alignSelf: 'center',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 34,
    paddingLeft: 13,
    paddingRight: 16,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(25,213,208,0.38)',
    backgroundColor: 'rgba(25,213,208,0.09)',
  },
  imageStudioText: {
    flexShrink: 1,
    color: COLORS.primaryText,
    fontFamily: 'Lato-Regular',
    fontSize: 14,
  },
  imageStudioCredits: {
    color: COLORS.accent,
    fontFamily: 'Lato-Bold',
    fontWeight: '700',
  },
  trialRow: {
    width: '86%',
    minWidth: 250,
    maxWidth: 360,
    minHeight: 44,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 19,
    paddingRight: 12,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(92,96,98,0.25)',
    backgroundColor: COLORS.control,
  },
  trialLabel: {
    flex: 1,
    marginRight: 12,
    color: COLORS.primaryText,
    fontFamily: 'Lato-Bold',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  switchTrack: {
    flexShrink: 0,
    width: 60,
    height: 32,
    padding: 3,
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: COLORS.accent,
  },
  switchTrackOff: {
    backgroundColor: '#4A4E50',
  },
  switchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FAFAFA',
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
  },
  plans: {
    marginTop: 15,
    gap: 8,
  },
  noPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 10,
  },
  noPaymentText: {
    color: EDITORIAL.title,
    fontFamily: 'Lato-Bold',
    fontSize: 13,
  },
  timeline: {
    marginTop: 14,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  timelineRail: {
    width: 26,
    alignItems: 'center',
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EDITORIAL.cream,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    marginVertical: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(244,240,232,0.22)',
  },
  timelineCopy: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 14,
  },
  timelineTitle: {
    color: EDITORIAL.title,
    fontFamily: 'Lato-Bold',
    fontSize: 14,
  },
  timelineBody: {
    marginTop: 2,
    color: EDITORIAL.body,
    fontFamily: 'Lato-Regular',
    fontSize: 12,
    lineHeight: 17,
  },
  v2Plans: {
    marginTop: 12,
    gap: 8,
  },
  v2PriceLoadingCard: {
    height: 142,
    marginTop: 12,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: COLORS.controlBorder,
    backgroundColor: 'rgba(10,14,20,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  priceLoadingCard: {
    height: 152,
    marginTop: 15,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: COLORS.controlBorder,
    backgroundColor: 'rgba(15,17,18,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  priceLoadingText: {
    color: COLORS.secondaryText,
    fontFamily: 'Lato-Regular',
    fontSize: 14,
  },
  planCard: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 17,
    paddingVertical: 10,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: COLORS.controlBorder,
    backgroundColor: 'rgba(15,17,18,0.9)',
  },
  planCardCompact: {
    minHeight: 66,
    paddingVertical: 8,
  },
  planCardSelected: {
    borderWidth: 2,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.selectedControl,
    shadowColor: COLORS.accentBright,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 8,
    elevation: 5,
  },
  planIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioOuter: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#5C6163',
  },
  planCardEditorial: {
    borderRadius: 18,
    borderColor: EDITORIAL.border,
    backgroundColor: EDITORIAL.surface,
  },
  planCardEditorialSelected: {
    borderColor: EDITORIAL.cream,
    backgroundColor: 'rgba(244,240,232,0.10)',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    elevation: 2,
  },
  radioOuterEditorial: {
    borderColor: EDITORIAL.cream,
  },
  radioInnerEditorial: {
    backgroundColor: EDITORIAL.cream,
  },
  annualPriceEditorial: {
    color: EDITORIAL.title,
  },
  radioOuterSelected: {
    borderColor: COLORS.accent,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },
  planCopy: {
    flexShrink: 1,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  planTitle: {
    color: COLORS.primaryText,
    fontFamily: 'Lato-Bold',
    fontSize: 18,
    fontWeight: '700',
  },
  savingsBadge: {
    height: 23,
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  savingsBadgeText: {
    color: '#103934',
    fontFamily: 'Lato-Bold',
    fontSize: 11,
    fontWeight: '700',
  },
  supportingText: {
    marginTop: 2,
    color: COLORS.secondaryText,
    fontFamily: 'Lato-Regular',
    fontSize: 15,
    lineHeight: 18,
  },
  supportingTextEditorial: {
    color: EDITORIAL.title,
    backgroundColor: 'transparent',
  },
  supportingTextSelected: {
    color: COLORS.accent,
  },
  priceColumn: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  planPrice: {
    color: COLORS.primaryText,
    fontFamily: 'Lato-Bold',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 21,
  },
  annualPrice: {
    color: COLORS.accent,
  },
  planPeriod: {
    marginTop: 1,
    color: COLORS.secondaryText,
    fontFamily: 'Lato-Regular',
    fontSize: 12,
  },
  offerTermsPrimary: {
    marginTop: 10,
    color: COLORS.primaryText,
    fontFamily: 'Lato-Bold',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    textAlign: 'center',
  },
  manageSubscriptionLink: {
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  offerTermsSecondary: {
    color: COLORS.secondaryText,
    fontFamily: 'Lato-Regular',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  v2OfferTerms: {
    color: EDITORIAL.body,
    fontFamily: 'Lato-Bold',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  unavailableCard: {
    minHeight: 154,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    paddingHorizontal: 24,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: COLORS.controlBorder,
    backgroundColor: COLORS.control,
  },
  unavailableTitle: {
    color: COLORS.primaryText,
    fontFamily: 'Lato-Bold',
    fontSize: 16,
    textAlign: 'center',
  },
  unavailableMessage: {
    marginTop: 6,
    color: COLORS.secondaryText,
    fontFamily: 'Lato-Regular',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    minWidth: 96,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  retryButtonText: {
    color: COLORS.accentBright,
    fontFamily: 'Lato-Bold',
    fontSize: 13,
  },
  ctaButton: {
    height: 48,
    marginTop: 4,
    overflow: 'hidden',
    borderRadius: 27,
  },
  v2CtaButton: {
    height: 56,
    marginTop: 3,
    overflow: 'hidden',
    borderRadius: 28,
    backgroundColor: EDITORIAL.cream,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  v2CtaGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 28,
  },
  v2CtaText: {
    color: EDITORIAL.onCream,
    fontFamily: 'Lato-Bold',
    fontSize: 16,
    fontWeight: '700',
  },
  ctaGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 27,
  },
  ctaText: {
    color: COLORS.primaryText,
    fontFamily: 'Lato-Bold',
    fontSize: 18,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.58,
  },
  legalRow: {
    minHeight: 39,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  legalButton: {
    flex: 1,
    minHeight: 39,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalText: {
    color: COLORS.mutedText,
    fontFamily: 'Lato-Regular',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});

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
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';

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

const HERO_IMAGE = require('../../assets/images/paywall/PaywallGirls.webp');
const HERO_SURFACE_FALLBACK_MS = 1500;
const PLAY_SUBSCRIPTIONS_URL =
  'https://play.google.com/store/account/subscriptions';

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

const clamp = (value, minimum, maximum) =>
  Math.min(Math.max(value, minimum), maximum);

export function shouldStartPaywallEntrance({
  heroSurfaceReady,
  isPremium,
  isClosing,
}) {
  return heroSurfaceReady && !isPremium && !isClosing;
}

function CloseIcon({ size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M6 6l12 12M18 6 6 18"
        fill="none"
        stroke={COLORS.primaryText}
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

function SelectionRadio({ selected }) {
  return (
    <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
      {selected ? <View style={styles.radioInner} /> : null}
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
  selected,
  onPress,
  compact,
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
      ]}
    >
      <View style={styles.planIdentity}>
        <SelectionRadio selected={selected} />
        <View style={styles.planCopy}>
          <View style={styles.planTitleRow}>
            <Text style={styles.planTitle}>{title}</Text>
            {badge ? (
              <LinearGradient
                colors={['#77E7C0', '#5DD7C1']}
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
              ]}
            >
              {supportingText}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.priceColumn}>
        <Text style={[styles.planPrice, !selected && styles.annualPrice]}>
          {price}
        </Text>
        <Text style={styles.planPeriod}>{period}</Text>
      </View>
    </TouchableOpacity>
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
  const showOneTimeAfterClose = route.params?.showOneTimeOfferAfterClose;
  const afterCloseNavigateTo = route.params?.afterCloseNavigateTo;
  const delayCloseForPaywall = shouldDelayPaywallClose(route.params);

  const [selectedPlan, setSelectedPlan] = useState('weekly');
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [closeReady, setCloseReady] = useState(!delayCloseForPaywall);
  const [heroSurfaceReady, setHeroSurfaceReady] = useState(false);
  const [surfaceVisible, setSurfaceVisible] = useState(false);
  const [transitionActive, setTransitionActive] = useState(true);
  const [closing, setClosing] = useState(false);

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
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    let frameId = requestAnimationFrame(() => {
      frameId = requestAnimationFrame(() => {
        setSurfaceVisible(true);
        frameId = requestAnimationFrame(() => {
          animation.start(({ finished }) => {
            if (finished) {
              setTransitionActive(false);
              onPresented?.();
            }
          });
        });
      });
    });
    return () => {
      cancelAnimationFrame(frameId);
      animation.stop();
    };
  }, [
    heroSurfaceReady,
    isPremium,
    onPresented,
    transitionProgress,
  ]);

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
  }, [delayCloseForPaywall]);

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
    setClosing(true);
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
      return String(imageStudioCredits).replace(
        /\B(?=(\d{3})+(?!\d))/g,
        ',',
      );
    }
  })();
  const imageStudioPeriod = tr(
    `paywall.features.period.${selectedPlan === 'yearly' ? 'yearly' : 'weekly'}`,
    { defaultValue: selectedPlan === 'yearly' ? 'yearly' : 'weekly' },
  );
  const imageStudioTemplate = tr('paywall.features.imageStudio', {
    defaultValue: 'Get Image Studio {{credits}} credits {{period}}',
  }).replace('{{period}}', imageStudioPeriod);
  const [imageStudioLead, imageStudioTrail = ''] =
    imageStudioTemplate.split('{{credits}}');

  const fullScreenTransitionStyle = {
    opacity: surfaceVisible ? (closing ? transitionProgress : 1) : 0,
    transform: [
      {
        translateY: transitionProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
      {
        scale: transitionProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [1.012, 1],
        }),
      },
    ],
  };

  return (
    <Animated.View
      renderToHardwareTextureAndroid={transitionActive}
      style={[styles.screen, fullScreenTransitionStyle]}>
      <StatusBar
        backgroundColor="transparent"
        barStyle="light-content"
        translucent
      />
      <Image
        fadeDuration={0}
        onError={() => setHeroSurfaceReady(true)}
        onLoad={() => setHeroSurfaceReady(true)}
        source={HERO_IMAGE}
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
              style={styles.priceLoadingCard}>
              <ActivityIndicator color={COLORS.accent} size="small" />
              <Text style={styles.priceLoadingText}>{tr('chat.loading')}</Text>
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
                  style={styles.retryButton}>
                  <Text style={styles.retryButtonText}>{tr('common.retry')}</Text>
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
              {`${tr('paywall.plans.weekly.trialThen')} ${weeklyPrice} / ${premiumCopy.week}`}
            </Text>
          ) : null}
          <TouchableOpacity
            accessibilityRole="link"
            activeOpacity={0.75}
            onPress={() => Linking.openURL(PLAY_SUBSCRIPTIONS_URL)}
            style={styles.manageSubscriptionLink}>
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
    <PremiumPaywallContent
      {...props}
      navigation={navigation}
      route={route}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  closeButtonDisc: {
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
  content: {
    width: '100%',
    alignSelf: 'center',
  },
  headline: {
    color: COLORS.accent,
    fontFamily: 'Lato-Bold',
    fontWeight: '700',
    lineHeight: 38,
    letterSpacing: -0.55,
    textAlign: 'center',
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

// SubscriptionScreen.js
import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Platform,
  Animated,
  ActivityIndicator,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import {
  useNavigation,
  useFocusEffect,
  useRoute,
} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import MaskedViewIOS from '@react-native-masked-view/masked-view';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import SvgIcon from './SvgIcon';
import { SubscriptionContext } from '../context/SubscriptionContext';
import { useTranslation } from 'react-i18next';
import {
  consumePendingPremiumAction,
  clearPendingPremiumAction,
} from '../state/premiumActions';
import {
  navigate as navigateRoot,
  navigationRef,
} from '../navigation/rootNavigation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONE_TIME_OFFER_KEY } from '../constants/storageKeys';
import { ONE_TIME_OFFER_PAYWALL_ENABLED } from '../constants/featureFlags';
// Custom SVG Icons
const CloseIcon = ({ color = '#FFFFFF', size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
  </Svg>
);

const CreateImagesIcon = ({ color = '#75FB4C', size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M280-240v-480h80v480h-80ZM440-80v-800h80v800h-80ZM120-400v-160h80v160h-80Zm480 160v-480h80v480h-80Zm160-160v-160h80v160h-80Z" />
  </Svg>
);
const WEEKS_PER_PERIOD_UNIT = {
  DAY: 1 / 7,
  WEEK: 1,
  MONTH: 4,
  YEAR: 52,
};

function parseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.replace(/[^\d.]/g, '');
  if (!normalized) {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractPriceValue(product) {
  if (!product) {
    return null;
  }
  const direct = parseNumber(product.price);
  if (direct !== null) {
    return direct;
  }
  const candidateStrings = [
    product.priceString,
    product.localizedPriceString,
    product.introductoryPrice?.priceString,
  ];
  for (const candidate of candidateStrings) {
    const parsed = parseNumber(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function formatWeeklyEquivalent(product) {
  const price = extractPriceValue(product);
  const currencyCode = String(
    product?.currencyCode || product?.currency || 'USD',
  ).toUpperCase();
  const subscriptionPeriod = product?.subscriptionPeriod || {};
  const unit = (subscriptionPeriod.unit || 'YEAR').toUpperCase();
  const weeksPerUnit =
    WEEKS_PER_PERIOD_UNIT[unit] || WEEKS_PER_PERIOD_UNIT.YEAR;
  const numberOfUnits = subscriptionPeriod.numberOfUnits || 1;
  if (!price || !currencyCode || !weeksPerUnit || !numberOfUnits) {
    return null;
  }
  const totalWeeks = weeksPerUnit * numberOfUnits;
  const value = price / totalWeeks;
  if (!Number.isFinite(value)) {
    return null;
  }
  // Use currency code (e.g., "USD 1.15") to match RevenueCat's `priceString` format
  // and avoid symbol-only output like "$1.15".
  return `${currencyCode} ${value.toFixed(2)}`;
}

function interpolatePrice(text = '', price = '') {
  if (!text || !price) return text;
  const placeholder = /{{\s*price\s*}}|{\s*price\s*}/g;
  return text.replace(placeholder, price);
}

const SearchWebIcon = ({ color = '#5985E1', size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z" />
  </Svg>
);

const CreateImagesVideosIcon = ({ color = '#F19E39', size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="m176-120-56-56 301-302-181-45 198-123-17-234 179 151 216-88-87 217 151 178-234-16-124 198-45-181-301 301Zm24-520-80-80 80-80 80 80-80 80Zm355 197 48-79 93 7-60-71 35-86-86 35-71-59 7 92-79 49 90 22 23 90Zm165 323-80-80 80-80 80 80-80 80ZM569-570Z" />
  </Svg>
);

const StarLogoIcon = ({ color = '#D16D6A', size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M852-212 732-332l56-56 120 120-56 56ZM708-692l-56-56 120-120 56 56-120 120Zm-456 0L132-812l56-56 120 120-56 56ZM108-212l-56-56 120-120 56 56-120 120Zm246-75 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-361Z" />
  </Svg>
);

// Tailwind tokens → RN
const COLORS = {
  primary: '#007AFF',
  backgroundLight: '#FFFFFF',
  backgroundDark: '#000000',
  cardLight: '#F3F4F6',
  cardDark: '#1C1C1E',
  textLight: '#000000',
  textDark: '#FFFFFF',
  textSecondaryLight: '#6B7280',
  textSecondaryDark: '#8E8E93',
  green: '#34D399',
  purple: '#A78BFA',
  teal: '#2DD4BF',
  orange: '#FB923C',
  blue: '#60A5FA',
  indigo: '#818CF8',
};

function Chip({ icon, label, tint, style, customIcon }) {
  return (
    <View style={[styles.chip, style]}>
      {customIcon ? (
        <View style={styles.chipIconWrap}>{customIcon}</View>
      ) : (
        <SvgIcon
          name={icon}
          size={20}
          style={styles.chipIconWrap}
          color={tint}
        />
      )}
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function GradientText({
  children,
  style,
  colors = ['#42d392', '#647eff'], // green → blue (matching HTML)
  start = { x: 0, y: 0 },
  end = { x: 1, y: 0 },
}) {
  return (
    <MaskedViewIOS
      style={styles.gradientTextContainer}
      maskElement={
        // The mask is the text itself
        <View style={styles.maskWrap}>
          <Text style={[style, styles.maskText]}>{children}</Text>
        </View>
      }
    >
      {/* The gradient will show only where the text mask is */}
      <LinearGradient colors={colors} start={start} end={end}>
        {/* This invisible text sets the size so the gradient fits perfectly */}
        <Text style={[style, styles.invisibleText]}>{children}</Text>
      </LinearGradient>
    </MaskedViewIOS>
  );
}

export default function PaywallScreen({
  onClose,
  onRestore,
  onContinue,
  dark = true,
}) {
  const {
    availablePackages,
    fetchOfferings,
    purchasePackage,
    restorePurchases,
    isPremium,
    restoring,
  } = useContext(SubscriptionContext) || {};
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { t: tr } = useTranslation();
  const route = useRoute();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const justPurchasedRef = useRef(false);
  const showOneTimeAfterClose = route.params?.showOneTimeOfferAfterClose;
  const firstLaunchPaywall = route.params?.firstLaunchPaywall;
  const afterCloseNavigateTo = route.params?.afterCloseNavigateTo;
  const isCompactWidth = windowWidth <= 360;
  const isCompactHeight = windowHeight <= 700;

  const [trialEnabled, setTrialEnabled] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [closeReady, setCloseReady] = useState(false);

  // Refs for scrolling
  const scrollViewRef = useRef(null);

  // Pulse animation for CTA button
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const closePlaceholderPulse = useRef(new Animated.Value(0)).current;

  // Entrance animations - start from hidden state
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(80);

  useEffect(() => {
    try {
      fetchOfferings && fetchOfferings();
    } catch {}

    // Start pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    const placeholderLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(closePlaceholderPulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(closePlaceholderPulse, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    placeholderLoop.start();

    // Trigger entrance animation on mount
    requestAnimationFrame(() => {
      opacity.value = withTiming(1, {
        duration: 500,
        easing: Easing.out(Easing.ease),
      });
      translateY.value = withTiming(0, {
        duration: 500,
        easing: Easing.out(Easing.ease),
      });
    });
    return () => placeholderLoop.stop();
  }, [fetchOfferings, pulseAnim, opacity, translateY, closePlaceholderPulse]);

  // Always default to Yearly when the paywall screen gains focus
  useFocusEffect(
    useCallback(() => {
      setTrialEnabled(false);
      setSelectedPlan('yearly');

      // Reset to initial state
      opacity.value = 0;
      translateY.value = 80;

      // Trigger animation immediately
      requestAnimationFrame(() => {
        opacity.value = withTiming(1, {
          duration: 500,
          easing: Easing.out(Easing.ease),
        });
        translateY.value = withTiming(0, {
          duration: 500,
          easing: Easing.out(Easing.ease),
        });
      });
    }, [opacity, translateY]),
  );

  useFocusEffect(
    useCallback(() => {
      setCloseReady(false);
      const timer = setTimeout(() => setCloseReady(true), 5000);
      return () => clearTimeout(timer);
    }, []),
  );

  // Animated styles
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const handleTrialToggle = value => {
    setTrialEnabled(value);
    setSelectedPlan(value ? 'weekly' : 'yearly');

    // Scroll to weekly plan when trial is enabled (weekly is the last item)
    if (value && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  };
  const handleSelectPlan = plan => {
    setSelectedPlan(plan);
    setTrialEnabled(plan === 'weekly');
  };
  const performClose = useCallback(() => {
    clearPendingPremiumAction();
    const shouldShowOneTime =
      ONE_TIME_OFFER_PAYWALL_ENABLED &&
      showOneTimeAfterClose &&
      !isPremium &&
      !justPurchasedRef.current;
    justPurchasedRef.current = false;
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
    // Navigate to specified screen after paywall closes (e.g., CoinStore)
    if (afterCloseNavigateTo) {
      try {
        // CoinStore is nested in StudioStack, so we need to navigate to Studio first
        if (afterCloseNavigateTo === 'CoinStore') {
          // Use root navigation to navigate to nested route
          if (navigationRef?.isReady()) {
            navigationRef.navigate('Studio', { screen: 'CoinStore' });
          } else {
            // Fallback: try using the navigation hook
            const parentNav = navigation?.getParent?.();
            if (parentNav) {
              parentNav.navigate('Studio', { screen: 'CoinStore' });
            } else if (navigation) {
              navigation.navigate('Studio', { screen: 'CoinStore' });
            }
          }
        } else {
          // For other routes, try root navigation first
          if (navigationRef?.isReady()) {
            navigationRef.navigate(afterCloseNavigateTo);
          } else if (navigation) {
            navigation.navigate(afterCloseNavigateTo);
          }
        }
        return;
      } catch (err) {
        // If navigation fails, fall through to default close behavior
        console.warn('Navigation failed:', err);
      }
    }
    if (onClose) {
      onClose();
    } else if (navigation && navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [
    onClose,
    navigation,
    showOneTimeAfterClose,
    isPremium,
    afterCloseNavigateTo,
  ]);

  const handleClose = () => {
    // Trigger closing animation
    opacity.value = withTiming(0, {
      duration: 300,
      easing: Easing.in(Easing.cubic),
    });
    translateY.value = withTiming(
      80,
      {
        duration: 300,
        easing: Easing.in(Easing.ease),
      },
      finished => {
        if (finished) {
          // Navigate after animation completes
          runOnJS(performClose)();
        }
      },
    );
  };

  const handleRestore = async () => {
    try {
      const info = await restorePurchases?.();
      onRestore && onRestore();
      const ents = info?.entitlements?.active || {};
      const hasPremium = !!ents?.Premium || isPremium;
      if (hasPremium) {
        justPurchasedRef.current = true;
        consumePendingPremiumAction();
        handleClose();
      }
    } catch {}
  };

  const handleContinue = async () => {
    if (purchaseLoading) return;
    const planMap = {
      weekly: availablePackages?.weekly,
      monthly: availablePackages?.monthly,
      yearly: availablePackages?.yearly,
      oneTime: availablePackages?.oneTime,
    };
    const pkg =
      planMap[selectedPlan] ||
      availablePackages?.yearly ||
      availablePackages?.monthly ||
      availablePackages?.weekly;
    if (!pkg) {
      onContinue && onContinue();
      return;
    }
    try {
      setPurchaseLoading(true);
      await purchasePackage?.(pkg);
      justPurchasedRef.current = true;
      consumePendingPremiumAction();
      onContinue && onContinue();
      handleClose();
    } catch (error) {
      // Purchase error handled silently
    } finally {
      setPurchaseLoading(false);
    }
  };

  const theme = useMemo(
    () => ({
      bg: dark ? COLORS.backgroundDark : COLORS.backgroundLight,
      card: dark ? COLORS.cardDark : COLORS.cardLight,
      text: dark ? COLORS.textDark : COLORS.textLight,
      textSecondary: dark
        ? COLORS.textSecondaryDark
        : COLORS.textSecondaryLight,
    }),
    [dark],
  );

  const placeholderOpacity = closePlaceholderPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.55],
  });
  const placeholderScale = closePlaceholderPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.08],
  });

  // Dynamic themed styles (no inline style objects in JSX)
  const t = useMemo(
    () => ({
      containerBg: {
        backgroundColor: theme.bg,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      },
      bgOnly: { backgroundColor: theme.bg },
      gradientBackdrop: { height: insets.top + 384, top: -insets.top },
      iconCircleBg: { backgroundColor: theme.card },
      centerLogoBg: { backgroundColor: theme.card },
      cardRowBg: { backgroundColor: theme.card },
      restoreDisabled: { opacity: 0.6 },
      yearlyCard: {
        borderColor: selectedPlan === 'yearly' ? COLORS.primary : '#333',
        backgroundColor:
          selectedPlan === 'yearly' ? 'rgba(0, 122, 255, 0.1)' : theme.card,
      },
      monthlyCard: {
        backgroundColor:
          selectedPlan === 'monthly' ? 'rgba(0, 122, 255, 0.1)' : theme.card,
        borderWidth: 2,
        borderColor: selectedPlan === 'monthly' ? COLORS.primary : '#333',
      },
      weeklyCard: {
        backgroundColor:
          selectedPlan === 'weekly' ? 'rgba(0, 122, 255, 0.1)' : theme.card,
        borderWidth: 2,
        borderColor: selectedPlan === 'weekly' ? COLORS.primary : '#333',
      },
      textPrimary: { color: theme.text },
      textSecondary: { color: theme.textSecondary },
    }),
    [insets.top, insets.bottom, theme, selectedPlan],
  );

  const yearlyPrice =
    availablePackages?.yearly?.product?.priceString ||
    tr('paywall.plans.yearly.defaultPrice');
  const yearlyOnlyTemplate = tr('paywall.plans.yearly.only', {
    defaultValue: 'Only {{price}}',
  });
  const yearlyOnlyText = yearlyPrice
    ? interpolatePrice(yearlyOnlyTemplate, yearlyPrice)
    : yearlyOnlyTemplate;
  const weeklyEquivalentYearlyPrice = formatWeeklyEquivalent(
    availablePackages?.yearly?.product,
  );
  const yearlyIntro =
    weeklyEquivalentYearlyPrice || tr('paywall.plans.yearly.defaultIntroPrice');
  const monthlyPrice =
    availablePackages?.monthly?.product?.priceString ||
    tr('paywall.plans.monthly.defaultPrice');
  const weeklyPrice =
    availablePackages?.weekly?.product?.priceString ||
    tr('paywall.plans.weekly.defaultPrice');

  // Compute Image Studio credits and period for the selected plan
  const imageStudioCredits = useMemo(() => {
    return selectedPlan === 'yearly'
      ? '15000'
      : selectedPlan === 'monthly'
      ? '1200'
      : '400';
  }, [selectedPlan]);

  const imageStudioPeriod = useMemo(() => {
    const periodKey =
      selectedPlan === 'yearly'
        ? 'yearly'
        : selectedPlan === 'monthly'
        ? 'monthly'
        : 'weekly';
    return tr(`paywall.features.period.${periodKey}`);
  }, [selectedPlan, tr]);

  return (
    <View style={[styles.container, t.containerBg]}>
      {/* GRADIENT BEHIND CONTENT (covers safe area + 384) */}
      <AnimatedReanimated.View
        pointerEvents="none"
        style={[
          styles.gradientBackdrop,
          t.gradientBackdrop,
          containerAnimatedStyle,
        ]}
      >
        {/* Tailwind: bg-gradient-to-b from-blue-500/30 via-purple-500/20 to-transparent */}
        <LinearGradient
          colors={[
            'rgba(59,130,246,0.30)',
            'rgba(168,85,247,0.20)',
            'rgba(0,0,0,0)',
          ]}
          locations={[0, 0.55, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.gradientPrimary}
        />
        {/* Soft "blur-ish" halo */}
        <LinearGradient
          colors={['rgba(168,85,247,0.18)', 'rgba(0,0,0,0)']}
          locations={[0, 1]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.gradientSecondary}
        />
      </AnimatedReanimated.View>

      <AnimatedReanimated.View
        style={[
          styles.root,
          isCompactWidth && styles.rootCompact,
          isCompactHeight && styles.rootCompactHeight,
          containerAnimatedStyle,
        ]}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            isCompactHeight && styles.scrollContentCompact,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header + “orbiting chips” cluster */}
          <View
            style={[
              styles.headerWithModels,
              isCompactHeight && styles.headerWithModelsCompact,
            ]}
          >
            <View
              style={[
                styles.headerButtons,
                isCompactHeight && styles.headerButtonsCompact,
              ]}
            >
              {closeReady ? (
                <TouchableOpacity
                  onPress={handleClose}
                  activeOpacity={0.8}
                  style={styles.iconCircle}
                >
                  <CloseIcon color="rgba(255,255,255,0.45)" size={20} />
                </TouchableOpacity>
              ) : (
                <View style={styles.iconCirclePlaceholder}>
                  <Animated.View
                    style={[
                      styles.placeholderDot,
                      {
                        borderColor: dark
                          ? 'rgba(255,255,255,0.2)'
                          : 'rgba(0,0,0,0.2)',
                        opacity: placeholderOpacity,
                        transform: [{ scale: placeholderScale }],
                      },
                    ]}
                  />
                </View>
              )}

              <TouchableOpacity
                onPress={handleRestore}
                activeOpacity={0.9}
                disabled={!!restoring}
                style={[styles.restoreBtn, restoring && t.restoreDisabled]}
              >
                <Text style={styles.restoreText}>
                  {restoring
                    ? tr('paywall.restoreRestoring')
                    : tr('paywall.restore')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.centerWrap}>
              <View style={styles.chipsLayer}>
                <Chip
                  icon="gemini"
                  label="Gemini"
                  tint={COLORS.green}
                  style={styles.chipGemini}
                />
                <Chip
                  icon="banana"
                  label="Nano Banana"
                  tint={COLORS.purple}
                  style={styles.chipBanana}
                  // customIcon={<PerplexityIcon color="#EA33F7" size={16} />}
                />
                <Chip
                  icon="gpt"
                  label="ChatGPT"
                  tint={COLORS.teal}
                  style={styles.chipGPT}
                />
                <Chip
                  icon="claude"
                  label="Claude"
                  tint={COLORS.orange}
                  style={styles.chipClaude}
                />
                <Chip
                  icon="grok"
                  label="Grok 4"
                  tint={COLORS.blue}
                  style={styles.chipGrok}
                />
                <Chip
                  icon="deepseek"
                  label="DeepSeek"
                  tint={COLORS.blue}
                  style={styles.chipDeepseek}
                />
              </View>

              <View style={[styles.centerLogo, t.centerLogoBg]}>
                <StarLogoIcon color="#FFFFFF" size={44} />
              </View>
            </View>
          </View>

          <GradientText
            style={[styles.title, isCompactHeight && styles.titleCompact]}
          >
            GPT-5.1, Grok 4, Gemini 3
          </GradientText>

          {/* Features */}
          <View
            style={[styles.features, isCompactHeight && styles.featuresCompact]}
          >
            <View style={styles.featureRow}>
              <CreateImagesVideosIcon color="#F19E39" size={20} />
              {(() => {
                const template = tr('paywall.features.imageStudio', {
                  defaultValue:
                    'Get Image Studio {{credits}} credits {{period}}',
                });
                const parts = template.split('{{credits}}');
                if (parts.length === 2) {
                  const afterCredits = parts[1].split('{{period}}');
                  return (
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                      }}
                    >
                      <Text style={[styles.featureText, t.textPrimary]}>
                        {parts[0]}
                      </Text>
                      <GradientText style={styles.featureText}>
                        {imageStudioCredits}
                      </GradientText>
                      <Text style={[styles.featureText, t.textPrimary]}>
                        {afterCredits[0]}
                      </Text>
                      {afterCredits[1] ? (
                        <>
                          <Text style={[styles.featureText, t.textPrimary]}>
                            {imageStudioPeriod}
                          </Text>
                          <Text style={[styles.featureText, t.textPrimary]}>
                            {afterCredits[1]}
                          </Text>
                        </>
                      ) : (
                        <Text style={[styles.featureText, t.textPrimary]}>
                          {imageStudioPeriod}
                        </Text>
                      )}
                    </View>
                  );
                }
                return (
                  <Text style={[styles.featureText, t.textPrimary]}>
                    {template
                      .replace('{{credits}}', imageStudioCredits)
                      .replace('{{period}}', imageStudioPeriod)}
                  </Text>
                );
              })()}
            </View>
            <View style={styles.featureRow}>
              <SearchWebIcon color="#5985E1" size={20} />
              <Text style={[styles.featureText, t.textPrimary]}>
                {tr('paywall.features.search')}
              </Text>
            </View>
            <View style={styles.featureRow}>
              <CreateImagesIcon color="#75FB4C" size={20} />
              <Text style={[styles.featureText, t.textPrimary]}>
                {tr('paywall.features.talk')}
              </Text>
            </View>
          </View>

          {/* Free trial toggle */}
          <View style={[styles.cardRow, t.cardRowBg]}>
            <View>
              <Text style={[styles.cardTitle, t.textPrimary]}>
                {tr('paywall.freeTrial.title')}
              </Text>
              <Text style={[styles.cardSubtitle, t.textSecondary]}>
                {tr('paywall.freeTrial.subtitle')}
              </Text>
            </View>
            <Switch
              value={trialEnabled}
              onValueChange={handleTrialToggle}
              trackColor={{ false: '#4F4F4F', true: '#007AFF' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#4F4F4F"
            />
          </View>

          {/* Yearly (Best offer) */}
          <TouchableOpacity
            style={styles.bestOfferWrap}
            onPress={() => handleSelectPlan('yearly')}
            activeOpacity={0.8}
          >
            <View style={[styles.yearlyCard, t.yearlyCard]}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {tr('paywall.badge.bestOffer')}
                </Text>
              </View>
              <View style={styles.rowSpread}>
                <View>
                  <Text style={[styles.planTitle, t.textPrimary]}>
                    {tr('paywall.plans.yearly.title')}
                  </Text>
                  <Text style={[styles.planSubYear, t.textPrimary]}>
                    {yearlyPrice
                      ? yearlyOnlyText
                      : tr('paywall.plans.yearly.title')}
                  </Text>
                </View>
                <View style={styles.alignEnd}>
                  <Text style={[styles.planSubDaily, t.textPrimary]}>
                    {yearlyIntro}
                  </Text>
                  <Text style={[styles.planSub, t.textSecondary]}>
                    {tr('paywall.frequency.perWeek')}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          {/* Monthly */}
          {!firstLaunchPaywall && (
            <TouchableOpacity
              style={[styles.weeklyCard, t.monthlyCard]}
              onPress={() => handleSelectPlan('monthly')}
              activeOpacity={0.8}
            >
              <View style={styles.rowSpread}>
                <View>
                  <Text style={[styles.planTitle, t.textPrimary]}>
                    {tr('paywall.plans.monthly.title')}
                  </Text>
                  <Text style={[styles.planSub, t.textSecondary]}>
                    {tr('paywall.plans.monthly.subtitle')}
                  </Text>
                </View>
                <View style={styles.alignEnd}>
                  <Text style={[styles.planPrice, t.textPrimary]}>
                    {monthlyPrice}
                  </Text>
                  <Text style={[styles.planSub, t.textSecondary]}>
                    {tr('paywall.frequency.perMonth')}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Weekly */}
          <TouchableOpacity
            style={[styles.weeklyCard, t.weeklyCard]}
            onPress={() => handleSelectPlan('weekly')}
            activeOpacity={0.8}
          >
            <View style={styles.rowSpread}>
              <View>
                <Text style={[styles.planTitle, t.textPrimary]}>
                  {tr('paywall.plans.weekly.title')}
                </Text>
                <Text style={[styles.planSub, t.textSecondary]}>
                  {tr('paywall.plans.weekly.subtitle')}
                </Text>
              </View>
              <View style={styles.alignEnd}>
                <Text style={[styles.planPrice, t.textPrimary]}>
                  {weeklyPrice}
                </Text>
                <Text style={[styles.planSub, t.textSecondary]}>
                  {tr('paywall.frequency.perWeek')}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, t.bgOnly]}>
          <Animated.View
            style={[styles.ctaWrapper, { transform: [{ scale: pulseAnim }] }]}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.cta}
              onPress={handleContinue}
              disabled={purchaseLoading}
            >
              {purchaseLoading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.ctaText}>{tr('paywall.cta')}</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.legalRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() =>
                Linking.openURL('https://aicloudsolutions.app/terms')
              }
            >
              <Text style={[styles.legalLink, t.textSecondary]}>
                {tr('paywall.legal.terms')}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.legalDivider, t.textSecondary]}>|</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() =>
                Linking.openURL('https://aicloudsolutions.app/privacy')
              }
            >
              <Text style={[styles.legalLink, t.textSecondary]}>
                {tr('paywall.legal.privacy')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedReanimated.View>
    </View>
  );
}

const R = 12;

const styles = StyleSheet.create({
  container: { flex: 1 },
  root: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: Platform.select({ ios: 8, android: 8 }),
    // IMPORTANT: keep transparent so the gradient behind is visible
    backgroundColor: 'transparent',
  },
  rootCompact: {
    paddingHorizontal: 12,
  },
  rootCompactHeight: {
    paddingTop: Platform.select({ ios: 6, android: 6 }),
  },

  // Gradient behind content; sibling FIRST so content draws above it
  gradientBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // height set dynamically with insets + 384
  },
  gradientPrimary: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientSecondary: {
    position: 'absolute',
    top: 24,
    left: 0,
    right: 0,
    height: 300,
    opacity: 0.9,
  },

  scroll: { backgroundColor: 'transparent', flex: 1 },
  scrollContent: { paddingBottom: 16 },
  scrollContentCompact: { paddingBottom: 10 },

  headerWithModelsCompact: { marginBottom: 12 },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  headerButtonsCompact: { marginBottom: 14 },
  iconCircle: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCirclePlaceholder: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
  },
  restoreBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  restoreText: {
    color: COLORS.primary,
    fontWeight: '500',
    fontSize: 13,
    fontFamily: 'Lato-Regular',
  },

  centerWrap: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  chipsLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipIconWrap: { marginRight: 6 },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.cardDark,
  },
  chipGemini: { top: 18, left: '18%' },
  chipBanana: { top: 18, right: '6%' },
  chipGPT: { top: 62, left: '22%', marginLeft: -48 },
  chipClaude: { top: 62, right: '26%', marginRight: -48 },
  chipGrok: { bottom: 18, left: '18%' },
  chipDeepseek: { bottom: 18, right: '12%' },
  chipText: {
    color: COLORS.textDark,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Lato-Bold',
  },
  centerLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: 29,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'Lato-Bold',
  },
  titleCompact: { marginBottom: 12 },

  // Gradient text styles
  gradientTextContainer: {
    alignSelf: 'center', // centers gradient to text width
  },
  maskWrap: {
    backgroundColor: 'transparent',
  },
  maskText: {
    // must be opaque so the mask is solid
    color: '#000', // mask color; not visible to user
  },
  invisibleText: {
    opacity: 0, // not visible; defines gradient's layout size
  },

  features: { marginBottom: 26, gap: 10 },
  featuresCompact: { marginBottom: 18, gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 16, fontFamily: 'Lato-Regular' },

  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: R,
    marginBottom: 12,
  },

  bestOfferWrap: { position: 'relative', marginBottom: 12 },
  yearlyCard: { borderWidth: 2, borderRadius: R, padding: 16 },
  badge: {
    position: 'absolute',
    top: -12,
    right: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    fontFamily: 'Lato-Bold',
  },

  rowSpread: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  alignEnd: { alignItems: 'flex-end' },
  cardTitle: { fontSize: 16, fontWeight: '700', fontFamily: 'Lato-Bold' },
  cardSubtitle: { fontSize: 13, marginTop: 2, fontFamily: 'Lato-Regular' },
  planTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Lato-Bold' },
  planSubDaily: { fontSize: 16, marginTop: 4, fontFamily: 'Lato-Regular' },
  planSub: { fontSize: 13, marginTop: 2, fontFamily: 'Lato-Regular' },
  planSubYear: {
    fontSize: 16,
    marginTop: 4,
    fontWeight: '800',
    fontFamily: 'Lato-Bold',
  },
  planPrice: { fontSize: 18, fontWeight: '700', fontFamily: 'Lato-Bold' },
  weeklyCard: { borderRadius: R, padding: 16, marginBottom: 12 },
  footer: { paddingTop: 10, paddingBottom: 14 },
  ctaWrapper: {
    width: '100%',
  },
  cta: {
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: R,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    fontFamily: 'Lato-Bold',
  },
  legalRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  legalLink: {
    fontSize: 12,
    textDecorationLine: 'underline',
    fontFamily: 'Lato-Regular',
  },
  legalDivider: {
    fontSize: 12,
    marginHorizontal: 8,
    fontFamily: 'Lato-Regular',
  },
});

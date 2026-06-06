import React, {
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Animated,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { SubscriptionContext } from '../context/SubscriptionContext';

const CloseIcon = ({ color = '#FFFFFF', size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
  </Svg>
);

// Icons from PaywallScreen
const CreateImagesVideosIcon = ({ color = '#F19E39', size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="m176-120-56-56 301-302-181-45 198-123-17-234 179 151 216-88-87 217 151 178-234-16-124 198-45-181-301 301Zm24-520-80-80 80-80 80 80-80 80Zm355 197 48-79 93 7-60-71 35-86-86 35-71-59 7 92-79 49 90 22 23 90Zm165 323-80-80 80-80 80 80-80 80ZM569-570Z" />
  </Svg>
);

const SearchWebIcon = ({ color = '#5985E1', size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z" />
  </Svg>
);

const CreateImagesIcon = ({ color = '#75FB4C', size = 24 }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M280-240v-480h80v480h-80ZM440-80v-800h80v800h-80ZM120-400v-160h80v160h-80Zm480 160v-480h80v480h-80Zm160-160v-160h80v160h-80Z" />
  </Svg>
);

function GradientText({ children, style, colors: gradientColors = ['#A855F7', '#6366F1'] }) {
  return (
    <MaskedView
      style={styles.gradientTextContainer}
      maskElement={
        <View style={styles.maskWrap}>
          <Text style={[style, styles.maskText]}>{children}</Text>
        </View>
      }
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={[style, styles.invisibleText]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

function GradientTextSoft({ children, style }) {
  return (
    <MaskedView
      style={styles.gradientTextContainer}
      maskElement={
        <View style={styles.maskWrap}>
          <Text style={[style, styles.maskText]}>{children}</Text>
        </View>
      }
    >
      <LinearGradient
        colors={['#A5B4FC', '#E0E7FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={[style, styles.invisibleText]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

function GradientDiscountText({ children, style }) {
  return (
    <MaskedView
      style={styles.gradientTextContainer}
      maskElement={
        <View style={styles.maskWrap}>
          <Text style={[style, styles.maskText]}>{children}</Text>
        </View>
      }
    >
      <LinearGradient
        colors={['#818CF8', '#A78BFA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={[style, styles.invisibleText]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

export default function OneTimeOfferModal({
  visible,
  onClose,
  onPurchaseComplete,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const subscription = useContext(SubscriptionContext);
  const { availablePackages, purchasePackage, restorePurchases, paymentsEnabled } =
    subscription || {};
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [closeReady, setCloseReady] = useState(false);
  const closePlaceholderPulse = useRef(new Animated.Value(0)).current;
  const isCompactWidth = windowWidth <= 360;

  const oneTimePackage = availablePackages?.oneTime;
  const yearlyPackage = availablePackages?.yearly;

  // Entrance animations - start from hidden state
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(80);

useEffect(() => {
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

  const loop = Animated.loop(
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
  loop.start();
  return () => loop.stop();
}, [opacity, translateY, closePlaceholderPulse]);

  // Reset and animate when screen gains focus
  useFocusEffect(
    useCallback(() => {
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
      const timer = setTimeout(() => setCloseReady(true), 3000);
      return () => clearTimeout(timer);
    }, []),
  );

  // Animated styles
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const performClose = useCallback(() => {
    if (onClose) onClose();
  }, [onClose]);

  const handleClose = useCallback(() => {
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
          // Call onClose after animation completes
          runOnJS(performClose)();
        }
      },
    );
  }, [opacity, translateY, performClose]);

  const handlePurchase = useCallback(async () => {
    if (!paymentsEnabled) {
      Alert.alert(
        t('oneTimeOffer.unavailableTitle', { defaultValue: 'Purchases unavailable' }),
        t('oneTimeOffer.unavailableMessage', {
          defaultValue: 'Android billing is not configured yet.',
        }),
      );
      return;
    }
    if (!oneTimePackage || purchasing) return;

    setPurchasing(true);
    try {
      await purchasePackage?.(oneTimePackage);
      Alert.alert(
        t('oneTimeOffer.successTitle', { defaultValue: 'Success!' }),
        t('oneTimeOffer.successMessage', {
          defaultValue:
            'Thank you for your purchase! Enjoy premium access for the next 12 months.',
        }),
      );
      onPurchaseComplete?.();
      handleClose();
    } catch (error) {
      const errorCode = error?.userCancelled ? 'USER_CANCELLED' : error?.code;
      if (errorCode !== 'USER_CANCELLED') {
        Alert.alert(
          t('oneTimeOffer.errorTitle', { defaultValue: 'Purchase Failed' }),
          error?.message ||
          t('oneTimeOffer.errorMessage', {
            defaultValue: 'Something went wrong. Please try again.',
          }),
        );
      }
    } finally {
      setPurchasing(false);
    }
  }, [
    handleClose,
    oneTimePackage,
    paymentsEnabled,
    purchasePackage,
    purchasing,
    t,
    onPurchaseComplete,
  ]);

  const handleRestore = useCallback(async () => {
    if (!paymentsEnabled) {
      Alert.alert(
        t('oneTimeOffer.unavailableTitle', { defaultValue: 'Purchases unavailable' }),
        t('oneTimeOffer.unavailableMessage', {
          defaultValue: 'Android billing is not configured yet.',
        }),
      );
      return;
    }
    if (restoring) return;
    setRestoring(true);
    try {
      await restorePurchases?.();
      Alert.alert(
        t('oneTimeOffer.restoreSuccessTitle', { defaultValue: 'Restored' }),
        t('oneTimeOffer.restoreSuccessMessage', {
          defaultValue: 'Your purchases have been restored.',
        }),
      );
    } catch (error) {
      Alert.alert(
        t('oneTimeOffer.restoreErrorTitle', { defaultValue: 'Restore Failed' }),
        error?.message ||
        t('oneTimeOffer.restoreErrorMessage', {
          defaultValue: 'No purchases found to restore.',
        }),
      );
    } finally {
      setRestoring(false);
    }
  }, [paymentsEnabled, restorePurchases, restoring, t]);

  const product = oneTimePackage?.product || {};
  const priceString = product?.priceString || null;

  // Mocked discount - always 50%
  const discountPercent = 50;

  const features = useMemo(
    () => [
      {
        icon: 'imageStudio',
        text: t('paywall.features.imageStudio', {
          defaultValue: 'Get Image Studio {{credits}} credits {{period}}',
        }),
        color: '#F19E39',
        credits: '15000',
        period: t('paywall.features.period.yearly', { defaultValue: 'yearly' }),
      },
      {
        icon: 'search',
        text: t('paywall.features.search', {
          defaultValue: 'Search the web with AI',
        }),
        color: '#5985E1',
      },
      {
        icon: 'talk',
        text: t('paywall.features.talk', {
          defaultValue: 'Talk naturally to AI',
        }),
        color: '#75FB4C',
      },
    ],
    [t],
  );

  const renderFeatureIcon = (iconName, color) => {
    const iconProps = { color, size: 24 };
    switch (iconName) {
      case 'create':
        return <CreateImagesVideosIcon {...iconProps} />;
      case 'imageStudio':
        return <CreateImagesVideosIcon {...iconProps} />;
      case 'search':
        return <SearchWebIcon {...iconProps} />;
      case 'talk':
        return <CreateImagesIcon {...iconProps} />;
      default:
        return null;
    }
  };

  const placeholderOpacity = closePlaceholderPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.55],
  });
  const placeholderScale = closePlaceholderPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.08],
  });

  if (!visible) return null;

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {/* Background gradients */}
      <View style={styles.backgroundGradient} pointerEvents="none">
        <LinearGradient
          colors={['rgba(99, 102, 241, 0.2)', 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.4 }}
          style={styles.gradientTop}
        />
        <LinearGradient
          colors={['transparent', 'rgba(99, 102, 241, 0.1)']}
          start={{ x: 0.5, y: 0.6 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.gradientBottom}
        />
      </View>
      <AnimatedReanimated.View style={[styles.content, containerAnimatedStyle]}>
        {/* Header */}
        <View style={styles.header}>
          {closeReady ? (
            <TouchableOpacity onPress={handleClose} activeOpacity={0.8} style={styles.iconCircle}>
              <CloseIcon color="rgba(255,255,255,0.45)" size={20} />
            </TouchableOpacity>
          ) : (
            <View style={styles.iconCirclePlaceholder}>
              <Animated.View
                style={[
                  styles.placeholderDot,
                  {
                    borderColor: 'rgba(255,255,255,0.2)',
                    opacity: placeholderOpacity,
                    transform: [{ scale: placeholderScale }],
                  },
                ]}
              />
            </View>
          )}
          <Pressable 
            onPress={handleRestore} 
            style={[styles.restoreButton, restoring && styles.restoreButtonDisabled]}
            disabled={restoring || !paymentsEnabled}
          >
            <Text style={styles.restoreButtonText}>
              {restoring 
                ? t('paywall.restoreRestoring', { defaultValue: 'Restoring…' })
                : t('paywall.restore', { defaultValue: 'Restore' })
              }
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces
          alwaysBounceVertical={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.centeredContent}>
            {/* Exclusive One-Time Offer text */}
            <View style={styles.promoBadgeContainer}>
              <Text
                style={styles.promoBadgeTextPrimary}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {t('oneTimeOffer.badgeLine1', { defaultValue: 'Exclusive' })}
              </Text>
              <Text
                style={styles.promoBadgeTextSecondary}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {t('oneTimeOffer.badgeLine2', { defaultValue: 'One time offer' })}
              </Text>
            </View>

            {/* 50% OFF Title */}
            <GradientText style={styles.discountTitle} colors={['#A855F7', '#6366F1']}>
              {discountPercent}% OFF
            </GradientText>

            {/* Subtitle */}
            <Text style={styles.subtitle}>
              {t('oneTimeOffer.subtitle', {
                defaultValue: 'You will not see this offer again.',
              })}
            </Text>

            {/* Features Card */}
            <View style={styles.featuresCard}>
              {features.map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  {renderFeatureIcon(feature.icon, feature.color)}
                  {feature.credits ? (
                    (() => {
                      const template = feature.text;
                      const parts = template.split('{{credits}}');
                      if (parts.length === 2) {
                        const afterCredits = parts[1].split('{{period}}');
                        return (
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                            <Text style={[styles.featureText, { flex: 0 }]}>{parts[0]}</Text>
                            <GradientText style={[styles.featureText, { flex: 0 }]} colors={['#42d392', '#647eff']}>
                              {feature.credits}
                            </GradientText>
                            <Text style={[styles.featureText, { flex: 0 }]}>{afterCredits[0]}</Text>
                            {afterCredits[1] ? (
                              <>
                                <Text style={[styles.featureText, { flex: 0 }]}>{feature.period}</Text>
                                <Text style={[styles.featureText, { flex: 0 }]}>{afterCredits[1]}</Text>
                              </>
                            ) : (
                              <Text style={[styles.featureText, { flex: 0 }]}>{feature.period}</Text>
                            )}
                          </View>
                        );
                      }
                      return <Text style={styles.featureText}>{feature.text}</Text>;
                    })()
                  ) : (
                    <Text style={styles.featureText}>{feature.text}</Text>
                  )}
                </View>
              ))}
            </View>

            {/* Lifetime Button */}
            <Pressable
              style={[
                styles.lifetimeButton,
                (!paymentsEnabled || !oneTimePackage || purchasing) && styles.lifetimeButtonDisabled,
              ]}
              onPress={handlePurchase}
              disabled={purchasing || !oneTimePackage || !paymentsEnabled}
            >
              {purchasing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : priceString ? (
                <Text style={styles.lifetimeButtonText}>
                  {(() => {
                    const template = t('oneTimeOffer.upgradeNow', {
                      defaultValue: `Upgrade now for ${priceString}`,
                    });
                    return template.replace('{{price}}', priceString);
                  })()}
                </Text>
              ) : (
                <Text style={styles.lifetimeButtonText}>
                  {t('oneTimeOffer.loadingPrice', {
                    defaultValue: 'Loading...',
                  })}
                </Text>
              )}
            </Pressable>

            {/* Footer Links */}
            <View style={[styles.termsInline, isCompactWidth && styles.termsStack]}>
              <Pressable
                onPress={() => Linking.openURL('https://aicloudsolutions.app/terms')}
                hitSlop={8}
              >
                <Text style={styles.footerLink}>
                  {t('oneTimeOffer.termsOfUse', { defaultValue: 'Terms of Use' })}
                </Text>
              </Pressable>
              {!isCompactWidth && <Text style={styles.footerLinkSeparator}>|</Text>}
              <Pressable
                onPress={() => Linking.openURL('https://aicloudsolutions.app/privacy/chatcloud')}
                hitSlop={8}
              >
                <Text style={styles.footerLink}>
                  {t('oneTimeOffer.privacyPolicy', { defaultValue: 'Privacy Policy' })}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </AnimatedReanimated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0F17', // base-dark
    flexDirection: 'column',
  },
  backgroundGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
  },
  content: {
    flex: 1,
    flexDirection: 'column',
    marginTop: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
    zIndex: 10,
  },
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
  restoreButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  restoreButtonDisabled: {
    opacity: 0.6,
  },
  restoreButtonText: {
    color: '#007AFF',
    fontWeight: '500',
    fontSize: 13,
    fontFamily: 'Lato-Regular',
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 60,
    flexGrow: 1,
  },
  centeredContent: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    paddingTop: 0,
    paddingBottom: 24,
  },
  promoBadgeContainer: {
    marginBottom: 2,
    marginTop: 4,
    alignItems: 'center',
  },
  promoBadgeTextPrimary: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: 'Lato-Bold',
    letterSpacing: 2,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  promoBadgeTextSecondary: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'Lato-Bold',
    letterSpacing: 1.5,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 2,
  },
  discountTitle: {
    fontSize: 58,
    fontWeight: '900',
    fontFamily: 'Lato-Bold',
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'Lato-Regular',
    color: '#94A3B8', // muted-dark
    textAlign: 'center',
    marginBottom: 4,
  },
  featuresCard: {
    width: '100%',
    // maxWidth: 400,
    backgroundColor: 'transparent',
    paddingVertical: 24,
    paddingHorizontal: 10,
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  featureText: {
    fontSize: 16,
    fontFamily: 'Lato-Regular',
    color: '#E5E7EB',
    flex: 1,
  },
  lifetimeButton: {
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: '#A855F7', // brand-purple
    backgroundColor: '#191C29', // surface-dark
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 8,
  },
  lifetimeButtonDisabled: {
    opacity: 0.55,
  },
  lifetimeButtonText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    // fontFamily: 'Lato-Bold',
  },
  
  termsInline: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
    paddingBottom: 8,
  },
  termsStack: {
    flexDirection: 'column',
    gap: 6,
    paddingHorizontal: 16,
  },
  footerLink: {
    fontSize: 12,
    fontFamily: 'Lato-Regular',
    color: '#94A3B8', // muted-dark
    textAlign: 'center',
  },
  footerLinkSeparator: {
    fontSize: 12,
    fontFamily: 'Lato-Regular',
    color: '#94A3B8', // muted-dark
  },
  gradientTextContainer: {
    alignSelf: 'center',
  },
  maskWrap: {
    backgroundColor: 'transparent',
  },
  maskText: {
    fontWeight: '900',
    fontFamily: 'Lato-Bold',
  },
  invisibleText: {
    opacity: 0,
    fontWeight: '900',
    fontFamily: 'Lato-Bold',
  },
});

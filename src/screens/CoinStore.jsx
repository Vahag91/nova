import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  AppState,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Purchases from 'react-native-purchases';
import { ensureDeviceId } from '../lib/deviceId';
import {
  createSbWithDevice,
  fetchBalanceByDevice,
} from '../lib/supabaseDevice';
import { useImagesStore } from '../state/useImagesStore';
import { useTranslation } from 'react-i18next';
// MaterialIcons no longer used here
import Svg, { Path } from 'react-native-svg';
import SvgIcon from '../components/SvgIcon';
const UI = {
  // Updated palette to match provided design
  bg: '#030712', // dark-base
  surface: '#111827', // dark-surface
  text: '#F9FAFB', // dark-on-surface
  textMuted: '#9CA3AF', // dark-on-surface-secondary
  primary: '#6366F1', // dark-primary
  border10: 'rgba(255,255,255,0.10)',
  // extras used in cards
  amber: '#FBBF24',
  purple: '#A78BFA',
  blue: '#60A5FA',
  green: '#34D399',
  white: '#FFFFFF',
  warmOrange: '#FF8A54',
  warmYellow: '#FFC94D',
  warmPink: '#E96479',
  lightPurple: '#A594F9',
};

// Coin icon provided by design
const CoinIcon = ({ size = 24, color = '#DA954B' }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="M480-120q-151 0-255.5-46.5T120-280v-400q0-66 105.5-113T480-840q149 0 254.5 47T840-680v400q0 67-104.5 113.5T480-120Zm0-479q89 0 179-25.5T760-679q-11-29-100.5-55T480-760q-91 0-178.5 25.5T200-679q14 30 101.5 55T480-599Zm0 199q42 0 81-4t74.5-11.5q35.5-7.5 67-18.5t57.5-25v-120q-26 14-57.5 25t-67 18.5Q600-528 561-524t-81 4q-42 0-82-4t-75.5-11.5Q287-543 256-554t-56-25v120q25 14 56 25t66.5 18.5Q358-408 398-404t82 4Zm0 200q46 0 93.5-7t87.5-18.5q40-11.5 67-26t32-29.5v-98q-26 14-57.5 25t-67 18.5Q600-328 561-324t-81 4q-42 0-82-4t-75.5-11.5Q287-343 256-354t-56-25v99q5 15 31.5 29t66.5 25.5q40 11.5 88 18.5t94 7Z" />
  </Svg>
);

export default function CoinStore() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const setCoinsBalance = useImagesStore(s => s.setCoinsBalance);
  const [deviceId, setDeviceId] = useState(null);
  const [sb, setSb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [packs, setPacks] = useState([]);
  const [buying, setBuying] = useState(false);
  const [processingPackId, setProcessingPackId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        // 1) stable id (RevenueCat is configured globally in SubscriptionContext)
        const id = await ensureDeviceId();
        setDeviceId(id);

        // Check current RevenueCat app user
        try {
          const rcUserId = (await Purchases.getAppUserID?.()) || '(unknown)';
          const ci = await Purchases.getCustomerInfo?.();
          const original = ci?.originalAppUserId || '(unknown)';
          if (rcUserId && id && rcUserId !== id) {
            // RC/DeviceId mismatch detected
          }
        } catch (e) {
          // RC user check error handled silently
        }
        // Compare RC appUserID with our deviceId to spot mismatch
        try {
          const rcUser =
            typeof Purchases.getAppUserID === 'function'
              ? await Purchases.getAppUserID()
              : (await Purchases.getCustomerInfo())?.originalAppUserId;
          // RC appUserID match check
        } catch (e) {
          // getAppUserID/customerInfo error handled silently
        }

        // 2) supabase client
        const client = createSbWithDevice(id);
        setSb(client);

        // 3) parallel: balance + offerings (RC already configured by SubscriptionProvider)
        const [bal, offerings] = await Promise.all([
          fetchBalanceByDevice(client, id),
          Purchases.getOfferings(),
        ]);
        setBalance(bal);
        setCoinsBalance(bal);
        // Select 'coins' offering first; fall back to current
        const allKeys = offerings?.all ? Object.keys(offerings.all) : [];
        const coinsOffering =
          (offerings?.all && offerings.all.coins) || offerings?.current || null;
        const available = Array.isArray(coinsOffering?.availablePackages)
          ? coinsOffering.availablePackages
          : [];

        setPacks(available);
      } catch (e) {
        Alert.alert(
          t('coinStore.alerts.initErrorTitle'),
          e?.message || t('coinStore.alerts.genericMessage'),
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!sb || !deviceId) return;
    try {
      const bal = await fetchBalanceByDevice(sb, deviceId);
      setBalance(bal);
      setCoinsBalance(bal);
    } catch (e) {
      // Refresh balance error handled silently
    }
  }, [sb, deviceId]);

  const refreshBalanceWithPolling = useCallback(
    async (tries = 5, delayMs = 1200) => {
      for (let i = 0; i < tries; i++) {
        await refreshBalance();
        await new Promise(r => setTimeout(r, delayMs));
      }
    },
    [refreshBalance],
  );

  const buyPack = useCallback(
    async (pkg, packId) => {
      if (!pkg || !deviceId) return;
      setBuying(true);
      setProcessingPackId(packId || pkg?.identifier || '');
      try {
        // Ensure RC identity matches deviceId before purchasing
        try {
          const current = await Purchases.getAppUserID?.();
          if (current && current !== deviceId) {
            try {
              await Purchases.logIn(String(deviceId));
            } catch (err) {}
          }
        } catch (e) {}

        await Purchases.purchasePackage(pkg);

        // Re-assert identity after purchase in case SDK flipped to anonymous
        try {
          const after = await Purchases.getAppUserID?.();
          if (after && after !== deviceId) {
            try {
              await Purchases.logIn(String(deviceId));
            } catch (err) {}
          }
        } catch {}

        refreshBalanceWithPolling(); // webhook credits
        Alert.alert(
          t('coinStore.alerts.successTitle'),
          t('coinStore.alerts.successMessage'),
        );
      } catch (e) {
        if (e && e.userCancelled) return;
        Alert.alert(
          t('coinStore.alerts.purchaseFailedTitle'),
          (e && e.message) || t('coinStore.alerts.unknownError'),
        );
      } finally {
        setBuying(false);
        setProcessingPackId(null);
      }
    },
    [refreshBalanceWithPolling, deviceId],
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') refreshBalance();
    });
    return () => sub.remove();
  }, [refreshBalance]);

  return (
    <View style={[styles.container, { backgroundColor: UI.bg }]}>
      {/* Header - Fixed at top */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              const ret = route?.params?.returnTo;
              if (ret && ret.route) {
                if (ret.screen)
                  navigation.navigate(ret.route, { screen: ret.screen });
                else navigation.navigate(ret.route);
              } else {
                navigation.goBack();
              }
            }}
            style={styles.headerBtn}
            hitSlop={8}
          >
            <SvgIcon name="close" size={22} color={UI.textMuted} />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t('coinStore.title')}
          </Text>
          <View style={styles.headerBtn} />
        </View>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={UI.primary} />
          <Text style={styles.loadingHint}>{t('coinStore.loading')}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Balance Section (no card) */}
          <View style={styles.balanceTextBlock}>
            <Text style={styles.balanceBig}>
              {(() => {
                const formattedAmount = Number(balance || 0).toLocaleString(
                  getLocaleForNumberFormatting(i18n.language),
                );
                const template = t('coinStore.balanceValue', {
                  defaultValue: '{{amount}} トークン',
                });
                return template.replace('{{amount}}', formattedAmount);
              })()}
            </Text>
            <Text style={styles.balanceLabel}>
              {t('coinStore.balanceLabel')}
            </Text>
          </View>

          {/* Packs */}
          <View style={styles.packsList}>
            {packs.length === 0 ? (
              <Text style={styles.muted}>{t('coinStore.noPacks')}</Text>
            ) : (
              packs.map((p, idx) => {
                const prod = p?.product || p?.storeProduct || {};
                const rawTitle = prod?.title || p?.identifier || '';
                const fallbackTitle =
                  rawTitle ||
                  t('coinStore.pack.defaultName', { index: idx + 1 });
                const amountDigits = String(rawTitle).replace(/[^\d]/g, '');
                const amount = amountDigits ? Number(amountDigits) : null;
                const price = prod?.priceString || prod?.price?.formatted || '';
                const key = p?.identifier || prod?.identifier || String(idx);
                const variant = idx % 3;
                const tint =
                  variant === 0
                    ? UI.purple
                    : variant === 1
                    ? UI.blue
                    : UI.green;
                const badgeText =
                  variant === 0
                    ? t('coinStore.badges.basic')
                    : variant === 1
                    ? t('coinStore.badges.popular')
                    : t('coinStore.badges.value');
                const subtitleStyle =
                  variant === 1
                    ? styles.packSubtitleBlue
                    : styles.packSubtitleDefault;
                const creditsLabel = amount
                  ? (() => {
                      const formattedCredits = Number(amount).toLocaleString(
                        getLocaleForNumberFormatting(i18n.language),
                      );
                      const template = t('coinStore.pack.creditsLabel', {
                        defaultValue: '{{credits}} credits',
                      });
                      return template.replace('{{credits}}', formattedCredits);
                    })()
                  : fallbackTitle;
                const priceLabel = price || t('coinStore.pack.unknownPrice');
                const packId = key;
                const isProcessing = buying && processingPackId === packId;
                return (
                  <Pressable
                    key={key}
                    onPress={() => buyPack(p, packId)}
                    disabled={buying}
                    style={[styles.packCard, styles.packCardSurface]}
                  >
                    <View style={styles.packRow}>
                      <View style={styles.packLeft}>
                        <CoinIcon size={22} />
                        <View style={styles.packTextWrap}>
                          <Text style={styles.packTitle}>{creditsLabel}</Text>
                          <Text style={subtitleStyle}>{badgeText}</Text>
                        </View>
                      </View>
                      <View style={[styles.pricePill, styles.pricePillDark]}>
                        {isProcessing ? (
                          <ActivityIndicator size="small" color={tint} />
                        ) : (
                          <Text style={[styles.priceText, { color: tint }]}>
                            {priceLabel}
                          </Text>
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>

          <View style={styles.spacer28} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: UI.bg,
  },
  // Header fixed at top
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    backgroundColor: UI.bg,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: { width: 40, height: 40 },
  scrollView: { flex: 1 },
  scrollContent: {
    padding: 16,
    paddingTop: 70,
    flexGrow: 1,
    justifyContent: 'center',
  },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted: { color: UI.textMuted },
  loadingHint: { color: UI.textMuted, marginTop: 8 },
  // Balance (plain section)
  balanceTextBlock: {
    alignItems: 'center',
    marginBottom: 26,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: 10,
  },
  balanceLabel: {
    color: UI.textMuted,
    fontWeight: '500',
    fontSize: 16,
    textAlign: 'center',
    flexWrap: 'wrap',
  },
  balanceBig: {
    color: UI.text,
    fontSize: 30,
    fontWeight: '900',
    marginTop: 10,
    textAlign: 'center',
    flexWrap: 'wrap',
  },

  packsList: { gap: 12, width: '100%', maxWidth: 520, alignSelf: 'center' },
  packCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  packCardSurface: {
    backgroundColor: UI.surface,
    borderColor: UI.border10,
    borderWidth: 1,
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  packLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  packTextWrap: { marginLeft: 12, flex: 1, minWidth: 0 },
  packTitle: {
    color: UI.text,
    fontSize: 17,
    fontWeight: '800',
    flexWrap: 'wrap',
    flexShrink: 1,
    lineHeight: 24,
  },
  packSubtitle: {
    color: UI.textMuted,
    fontSize: 13,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  packSubtitleDefault: {
    color: UI.textMuted,
    fontSize: 13,
    fontWeight: '400',
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  packSubtitleBlue: {
    color: UI.blue,
    fontSize: 13,
    fontWeight: '600',
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  pricePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: 12,
  },
  priceText: { fontWeight: '700', fontSize: 16, textAlign: 'center' },
  pricePillDark: { backgroundColor: UI.bg },
  cardOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  spacer28: { height: 28 },
});

// helper to apply rgba alpha to hex colors like '#RRGGBB'
function withAlpha(hex, alpha) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Map i18n language codes to locale strings for number formatting
function getLocaleForNumberFormatting(i18nLang) {
  const localeMap = {
    ja: 'ja-JP',
    en: 'en-US',
    es: 'es-ES',
    'es-MX': 'es-MX',
    fr: 'fr-FR',
    'fr-CA': 'fr-CA',
    de: 'de-DE',
    it: 'it-IT',
    pt: 'pt-BR',
    ru: 'ru-RU',
    'zh-Hans': 'zh-CN',
    'zh-Hant': 'zh-TW',
    ko: 'ko-KR',
    ar: 'ar-SA',
    nl: 'nl-NL',
    pl: 'pl-PL',
    tr: 'tr-TR',
    he: 'he-IL',
    sv: 'sv-SE',
    da: 'da-DK',
    nb: 'nb-NO',
    fi: 'fi-FI',
    cs: 'cs-CZ',
    sk: 'sk-SK',
    uk: 'uk-UA',
    hr: 'hr-HR',
    hu: 'hu-HU',
    ro: 'ro-RO',
    el: 'el-GR',
    ca: 'ca-ES',
    vi: 'vi-VN',
    th: 'th-TH',
    id: 'id-ID',
    hi: 'hi-IN',
    ms: 'ms-MY',
  };
  return localeMap[i18nLang] || i18nLang || 'en-US';
}

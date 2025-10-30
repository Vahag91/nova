import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, AppState, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Purchases from 'react-native-purchases';
import { ensureDeviceId } from '../lib/deviceId';
import { createSbWithDevice, fetchBalanceByDevice } from '../lib/supabaseDevice';
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

const ArrowRightIcon = ({ size = 18, color = '#FFFFFF' }) => (
  <Svg height={size} width={size} viewBox="0 -960 960 960" fill={color}>
    <Path d="m560-240-56-58 142-142H160v-80h486L504-662l56-58 240 240-240 240Z" />
  </Svg>
);

export default function CoinStore() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const dev = typeof __DEV__ !== 'undefined' && __DEV__;
  const dlog = useCallback((...args) => { if (!dev) return; try { console.log('[CoinStore]', ...args); } catch {} }, [dev]);
  const [deviceId, setDeviceId] = useState(null);
  const [sb, setSb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [packs, setPacks] = useState([]);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        dlog('init start');
        // 1) stable id (RevenueCat is configured globally in SubscriptionContext)
        const id = await ensureDeviceId();
        setDeviceId(id);
        dlog('deviceId', id);

        // Check current RevenueCat app user
        try {
          const rcUserId = (await Purchases.getAppUserID?.()) || '(unknown)';
          const ci = await Purchases.getCustomerInfo?.();
          const original = ci?.originalAppUserId || '(unknown)';
          dlog('RC appUserID', rcUserId, 'originalAppUserId', original);
          if (rcUserId && id && rcUserId !== id) {
            dlog('RC/DeviceId MISMATCH', { deviceId: id, rcUserId, originalAppUserId: original });
          }
        } catch (e) {
          dlog('RC user check error', e?.message || String(e));
        }
        // Compare RC appUserID with our deviceId to spot mismatch
        try {
          const rcUser = (typeof Purchases.getAppUserID === 'function')
            ? await Purchases.getAppUserID()
            : (await Purchases.getCustomerInfo())?.originalAppUserId;
          dlog('RC appUserID', rcUser, 'match:', rcUser === id);
        } catch (e) {
          dlog('getAppUserID/customerInfo error', e?.message || String(e));
        }

        // 2) supabase client
        const client = createSbWithDevice(id);
        setSb(client);
        dlog('supabase client created');

        // 3) parallel: balance + offerings (RC already configured by SubscriptionProvider)
        const [bal, offerings] = await Promise.all([
          fetchBalanceByDevice(client, id),
          Purchases.getOfferings(),
        ]);
        dlog('balance fetched', bal);
        setBalance(bal);
        // Select 'coins' offering first; fall back to current
        const allKeys = offerings?.all ? Object.keys(offerings.all) : [];
        dlog('offerings keys', allKeys, 'current:', offerings?.current?.identifier);
        const coinsOffering = (offerings?.all && offerings.all.coins) || offerings?.current || null;
        const available = Array.isArray(coinsOffering?.availablePackages) ? coinsOffering.availablePackages : [];
        dlog('using offering', coinsOffering?.identifier || '(none)', 'packages:', available.map(p => p?.identifier));

        setPacks(available);
      } catch (e) {
        dlog('init error', e?.message || String(e));
        Alert.alert('Init error', e?.message || String(e));
      } finally {
        setLoading(false);
        dlog('init done');
      }
    })();
  }, [dlog]);

  const refreshBalance = useCallback(async () => {
    if (!sb || !deviceId) return;
    try {
      const bal = await fetchBalanceByDevice(sb, deviceId);
      setBalance(bal);
      dlog('balance refreshed', bal);
    } catch (e) {
      dlog('refresh balance error', e?.message || String(e));
    }
  }, [sb, deviceId, dlog]);

  const refreshBalanceWithPolling = useCallback(async (tries = 5, delayMs = 1200) => {
    for (let i = 0; i < tries; i++) {
      await refreshBalance();
      await new Promise(r => setTimeout(r, delayMs));
    }
  }, [refreshBalance]);

  const buyPack = useCallback(async (pkg) => {
    if (!pkg || !deviceId) return;
    setBuying(true);
    try {
      const prod = pkg?.product || pkg?.storeProduct;
      dlog('purchase attempt', { pkgId: pkg?.identifier, productId: prod?.identifier, title: prod?.title, price: prod?.priceString });

      // Ensure RC identity matches deviceId before purchasing
      try {
        const current = await Purchases.getAppUserID?.();
        if (current && current !== deviceId) {
          dlog('forcing RC logIn before purchase', { current, deviceId });
          try { await Purchases.logIn(String(deviceId)); } catch (err) { dlog('logIn before error', err?.message || String(err)); }
        }
      } catch (e) { dlog('pre-purchase userId check error', e?.message || String(e)); }

      await Purchases.purchasePackage(pkg);
      dlog('purchase success');

      // Re-assert identity after purchase in case SDK flipped to anonymous
      try {
        const after = await Purchases.getAppUserID?.();
        dlog('RC appUserID after purchase', after);
        if (after && after !== deviceId) {
          dlog('forcing RC logIn after purchase', { after, deviceId });
          try { await Purchases.logIn(String(deviceId)); } catch (err) { dlog('logIn after error', err?.message || String(err)); }
        }
      } catch {}

      // Re-check and log match state
      try {
        const rcUser = (typeof Purchases.getAppUserID === 'function')
          ? await Purchases.getAppUserID()
          : (await Purchases.getCustomerInfo())?.originalAppUserId;
        dlog('RC appUserID (post-purchase)', rcUser, 'match:', rcUser === deviceId);
      } catch {}

      refreshBalanceWithPolling(); // webhook credits
      Alert.alert('Success', 'Coins will appear shortly.');
    } catch (e) {
      if (e && e.userCancelled) return;
      dlog('purchase failed', e?.message || String(e));
      Alert.alert('Purchase failed', (e && e.message) || 'Unknown error');
    } finally {
      setBuying(false);
    }
  }, [refreshBalanceWithPolling, deviceId, dlog]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      dlog('AppState', s);
      if (s === 'active') refreshBalance();
    });
    return () => sub.remove();
  }, [refreshBalance, dlog]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: UI.bg }]} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 6) }]}>
        <Pressable
          onPress={() => {
            const ret = route?.params?.returnTo;
            if (ret && ret.route) {
              if (ret.screen) navigation.navigate(ret.route, { screen: ret.screen });
              else navigation.navigate(ret.route);
            } else {
              navigation.goBack();
            }
          }}
          style={styles.headerBtn}
        >
          <SvgIcon name="close" size={22} color={UI.textMuted} />
        </Pressable>
        <Text style={styles.headerTitle}>Get Tokens</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color={UI.primary} />
          <Text style={styles.loadingHint}>Loading coin store…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Balance Section (no card) */}
          <View style={styles.balanceTextBlock}>
            <Text style={styles.balanceLabel}>Your current balance is</Text>
            <Text style={styles.balanceBig}>{`${Number(balance || 0).toLocaleString()} Tokens`}</Text>
            <Pressable onPress={() => Alert.alert('History', 'Transaction History is coming soon.')}>
              <Text style={styles.historyLink}>Transaction History</Text>
            </Pressable>
          </View>

          {/* Packs */}
          <View style={styles.packsList}>
            {packs.length === 0 ? (
              <Text style={styles.muted}>No coin packs available. Check your RevenueCat offering id.</Text>
            ) : (
              packs.map((p, idx) => {
                const prod = p?.product || p?.storeProduct || {};
                const rawTitle = prod?.title || p?.identifier || `Pack ${idx+1}`;
                const amountMatch = String(rawTitle).match(/\d+/);
                const amount = amountMatch ? Number(amountMatch[0]) : null;
                const price = prod?.priceString || prod?.price?.formatted || '';
                const key = p?.identifier || prod?.identifier || String(idx);
                const variant = idx % 3;
                const tint = variant === 0 ? UI.purple : variant === 1 ? UI.blue : UI.green;
                const badgeText = variant === 0 ? 'Basic Pack' : variant === 1 ? 'Most Popular' : 'Best Value';
                const subtitleStyle = variant === 1 ? styles.packSubtitleBlue : styles.packSubtitleDefault;
                return (
                  <Pressable key={key} onPress={() => buyPack(p)} disabled={buying}
                    style={[styles.packCard, styles.packCardSurface]}>

                    <View style={styles.packRow}>
                      <View style={styles.packLeft}>
                        <CoinIcon size={22} />
                        <View style={styles.packTextWrap}>
                          <Text style={styles.packTitle}>{amount ? `${amount} Tokens` : rawTitle}</Text>
                          <Text style={subtitleStyle}>{badgeText}</Text>
                        </View>
                      </View>
                      <View style={[styles.pricePill, styles.pricePillDark]}>
                        <Text style={[styles.priceText, { color: tint }]}>{price || '$—'}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })
            )}
          </View>

          {/* Premium CTA */}
          <Pressable onPress={() => navigation.navigate('PaywallScreen')} style={[styles.premiumCard, { borderColor: UI.border10, backgroundColor: UI.surface }]}>
            <View style={styles.premiumRow}>
              <View>
                <Text style={styles.premiumTitle}>Go Premium</Text>
                <Text style={styles.premiumSubtitle}>Unlimited access & features</Text>
              </View>
              <View style={[styles.upgradePill, { backgroundColor: UI.primary }]}>
                <Text style={styles.upgradePillText}>Upgrade</Text>
                <ArrowRightIcon size={18} color={UI.white} />
              </View>
            </View>
          </Pressable>

          <Text style={styles.termsText}>By making a purchase, you agree to our <Text style={styles.underline}>Terms of Service</Text>.</Text>

          <View style={styles.spacer28} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Removed negative margin to avoid top gap under full-screen modal
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  headerSpacer: { width: 40, height: 40 },
  scrollContent: { padding: 16, paddingTop: 10 },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted: { color: UI.textMuted },
  loadingHint: { color: UI.textMuted, marginTop: 8 },
  // Balance (plain section)
  balanceTextBlock: { alignItems: 'center', marginBottom: 16 },
  balanceLabel: { color: UI.textMuted, fontWeight: '500', fontSize: 12 },
  balanceBig: { color: UI.text, fontSize: 36, fontWeight: '900', marginTop: 6 },
  historyLink: { marginTop: 6, color: withAlpha(UI.primary, 0.8), textDecorationLine: 'underline', textAlign: 'center', fontSize: 12 },

  packsList: { gap: 12 },
  packCard: { borderWidth: 1, borderRadius: 24, padding: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  packCardSurface: { backgroundColor: UI.surface, borderColor: UI.border10, borderWidth: 1 },
  packRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  packLeft: { flexDirection: 'row', alignItems: 'center' },
  packTextWrap: { marginLeft: 12 },
  packTitle: { color: UI.text, fontSize: 20, fontWeight: '800' },
  packSubtitle: { color: UI.textMuted, fontSize: 13 },
  packSubtitleDefault: { color: UI.textMuted, fontSize: 13, fontWeight: '400' },
  packSubtitleBlue: { color: UI.blue, fontSize: 13, fontWeight: '600' },
  pricePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  priceText: { fontWeight: '700', fontSize: 16 },
  pricePillDark: { backgroundColor: UI.bg },
  cardOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  iconBubble: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  premiumCard: { marginTop: 16, borderRadius: 24, padding: 20, borderWidth: 1 },
  premiumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  premiumTitle: { color: UI.text, fontSize: 20, fontWeight: '800' },
  premiumSubtitle: { color: UI.textMuted, fontSize: 13, marginTop: 4 },
  upgradePill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  upgradePillText: { color: UI.white, fontWeight: '700' },
  termsText: { color: UI.textMuted, fontSize: 12, textAlign: 'center', marginTop: 12 },
  underline: { textDecorationLine: 'underline', color: UI.textMuted },
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

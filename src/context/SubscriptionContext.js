import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import {
  GOOGLE_PLAY_DISPLAY_PRODUCTS,
  REVENUE_OFFERINGS_BASE_URL,
  REVENUE_PUBLIC_ANDROID,
  REVENUE_ENTITLEMENT_ID,
  OFFERING_IDS,
} from '../config/payments';

// ✅ NEW: bring your stable device id
import { ensureDeviceId } from '../lib/deviceId';
import {
  getReviewerPremiumEnabled,
  setReviewerPremiumEnabled,
  setReviewerPremiumCoinsGranted,
} from '../lib/reviewerPremium';
import { consumePendingPremiumAction } from '../state/premiumActions';
import {
  createSbWithDevice,
  fetchBalanceByDevice,
  grantReviewerCoins,
} from '../lib/supabaseDevice';
import { useImagesStore } from '../state/useImagesStore';
import { useSettingsStore } from '../state/useSettingsStore';
import { installRevenueCatLogHandler } from '../lib/revenueCatLogging';
import { logException } from '../error/logger';
import { runStartupTask } from '../lib/startupTimeout';

export const SubscriptionContext = createContext(null);
export const SubscriptionAccessContext = createContext(null);

const STORAGE_KEY = '@isPremium';
const RC_GUARD_KEY = '__RC_CONFIGURED__';
const RC_CONFIGURED_API_KEY = '__RC_CONFIGURED_API_KEY__';
// Google documents SERVICE_UNAVAILABLE (Billing response code 2) as transient.
// Give RevenueCat enough time to recover its Billing connection, then retry the
// product-details operation with bounded backoff while the paywall is open.
const OFFERINGS_TIMEOUT_MS = 4000;
const OFFERINGS_RETRY_DELAYS_MS = [0, 750];

function waitForOfferingsRetry(delayMs) {
  if (!delayMs) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, delayMs));
}

function getRevenueCatPremiumFromInfo(info) {
  const active = info?.entitlements?.active || {};
  const entitlementId = (REVENUE_ENTITLEMENT_ID || '').trim();
  return entitlementId ? !!active[entitlementId] : false;
}

function getSubscriptionPeriodKey(product) {
  const subscriptionPeriod = String(product?.subscriptionPeriod || '').toUpperCase();

  if (!subscriptionPeriod) {
    return null;
  }
  if (subscriptionPeriod === 'P1W' || subscriptionPeriod === 'P7D') {
    return 'weekly';
  }
  if (subscriptionPeriod === 'P1M') {
    return 'monthly';
  }
  if (subscriptionPeriod === 'P1Y') {
    return 'yearly';
  }

  return null;
}

function getPackageSlot(pkg) {
  const packageType = String(pkg?.packageType || '').toUpperCase();

  if (packageType === 'WEEKLY') {
    return 'weekly';
  }
  if (packageType === 'MONTHLY') {
    return 'monthly';
  }
  if (packageType === 'ANNUAL') {
    return 'yearly';
  }
  if (packageType === 'LIFETIME') {
    return 'oneTime';
  }

  if (pkg?.identifier === '$rc_weekly') {
    return 'weekly';
  }
  if (pkg?.identifier === '$rc_monthly') {
    return 'monthly';
  }
  if (pkg?.identifier === '$rc_annual') {
    return 'yearly';
  }
  if (pkg?.identifier === '$rc_lifetime') {
    return 'oneTime';
  }

  if (pkg?.identifier === '$rc_lifetime') {
    return 'oneTime';
  }

  const periodKey = getSubscriptionPeriodKey(pkg?.product);
  if (periodKey) {
    return periodKey;
  }

  const productIdentifier = String(pkg?.product?.identifier || '').toLowerCase();
  if (productIdentifier.includes('weekly')) {
    return 'weekly';
  }
  if (productIdentifier.includes('monthly')) {
    return 'monthly';
  }
  if (productIdentifier.includes('annual') || productIdentifier.includes('yearly')) {
    return 'yearly';
  }

  return null;
}

function getServerPackageSlot(pkg) {
  const packageIdentifier = String(pkg?.identifier || '').toLowerCase();
  const productIdentifier = String(
    pkg?.platform_product_identifier || '',
  ).toLowerCase();
  const planIdentifier = String(
    pkg?.platform_product_plan_identifier || '',
  ).toLowerCase();

  if (
    packageIdentifier === '$rc_weekly' ||
    productIdentifier.includes('weekly') ||
    planIdentifier === 'weekly'
  ) {
    return 'weekly';
  }
  if (
    packageIdentifier === '$rc_annual' ||
    productIdentifier.includes('annual') ||
    productIdentifier.includes('yearly') ||
    planIdentifier === 'yearly'
  ) {
    return 'yearly';
  }
  return null;
}

export function SubscriptionProvider({
  children,
  deferNetworkWork = false,
  prefetchDuringOnboarding = false,
}) {
  const [hasRevenueCatPremium, setHasRevenueCatPremium] = useState(false);
  const [reviewerPremiumEnabled, setReviewerPremiumActive] = useState(false);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [availablePackages, setAvailablePackages] = useState({
    weekly: null,
    monthly: null,
    yearly: null,
    oneTime: null,
  });
  const [offeredPackages, setOfferedPackages] = useState({
    weekly: null,
    monthly: null,
    yearly: null,
    oneTime: null,
  });
  const [restoring, setRestoring] = useState(false);
  const [subscriptionReady, setSubscriptionReady] = useState(false);
  const [entitlementCacheReady, setEntitlementCacheReady] = useState(false);
  const [offeringsState, setOfferingsState] = useState('idle');

  const configuredRef = useRef(false);
  const revenueCatPremiumRef = useRef(false);
  const reviewerPremiumRef = useRef(false);
  const lastEffectivePremiumRef = useRef(false);
  const offeringsRequestRef = useRef(null);
  const subscriptionReadyRef = useRef(false);
  const subscriptionReadyWaitersRef = useRef(new Set());

  const apiKey = String(REVENUE_PUBLIC_ANDROID || '').trim();
  const paymentsEnabled = apiKey.length > 0;
  const isPremium = hasRevenueCatPremium || reviewerPremiumEnabled;

  const markSubscriptionReady = useCallback(() => {
    const premium =
      revenueCatPremiumRef.current || reviewerPremiumRef.current;

    subscriptionReadyRef.current = true;
    setSubscriptionReady(true);

    const waiters = Array.from(subscriptionReadyWaitersRef.current);
    subscriptionReadyWaitersRef.current.clear();
    waiters.forEach(resolve => resolve(premium));

    return premium;
  }, []);

  const waitForSubscriptionReady = useCallback(() => {
    if (subscriptionReadyRef.current) {
      return Promise.resolve(
        revenueCatPremiumRef.current || reviewerPremiumRef.current,
      );
    }

    return new Promise(resolve => {
      const finish = premium => {
        subscriptionReadyWaitersRef.current.delete(finish);
        resolve(!!premium);
      };

      subscriptionReadyWaitersRef.current.add(finish);
    });
  }, []);

  const refreshCoinsBalance = useCallback(async () => {
    const deviceId = await ensureDeviceId();
    const sb = createSbWithDevice(deviceId);
    const balance = await fetchBalanceByDevice(sb, deviceId);
    useImagesStore.getState().setCoinsBalance(balance);
    return balance;
  }, []);

  const ensureReviewerCoinsBalance = useCallback(async () => {
    const deviceId = await ensureDeviceId();
    const balance = await grantReviewerCoins(deviceId);
    useImagesStore.getState().setCoinsBalance(balance);
    await setReviewerPremiumCoinsGranted(true);
    return balance;
  }, []);

  const syncPremiumState = useCallback(
    async ({
      revenueCatPremium,
      reviewerPremium = reviewerPremiumRef.current,
      info,
      persistRevenueCat = true,
    }) => {
      const nextRevenueCatPremium = !!revenueCatPremium;
      const nextReviewerPremium = !!reviewerPremium;
      const effectivePremium = nextRevenueCatPremium || nextReviewerPremium;

      revenueCatPremiumRef.current = nextRevenueCatPremium;
      reviewerPremiumRef.current = nextReviewerPremium;

      setHasRevenueCatPremium(nextRevenueCatPremium);
      setReviewerPremiumActive(nextReviewerPremium);

      if (typeof info !== 'undefined') {
        setCustomerInfo(info);
      }

      markSubscriptionReady();

      if (persistRevenueCat) {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(nextRevenueCatPremium),
        );
      }

      const validateModel = useSettingsStore.getState().validateModelForPremium;
      if (validateModel) {
        validateModel(effectivePremium);
      }

      if (effectivePremium && !lastEffectivePremiumRef.current) {
        consumePendingPremiumAction();
      }

      lastEffectivePremiumRef.current = effectivePremium;

      return effectivePremium;
    },
    [markSubscriptionReady],
  );

  const pollForCoinsBalanceUpdate = useCallback(async (previousBalance) => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        const balance = await refreshCoinsBalance();
        if (typeof previousBalance !== 'number' || balance !== previousBalance) {
          return balance;
        }
      } catch {}

      if (attempt < 7) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    return typeof previousBalance === 'number' ? previousBalance : null;
  }, [refreshCoinsBalance]);

  useEffect(() => {
    let removeListener;
    let interactionTask;
    let cancelled = false;
    runStartupTask(async () => {
      try {
        const cachedPremium = await AsyncStorage.getItem(STORAGE_KEY);
        const cachedRevenueCatPremium =
          cachedPremium !== null ? !!JSON.parse(cachedPremium) : false;
        if (cachedPremium !== null) {
          setHasRevenueCatPremium(cachedRevenueCatPremium);
          revenueCatPremiumRef.current = cachedRevenueCatPremium;
        }

        const reviewerPremium = await getReviewerPremiumEnabled();
        reviewerPremiumRef.current = reviewerPremium;
        setReviewerPremiumActive(reviewerPremium);
        lastEffectivePremiumRef.current =
          cachedRevenueCatPremium || reviewerPremium;
        if (!cancelled) {
          setEntitlementCacheReady(true);
        }
        if (!paymentsEnabled) {
          markSubscriptionReady();
          return;
        }
        if (deferNetworkWork) return;

        // On first launch, begin the native/network work while onboarding is
        // visible so the paywall can reuse cached offerings. Returning users
        // keep the existing after-interactions scheduling for startup safety.
        if (!prefetchDuringOnboarding) {
          await new Promise(resolve => {
            interactionTask = InteractionManager.runAfterInteractions(resolve);
          });
        }
        if (cancelled) return;

        if (reviewerPremium) {
          ensureReviewerCoinsBalance().catch(async () => {
            try {
              await refreshCoinsBalance();
            } catch {
              useImagesStore.getState().setCoinsBalance(null);
            }
          });
        }

        installRevenueCatLogHandler(Purchases);

        // Configure RevenueCat only once for the app lifetime.
        // Prefer React Native's global, then globalThis, then window
        const root = (typeof global !== 'undefined')
          ? global
          : (typeof window !== 'undefined')
            ? window
            : {};
        const configuredKey = String(root[RC_CONFIGURED_API_KEY] || '');
        let alreadyConfigured =
          configuredRef.current ||
          (!!root[RC_GUARD_KEY] && configuredKey === apiKey);
        if (!alreadyConfigured) {
          // Preflight: if Purchases is already configured elsewhere, this will work.
          try {
            const sdkConfigured = await Purchases.isConfigured();
            if (sdkConfigured && configuredKey === apiKey) {
              alreadyConfigured = true;
            }
          } catch {}
        }

        if (!alreadyConfigured) {
          await Purchases.configure({ apiKey });
          configuredRef.current = true;
          try {
            root[RC_GUARD_KEY] = true;
            root[RC_CONFIGURED_API_KEY] = apiKey;
          } catch {}
        } else {
          configuredRef.current = true;
          try {
            root[RC_GUARD_KEY] = true;
            root[RC_CONFIGURED_API_KEY] = apiKey;
          } catch {}
        }

        // ✅ NEW: ensure appUserID is your stable device id (required for coins)
        try {
          const deviceId = await ensureDeviceId();
          await Purchases.logIn(String(deviceId));
        } catch (e) {}

        // keep info fresh when RevenueCat pushes updates
        removeListener = Purchases.addCustomerInfoUpdateListener(async (info) => {
          await handleCustomerInfo(info);
        });

        // Start products first; customer-info refresh and offering download are
        // independent after configuration/login. Do not await this here so a
        // slow entitlement refresh cannot make prices load inside the paywall.
        fetchOfferings().catch(error => {
          logException(error, { context: 'prefetchRevenueCatOfferings' });
        });
        const info = await Purchases.getCustomerInfo();
        await handleCustomerInfo(info);
      } catch (err) {
        markSubscriptionReady();
        throw err;
      }
    }, {
      label: 'initializeSubscriptions',
      onError: (error, details) => {
        setEntitlementCacheReady(true);
        // A timeout does not cancel the native request. Keep premium checks
        // queued until that request reports a real entitlement result, while
        // still allowing the paywall UI to leave its startup loading state.
        if (details.timedOut && paymentsEnabled) {
          setSubscriptionReady(true);
        } else {
          markSubscriptionReady();
        }
        console.warn(
          `[startup] ${details.context} ${details.timedOut ? 'timed out' : 'failed'}:`,
          error?.message || String(error),
        );
        logException(error, { ...details, startup: true });
      },
    });

    return () => {
      cancelled = true;
      interactionTask?.cancel?.();
      try {
        if (typeof removeListener === 'function') removeListener();
        else if (removeListener && typeof removeListener.remove === 'function') removeListener.remove();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    apiKey,
    deferNetworkWork,
    ensureReviewerCoinsBalance,
    paymentsEnabled,
    prefetchDuringOnboarding,
    markSubscriptionReady,
    refreshCoinsBalance,
  ]);

  const handleCustomerInfo = useCallback(async (info) => {
    try {
      const hasPremium = getRevenueCatPremiumFromInfo(info);
      return await syncPremiumState({
        revenueCatPremium: hasPremium,
        reviewerPremium: reviewerPremiumRef.current,
        info,
      });
    } catch (e) {}
    return false;
  }, [syncPremiumState]);

  const activateReviewerPremium = useCallback(async () => {
    await setReviewerPremiumEnabled(true);
    await syncPremiumState({
      revenueCatPremium: revenueCatPremiumRef.current,
      reviewerPremium: true,
      info: customerInfo,
      persistRevenueCat: false,
    });

    try {
      await ensureReviewerCoinsBalance();
    } catch {
      try {
        await refreshCoinsBalance();
      } catch {
        useImagesStore.getState().setCoinsBalance(null);
      }
    }
  }, [customerInfo, ensureReviewerCoinsBalance, refreshCoinsBalance, syncPremiumState]);

  const deactivateReviewerPremium = useCallback(async () => {
    await setReviewerPremiumEnabled(false);

    let actualRevenueCatPremium = revenueCatPremiumRef.current;

    if (apiKey) {
      try {
        const info = await Purchases.getCustomerInfo();
        actualRevenueCatPremium = getRevenueCatPremiumFromInfo(info);
        await syncPremiumState({
          revenueCatPremium: actualRevenueCatPremium,
          reviewerPremium: false,
          info,
        });
        return;
      } catch {}
    }

    await syncPremiumState({
      revenueCatPremium: actualRevenueCatPremium,
      reviewerPremium: false,
      info: customerInfo,
    });
  }, [apiKey, customerInfo, syncPremiumState]);

  const purchasePackage = useCallback(async (pkg) => {
    if (!paymentsEnabled) {
      throw new Error('Android purchases are not configured.');
    }
    try {
      const previousBalance = useImagesStore.getState().coinsBalance;
      const result = await Purchases.purchasePackage(pkg);
      await handleCustomerInfo(result.customerInfo);
      pollForCoinsBalanceUpdate(previousBalance).catch(() => {});
      return result;
    } catch (err) {
      throw err;
    }
  }, [handleCustomerInfo, paymentsEnabled, pollForCoinsBalanceUpdate]);

  const restorePurchases = useCallback(async () => {
    if (!paymentsEnabled) {
      throw new Error('Android purchases are not configured.');
    }
    setRestoring(true);
    try {
      const previousBalance = useImagesStore.getState().coinsBalance;
      const info = await Purchases.restorePurchases();
      await handleCustomerInfo(info);
      pollForCoinsBalanceUpdate(previousBalance).catch(() => {});
      return info;
    } catch (err) {
      throw err;
    } finally {
      setRestoring(false);
    }
  }, [handleCustomerInfo, paymentsEnabled, pollForCoinsBalanceUpdate]);

  const refreshCustomerInfo = useCallback(async () => {
    if (!paymentsEnabled) {
      return reviewerPremiumRef.current;
    }
    try {
      const info = await Purchases.getCustomerInfo();
      return await handleCustomerInfo(info);
    } catch (err) {}
    return revenueCatPremiumRef.current || reviewerPremiumRef.current;
  }, [handleCustomerInfo, paymentsEnabled]);

  const logOutRevenueCat = useCallback(async () => {
    if (!paymentsEnabled) {
      return;
    }
    try {
      await Purchases.logOut();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(false));
      revenueCatPremiumRef.current = false;
      setHasRevenueCatPremium(false);
      setCustomerInfo(null);
      lastEffectivePremiumRef.current = reviewerPremiumRef.current;
    } catch (e) {}
  }, [paymentsEnabled]);

  const logInRevenueCat = useCallback(async (appUserId) => {
    if (!paymentsEnabled) {
      throw new Error('Android purchases are not configured.');
    }
    try {
      const info = await Purchases.logIn(String(appUserId));
      await handleCustomerInfo(info?.customerInfo || info);
      return info;
    } catch (e) {
      throw e;
    }
  }, [handleCustomerInfo, paymentsEnabled]);

  const fetchRevenueCatOfferingCatalog = useCallback(async () => {
    const deviceId = await ensureDeviceId();
    const response = await fetch(
      `${REVENUE_OFFERINGS_BASE_URL}/${encodeURIComponent(
        String(deviceId),
      )}/offerings`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'X-Platform': 'android',
        },
      },
    );
    if (!response.ok) {
      throw new Error(
        `RevenueCat offering catalog failed with HTTP ${response.status}.`,
      );
    }

    const payload = await response.json();
    const offerings = Array.isArray(payload?.offerings) ? payload.offerings : [];
    const offering =
      offerings.find(item => item?.identifier === payload?.current_offering_id) ||
      offerings.find(item => item?.identifier === OFFERING_IDS.default) ||
      offerings[0] ||
      null;
    const next = { weekly: null, monthly: null, yearly: null, oneTime: null };

    for (const serverPackage of offering?.packages || []) {
      const slot = getServerPackageSlot(serverPackage);
      const displayProduct = slot ? GOOGLE_PLAY_DISPLAY_PRODUCTS[slot] : null;
      if (!slot || !displayProduct || next[slot]) continue;
      if (
        String(serverPackage?.platform_product_identifier || '') !==
          displayProduct.identifier ||
        String(serverPackage?.platform_product_plan_identifier || '') !==
          displayProduct.basePlanIdentifier
      ) {
        continue;
      }

      next[slot] = {
        identifier: serverPackage.identifier,
        productIdentifier: serverPackage.platform_product_identifier,
        basePlanIdentifier: serverPackage.platform_product_plan_identifier,
        product: displayProduct,
      };
    }

    setOfferedPackages(next);
    console.info(
      '[RevenueCat] offering catalog loaded',
      JSON.stringify({
        offering: offering?.identifier || null,
        weekly: next.weekly
          ? {
              product: next.weekly.productIdentifier,
              basePlan: next.weekly.basePlanIdentifier,
              price: next.weekly.product.priceString,
            }
          : null,
        yearly: next.yearly
          ? {
              product: next.yearly.productIdentifier,
              basePlan: next.yearly.basePlanIdentifier,
              price: next.yearly.product.priceString,
            }
          : null,
      }),
    );
    return next;
  }, [apiKey]);

  const fetchOfferings = useCallback(async () => {
    if (!paymentsEnabled) {
      return {
        weekly: null,
        monthly: null,
        yearly: null,
        oneTime: null,
      };
    }
    if (offeringsRequestRef.current) {
      return offeringsRequestRef.current;
    }

    setOfferingsState('loading');
    const request = (async () => {
      let lastError = null;
      try {
        fetchRevenueCatOfferingCatalog().catch(error => {
          logException(error, { context: 'fetchRevenueCatOfferingCatalog' });
        });

        for (
          let attempt = 0;
          attempt < OFFERINGS_RETRY_DELAYS_MS.length;
          attempt += 1
        ) {
          await waitForOfferingsRetry(OFFERINGS_RETRY_DELAYS_MS[attempt]);

          let timeoutId = null;
          try {
            const offerings = await Promise.race([
              Purchases.getOfferings(),
              new Promise((_, reject) => {
                timeoutId = setTimeout(
                  () => reject(new Error('Offerings request timed out.')),
                  OFFERINGS_TIMEOUT_MS,
                );
              }),
            ]);
            const next = {
              weekly: null,
              monthly: null,
              yearly: null,
              oneTime: null,
            };
            const offeringsMap = offerings?.all || {};
            const defaultOffering =
              offeringsMap[OFFERING_IDS.default] ||
              offerings?.current ||
              Object.values(offeringsMap)[0] ||
              null;
            const oneTimeOffering = offeringsMap[OFFERING_IDS.oneTime];

            const mapPackages = offering => {
              const packages = offering?.availablePackages || [];
              for (const pkg of packages) {
                const slot = getPackageSlot(pkg);
                if (slot && !next[slot]) {
                  next[slot] = pkg;
                }
              }
            };

            mapPackages(defaultOffering);
            if (oneTimeOffering && oneTimeOffering !== defaultOffering) {
              mapPackages(oneTimeOffering);
            }

            if (!next.weekly && !next.yearly && !next.monthly && !next.oneTime) {
              throw new Error(
                'RevenueCat returned no purchasable Google Play packages.',
              );
            }

            // A product's localized price can change while its package
            // identifier remains the same. Accept every successful refresh so
            // the paywall never keeps stale Play pricing in memory.
            setAvailablePackages(next);
            setOfferingsState('ready');
            return next;
          } catch (error) {
            lastError = error;
          } finally {
            if (timeoutId !== null) clearTimeout(timeoutId);
          }
        }

        setOfferingsState('error');
        if (lastError) {
          logException(lastError, {
            context: 'fetchRevenueCatOfferings',
            attempts: OFFERINGS_RETRY_DELAYS_MS.length,
          });
        }
        return undefined;
      } finally {
        offeringsRequestRef.current = null;
      }
    })();

    offeringsRequestRef.current = request;
    return request;
  }, [fetchRevenueCatOfferingCatalog, paymentsEnabled]);

  const value = useMemo(() => ({
    isPremium,
    customerInfo,
    availablePackages,
    offeredPackages,
    restoring,
    subscriptionReady,
    entitlementCacheReady,
    offeringsState,
    paymentsEnabled,
    reviewerPremiumEnabled,
    purchasePackage,
    restorePurchases,
    refreshCustomerInfo,
    waitForSubscriptionReady,
    fetchOfferings,
    logOutRevenueCat,
    logInRevenueCat,
    activateReviewerPremium,
    deactivateReviewerPremium,
  }), [
    activateReviewerPremium,
    availablePackages,
    customerInfo,
    deactivateReviewerPremium,
    fetchOfferings,
    isPremium,
    logInRevenueCat,
    logOutRevenueCat,
    paymentsEnabled,
    purchasePackage,
    refreshCustomerInfo,
    waitForSubscriptionReady,
    restoring,
    restorePurchases,
    reviewerPremiumEnabled,
    offeringsState,
    offeredPackages,
    subscriptionReady,
    entitlementCacheReady,
  ]);

  const accessValue = useMemo(() => ({
    isPremium,
    subscriptionReady,
    entitlementCacheReady,
    paymentsEnabled,
    refreshCustomerInfo,
    waitForSubscriptionReady,
  }), [
    entitlementCacheReady,
    isPremium,
    paymentsEnabled,
    refreshCustomerInfo,
    waitForSubscriptionReady,
    subscriptionReady,
  ]);

  return (
    <SubscriptionAccessContext.Provider value={accessValue}>
      <SubscriptionContext.Provider value={value}>
        {children}
      </SubscriptionContext.Provider>
    </SubscriptionAccessContext.Provider>
  );
}

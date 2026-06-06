import React, { createContext, useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import {
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

const STORAGE_KEY = '@isPremium';
const RC_GUARD_KEY = '__RC_CONFIGURED__';
const RC_CONFIGURED_API_KEY = '__RC_CONFIGURED_API_KEY__';

function getRevenueCatPremiumFromInfo(info) {
  const active = info?.entitlements?.active || {};
  const entitlementId = (REVENUE_ENTITLEMENT_ID || '').trim();
  let hasPremium = entitlementId ? !!active[entitlementId] : false;

  // Fallback: if entitlement id is misconfigured but any entitlement is active, treat as premium
  if (!hasPremium && Object.keys(active).length > 0) {
    hasPremium = true;
  }

  return hasPremium;
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

export function SubscriptionProvider({ children }) {
  const [hasRevenueCatPremium, setHasRevenueCatPremium] = useState(false);
  const [reviewerPremiumEnabled, setReviewerPremiumActive] = useState(false);
  const [customerInfo, setCustomerInfo] = useState(null);
  const [availablePackages, setAvailablePackages] = useState({
    weekly: null,
    monthly: null,
    yearly: null,
    oneTime: null,
  });
  const [restoring, setRestoring] = useState(false);
  const [subscriptionReady, setSubscriptionReady] = useState(false);

  const configuredRef = useRef(false);
  const revenueCatPremiumRef = useRef(false);
  const reviewerPremiumRef = useRef(false);
  const lastEffectivePremiumRef = useRef(false);

  const apiKey = String(REVENUE_PUBLIC_ANDROID || '').trim();
  const paymentsEnabled = apiKey.length > 0;
  const isPremium = hasRevenueCatPremium || reviewerPremiumEnabled;

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

      setSubscriptionReady(true);

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
    [],
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
        if (reviewerPremium) {
          ensureReviewerCoinsBalance().catch(async () => {
            try {
              await refreshCoinsBalance();
            } catch {
              useImagesStore.getState().setCoinsBalance(null);
            }
          });
        }

        if (!paymentsEnabled) {
          setSubscriptionReady(true);
          return;
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

        const info = await Purchases.getCustomerInfo();
        await handleCustomerInfo(info);
        await fetchOfferings();
      } catch (err) {
        setSubscriptionReady(true);
        throw err;
      }
    }, {
      label: 'initializeSubscriptions',
      onError: (error, details) => {
        setSubscriptionReady(true);
        console.warn(
          `[startup] ${details.context} ${details.timedOut ? 'timed out' : 'failed'}:`,
          error?.message || String(error),
        );
        logException(error, { ...details, startup: true });
      },
    });

    return () => {
      try {
        if (typeof removeListener === 'function') removeListener();
        else if (removeListener && typeof removeListener.remove === 'function') removeListener.remove();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, ensureReviewerCoinsBalance, paymentsEnabled, refreshCoinsBalance]);

  const handleCustomerInfo = async (info) => {
    try {
      const hasPremium = getRevenueCatPremiumFromInfo(info);
      return await syncPremiumState({
        revenueCatPremium: hasPremium,
        reviewerPremium: reviewerPremiumRef.current,
        info,
      });
    } catch (e) {}
    return false;
  };

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

  const purchasePackage = async (pkg) => {
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
  };

  const restorePurchases = async () => {
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
  };

  const refreshCustomerInfo = async () => {
    if (!paymentsEnabled) {
      return reviewerPremiumRef.current;
    }
    try {
      const info = await Purchases.getCustomerInfo();
      return await handleCustomerInfo(info);
    } catch (err) {}
    return revenueCatPremiumRef.current || reviewerPremiumRef.current;
  };

  const logOutRevenueCat = async () => {
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
  };

  const logInRevenueCat = async (appUserId) => {
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
  };

  const fetchOfferings = useCallback(async () => {
    if (!paymentsEnabled) {
      return {
        weekly: null,
        monthly: null,
        yearly: null,
        oneTime: null,
      };
    }
    try {
      const offerings = await Purchases.getOfferings();
      const next = { weekly: null, monthly: null, yearly: null, oneTime: null };
      const offeringsMap = offerings?.all || {};
      const defaultOffering =
        offeringsMap[OFFERING_IDS.default] ||
        offerings?.current ||
        Object.values(offeringsMap)[0] ||
        null;
      const oneTimeOffering = offeringsMap[OFFERING_IDS.oneTime];

      const mapPackages = (offering) => {
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

      setAvailablePackages((prev) => {
        const same =
          (!!prev.weekly?.identifier) === (!!next.weekly?.identifier) &&
          (!!prev.monthly?.identifier) === (!!next.monthly?.identifier) &&
          (!!prev.yearly?.identifier) === (!!next.yearly?.identifier) &&
          (!!prev.oneTime?.identifier) === (!!next.oneTime?.identifier) &&
          (prev.weekly?.identifier || null) === (next.weekly?.identifier || null) &&
          (prev.monthly?.identifier || null) === (next.monthly?.identifier || null) &&
          (prev.yearly?.identifier || null) === (next.yearly?.identifier || null) &&
          (prev.oneTime?.identifier || null) === (next.oneTime?.identifier || null);
        return same ? prev : next;
      });
      return next;
    } catch (e) {}
  }, [paymentsEnabled]);

  const value = {
    isPremium,
    customerInfo,
    availablePackages,
    restoring,
    subscriptionReady,
    paymentsEnabled,
    reviewerPremiumEnabled,
    purchasePackage,
    restorePurchases,
    refreshCustomerInfo,
    fetchOfferings,
    logOutRevenueCat,
    logInRevenueCat,
    activateReviewerPremium,
    deactivateReviewerPremium,
  };

  return (
    <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
  );
}

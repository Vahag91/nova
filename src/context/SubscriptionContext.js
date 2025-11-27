import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import {
  REVENUE_PUBLIC_ANDROID,
  REVENUE_PUBLIC_IOS,
  REVENUE_ENTITLEMENT_ID,
  OFFERING_IDS,
} from '../config/payments';

// ✅ NEW: bring your stable device id
import { ensureDeviceId } from '../lib/deviceId';
import { useSettingsStore } from '../state/useSettingsStore';

export const SubscriptionContext = createContext(null);

const STORAGE_KEY = '@isPremium';
const RC_GUARD_KEY = '__RC_CONFIGURED__';

export function SubscriptionProvider({ children }) {
  const [isPremium, setIsPremium] = useState(false);
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

  const apiKey = useMemo(
    () => (Platform.OS === 'ios' ? REVENUE_PUBLIC_IOS : REVENUE_PUBLIC_ANDROID),
    []
  );

  useEffect(() => {
    let removeListener;
    (async () => {
      try {
        if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        const os = Platform.OS;

        const cachedPremium = await AsyncStorage.getItem(STORAGE_KEY);
        if (cachedPremium !== null) setIsPremium(JSON.parse(cachedPremium));

        if (!apiKey) {
          return;
        }

        // Configure RevenueCat only once for the app lifetime.
        // Prefer React Native's global, then globalThis, then window
        const root = (typeof global !== 'undefined')
          ? global
          : (typeof window !== 'undefined')
            ? window
            : {};
        let alreadyConfigured = configuredRef.current || !!root[RC_GUARD_KEY];
        if (!alreadyConfigured) {
          // Preflight: if Purchases is already configured elsewhere, this will work.
          try {
            await Purchases.getCustomerInfo();
            alreadyConfigured = true;
          } catch {}
        }

        if (!alreadyConfigured) {
          await Purchases.configure({ apiKey });
          configuredRef.current = true;
          try { root[RC_GUARD_KEY] = true; } catch {}
        } else {
          configuredRef.current = true;
          try { root[RC_GUARD_KEY] = true; } catch {}
        }

        // ✅ NEW: ensure appUserID is your stable device id (required for coins)
        try {
          const deviceId = await ensureDeviceId();
          await Purchases.logIn(String(deviceId));
        } catch (e) {
          // RevenueCat logIn error handled silently
        }

        // keep info fresh when RevenueCat pushes updates
        removeListener = Purchases.addCustomerInfoUpdateListener(async (info) => {
          await handleCustomerInfo(info);
        });

        const info = await Purchases.getCustomerInfo();
        await handleCustomerInfo(info);
        await fetchOfferings();
      } catch (err) {
        // RevenueCat init error handled silently
      }
    })();

    return () => {
      try {
        if (typeof removeListener === 'function') removeListener();
        else if (removeListener && typeof removeListener.remove === 'function') removeListener.remove();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  const handleCustomerInfo = async (info) => {
    try {
      const active = info?.entitlements?.active || {};
      const entitlementId = (REVENUE_ENTITLEMENT_ID || '').trim();
      let hasPremium = entitlementId ? !!active[entitlementId] : false;
      // Fallback: if entitlement id is misconfigured but any entitlement is active, treat as premium
      let entitlementFallback = false;
      if (!hasPremium && Object.keys(active).length > 0) {
        hasPremium = true;
        entitlementFallback = true;
      }
      const activeEnts = Object.keys(active);
      const allEnts = Object.keys(info?.entitlements?.all || {});
      setIsPremium(hasPremium);
      setCustomerInfo(info);
      setSubscriptionReady(true);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(hasPremium));
      
      // Validate model when premium status changes
      const validateModel = useSettingsStore.getState().validateModelForPremium;
      if (validateModel) {
        validateModel(hasPremium);
      }
    } catch (e) {
      // Customer info processing error handled silently
    }
  };

  const purchasePackage = async (pkg) => {
    try {
      const result = await Purchases.purchasePackage(pkg);
      await handleCustomerInfo(result.customerInfo);
      return result;
    } catch (err) {
      throw err;
    }
  };

  const restorePurchases = async () => {
    setRestoring(true);
    try {
      const info = await Purchases.restorePurchases();
      await handleCustomerInfo(info);
      return info;
    } catch (err) {
      throw err;
    } finally {
      setRestoring(false);
    }
  };

  const refreshCustomerInfo = async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      await handleCustomerInfo(info);
    } catch (err) {
      // Refresh error handled silently
    }
  };

  const logOutRevenueCat = async () => {
    try {
      await Purchases.logOut();
      await AsyncStorage.removeItem(STORAGE_KEY);
      setIsPremium(false);
      setCustomerInfo(null);
    } catch (e) {
      // Logout error handled silently
    }
  };

  const logInRevenueCat = async (appUserId) => {
    try {
      const info = await Purchases.logIn(String(appUserId));
      await handleCustomerInfo(info?.customerInfo || info);
      return info;
    } catch (e) {
      throw e;
    }
  };

  const fetchOfferings = useCallback(async () => {
    try {
      const offerings = await Purchases.getOfferings();
      if (!offerings?.all) {
        return;
      }

      const allKeys = Object.keys(offerings.all || {});

      const next = { weekly: null, monthly: null, yearly: null, oneTime: null };

      // helper to map packages by identifier in an offering
      const mapFromOffering = (offering) => {
        const pkgs = offering?.availablePackages || [];
        for (const pkg of pkgs) {
          if (pkg.identifier === '$rc_weekly') next.weekly = pkg;
          if (pkg.identifier === '$rc_monthly') next.monthly = pkg;
          if (pkg.identifier === '$rc_annual') next.yearly = pkg;
          // some setups use lifetime package id for one-time purchase
          if (pkg.identifier === '$rc_lifetime') next.oneTime = pkg;
        }
      };

      // Primary paywall uses ONLY the default/current offering for subscriptions
      const def = offerings.all[OFFERING_IDS.default] || offerings.current;
      if (def) {
        mapFromOffering(def);
      }

      // One-time (lifetime) from dedicated offering (e.g., 'oto')
      const oto = offerings.all[OFFERING_IDS.oneTime];
      if (oto) {
        const pkgs = oto?.availablePackages || [];
        let chosen = pkgs.find((p) => p.identifier === '$rc_lifetime') || null;
        if (!chosen) chosen = pkgs.find((p) => !(p?.product?.subscriptionPeriod)) || null;
        if (!chosen && pkgs.length > 0) {
          chosen = pkgs[0];
        }
        if (chosen) next.oneTime = chosen;
      }

      // Fallback: scan all offerings for any unmapped package types
      if (!next.oneTime) {
        for (const key of allKeys) {
          const off = offerings.all[key];
          const pkgs = off?.availablePackages || [];
          for (const pkg of pkgs) {
            const p = pkg?.product || {};
            const hasSub = !!(p?.subscriptionPeriod || p?.subscriptionGroupIdentifier);
            if (!hasSub && !next.oneTime) {
              next.oneTime = pkg;
            }
          }
        }
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
    } catch (e) {
      // Failed to fetch offerings - error handled silently
    }
  }, []);

  const value = useMemo(
    () => ({
      isPremium,
      customerInfo,
      availablePackages,
      restoring,
      subscriptionReady,
      purchasePackage,
      restorePurchases,
      refreshCustomerInfo,
      fetchOfferings,
      logOutRevenueCat,
      logInRevenueCat,
    }),
    [isPremium, customerInfo, availablePackages, restoring, subscriptionReady]
  );

  return (
    <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>
  );
}

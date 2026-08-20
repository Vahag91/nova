import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { AppState, I18nManager } from 'react-native';
import * as RNLocalize from 'react-native-localize';

import {
  DEFAULT_LOCALE,
  LOCALE_BUNDLE_LOADERS,
  SUPPORTED_LOCALES,
  getBestSupportedLocale,
  getBundleCandidates,
  isRtlLocale,
} from './localeRegistry';

const bundleCache = new Map();
let activeLocale = DEFAULT_LOCALE;
let initializationPromise = null;
let localeObserverSubscription = null;
let languageSyncQueue = Promise.resolve(DEFAULT_LOCALE);

function unwrapTranslationModule(moduleValue) {
  const translation = moduleValue?.default || moduleValue;
  return translation && typeof translation === 'object' && !Array.isArray(translation)
    ? translation
    : null;
}

function tryLoadBundle(bundleId) {
  if (bundleCache.has(bundleId)) {
    return bundleCache.get(bundleId);
  }

  const loader = LOCALE_BUNDLE_LOADERS[bundleId];
  if (typeof loader !== 'function') {
    return null;
  }

  try {
    const translation = unwrapTranslationModule(loader());
    if (translation) {
      bundleCache.set(bundleId, translation);
      return translation;
    }
  } catch (error) {
    // A missing catalog must never prevent the application from launching.
    // Translation QA verifies that release builds contain every declared file.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(`[i18n] Could not load ${bundleId}; trying fallback.`, error);
    }
  }

  return null;
}

/**
 * Loads one requested catalog at a time. The candidate list may intentionally
 * reuse a reviewed same-language catalog, but English remains the final safe
 * fallback for a missing or malformed bundle.
 */
export function loadTranslationBundle(requestedLocale) {
  const locale = SUPPORTED_LOCALES.includes(requestedLocale)
    ? requestedLocale
    : DEFAULT_LOCALE;

  for (const sourceLocale of getBundleCandidates(locale)) {
    const translation = tryLoadBundle(sourceLocale);
    if (translation) {
      return {
        requestedLocale: locale,
        sourceLocale,
        // Do not claim a non-English locale if its only usable catalog is
        // English. Same-language regional fallbacks retain the requested tag.
        effectiveLocale:
          sourceLocale === DEFAULT_LOCALE ? DEFAULT_LOCALE : locale,
        translation,
      };
    }
  }

  // `en.json` is a required application asset. This defensive empty catalog
  // keeps initialization deterministic even in a damaged development bundle.
  return {
    requestedLocale: DEFAULT_LOCALE,
    sourceLocale: DEFAULT_LOCALE,
    effectiveLocale: DEFAULT_LOCALE,
    translation: {},
  };
}

export function getDeviceLocales() {
  try {
    return typeof RNLocalize.getLocales === 'function'
      ? RNLocalize.getLocales()
      : [];
  } catch (error) {
    return [];
  }
}

export function detectDeviceLocale() {
  return getBestSupportedLocale(getDeviceLocales());
}

/**
 * Aligns the native layout direction with the active locale (ar/fa/he/ur).
 * React Native applies a direction change on the next activity/app restart;
 * Android already recreates the activity after a per-app language change, so
 * the flipped layout is visible as soon as the new language is.
 */
export function syncLayoutDirection(locale) {
  const shouldUseRtl = isRtlLocale(locale);
  try {
    I18nManager?.allowRTL?.(true);
    if (I18nManager && I18nManager.isRTL !== shouldUseRtl) {
      I18nManager.forceRTL?.(shouldUseRtl);
    }
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[i18n] Could not update the layout direction.', error);
    }
  }
  return shouldUseRtl;
}

function addLoadedResource(locale, translation) {
  if (!i18n.hasResourceBundle(locale, 'translation')) {
    i18n.addResourceBundle(locale, 'translation', translation, true, true);
  }
}

function createInitialResources() {
  const english = loadTranslationBundle(DEFAULT_LOCALE);
  const desiredLocale = detectDeviceLocale();
  const selected = loadTranslationBundle(desiredLocale);
  const resources = {
    [DEFAULT_LOCALE]: { translation: english.translation },
  };

  if (selected.effectiveLocale !== DEFAULT_LOCALE) {
    resources[selected.effectiveLocale] = {
      translation: selected.translation,
    };
  }

  activeLocale = selected.effectiveLocale;
  syncLayoutDirection(activeLocale);
  return resources;
}

/**
 * Idempotent initialization contract. Existing application code can continue
 * importing this module for its side effect; callers that need a readiness
 * boundary (tests or future native splash coordination) can await the promise.
 */
export function initializeI18n() {
  if (initializationPromise) {
    return initializationPromise;
  }

  const resources = createInitialResources();

  const result = i18n.use(initReactI18next).init({
    resources,
    lng: activeLocale,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    nonExplicitSupportedLngs: false,
    lowerCaseLng: false,
    load: 'currentOnly',
    ns: ['translation'],
    defaultNS: 'translation',
    initImmediate: false,
    interpolation: {
      // React Native Text escapes content itself. This also restores the
      // catalog's existing i18next `{{variable}}` interpolation semantics.
      escapeValue: false,
    },
    react: { useSuspense: false },
    returnNull: false,
  });

  initializationPromise = Promise.resolve(result).then(() => i18n);
  return initializationPromise;
}

export const i18nReady = initializeI18n();

async function performDeviceLanguageSync() {
  await i18nReady;

  const desiredLocale = detectDeviceLocale();
  const selected = loadTranslationBundle(desiredLocale);
  const nextLocale = selected.effectiveLocale;

  addLoadedResource(DEFAULT_LOCALE, loadTranslationBundle(DEFAULT_LOCALE).translation);
  if (nextLocale !== DEFAULT_LOCALE) {
    addLoadedResource(nextLocale, selected.translation);
  }

  if (activeLocale !== nextLocale || i18n.resolvedLanguage !== nextLocale) {
    await i18n.changeLanguage(nextLocale);
    activeLocale = nextLocale;
  }
  syncLayoutDirection(nextLocale);

  return nextLocale;
}

/** Re-reads current native locales; calls are serialized to avoid race wins. */
export function syncLanguageFromDevice() {
  languageSyncQueue = languageSyncQueue.then(
    performDeviceLanguageSync,
    performDeviceLanguageSync,
  );
  return languageSyncQueue;
}

export function getActiveLocale() {
  return activeLocale;
}

/**
 * react-native-localize 3.x no longer exports its old change-listener API.
 * Returning to the foreground is the reliable cross-platform point at which
 * to re-read native locales. Android also recreates the activity after a
 * per-app language change because locale configChanges are not intercepted.
 */
export function startDeviceLocaleObserver() {
  if (
    localeObserverSubscription ||
    !AppState ||
    typeof AppState.addEventListener !== 'function'
  ) {
    return localeObserverSubscription;
  }

  localeObserverSubscription = AppState.addEventListener('change', state => {
    if (state === 'active') {
      syncLanguageFromDevice().catch(error => {
        console.warn('[i18n] Failed to synchronize the device language.', error);
      });
    }
  });

  return localeObserverSubscription;
}

export function stopDeviceLocaleObserver() {
  localeObserverSubscription?.remove?.();
  localeObserverSubscription = null;
}

startDeviceLocaleObserver();

export default i18n;

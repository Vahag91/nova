/**
 * Canonical locale catalog and bundle routing.
 *
 * Keep this module free of React Native APIs so locale matching can be tested
 * independently. Bundle loaders are functions on purpose: Metro includes the
 * files in the app bundle, but only the active catalog (and English fallback)
 * is evaluated during startup.
 */

export const DEFAULT_LOCALE = 'en';

// Google Play's complete custom store-listing locale catalog (86 variants).
// `iw-IL` is retained here because that is the legacy code Play publishes;
// Android and the app runtime canonicalize it to `he-IL` / `he`.
export const PLAY_STORE_LOCALE_TAGS = Object.freeze([
  'af',
  'sq',
  'am',
  'ar',
  'hy-AM',
  'az-AZ',
  'bn-BD',
  'eu-ES',
  'be',
  'bg',
  'my-MM',
  'ca',
  'zh-HK',
  'zh-CN',
  'zh-TW',
  'hr',
  'cs-CZ',
  'da-DK',
  'nl-NL',
  'en-AU',
  'en-CA',
  'en-US',
  'en-GB',
  'en-IN',
  'en-SG',
  'en-ZA',
  'et',
  'fil',
  'fi-FI',
  'fr-CA',
  'fr-FR',
  'gl-ES',
  'ka-GE',
  'de-DE',
  'el-GR',
  'gu',
  'iw-IL',
  'hi-IN',
  'hu-HU',
  'is-IS',
  'id',
  'it-IT',
  'ja-JP',
  'kn-IN',
  'kk',
  'km-KH',
  'ko-KR',
  'ky-KG',
  'lo-LA',
  'lv',
  'lt',
  'mk-MK',
  'ms-MY',
  'ms',
  'ml-IN',
  'mr-IN',
  'mn-MN',
  'ne-NP',
  'no-NO',
  'fa',
  'fa-AE',
  'fa-AF',
  'fa-IR',
  'pl-PL',
  'pt-BR',
  'pt-PT',
  'pa',
  'ro',
  'rm',
  'ru-RU',
  'sr',
  'si-LK',
  'sk',
  'sl',
  'es-419',
  'es-ES',
  'es-US',
  'sw',
  'sv-SE',
  'ta-IN',
  'te-IN',
  'th',
  'tr-TR',
  'uk',
  'ur',
  'vi',
]);

export const ADDITIONAL_LOCALE_TAGS = Object.freeze([
  'as',
  'bs',
  'or',
  'uz',
  'zu',
  'sr-Latn',
  'ha',
  'yo',
  'ig',
]);

const ANDROID_TAG_OVERRIDES = Object.freeze({
  'iw-IL': 'he-IL',
  'no-NO': 'nb-NO',
});

// Tags shown in Android 13+'s per-app language settings. These are modern
// BCP-47 tags even where Play Console still publishes a legacy identifier.
export const ANDROID_LOCALE_TAGS = Object.freeze(
  [...PLAY_STORE_LOCALE_TAGS, ...ADDITIONAL_LOCALE_TAGS].map(
    tag => ANDROID_TAG_OVERRIDES[tag] || tag,
  ),
);

export const RTL_LANGUAGES = Object.freeze(['ar', 'fa', 'he', 'ur']);

export const LANGUAGE_ALIASES = Object.freeze({
  // Legacy Java/Android language identifiers.
  iw: 'he',
  in: 'id',
  // Older Android releases and some OEM builds still report Tagalog (`tl`)
  // for the modern Filipino (`fil`) locale.
  tl: 'fil',
  // The app's Norwegian translation is Bokmal (`nb`). Android/Play can
  // report the macrolanguage identifier (`no`).
  no: 'nb',
});

/** Actual JSON catalogs packaged with the app. */
export const TRANSLATION_BUNDLE_IDS = Object.freeze([
  'en',
  'de',
  'fr',
  'fr-CA',
  'es',
  'es-MX',
  'es-419',
  'pt',
  'pt-BR',
  'pt-PT',
  'it',
  'ja',
  'nl',
  'ar',
  'ca',
  'cs',
  'da',
  'el',
  'fi',
  'he',
  'hi',
  'hr',
  'hu',
  'id',
  'ko',
  'ms',
  'nb',
  'pl',
  'ro',
  'ru',
  'sk',
  'sv',
  'th',
  'tr',
  'uk',
  'vi',
  'zh-Hans',
  'zh-Hant',
  'af',
  'sq',
  'am',
  'hy',
  'az',
  'bn',
  'eu',
  'be',
  'bg',
  'my',
  'et',
  'fil',
  'gl',
  'ka',
  'gu',
  'is',
  'kn',
  'kk',
  'km',
  'ky',
  'lo',
  'lv',
  'lt',
  'mk',
  'ml',
  'mr',
  'mn',
  'ne',
  'fa',
  'fa-AF',
  'pa',
  'rm',
  'sr',
  'sr-Latn',
  'si',
  'sl',
  'sw',
  'ta',
  'te',
  'ur',
  'as',
  'bs',
  'or',
  'uz',
  'zu',
  'ha',
  'yo',
  'ig',
]);

export const SUPPORTED_LOCALES = TRANSLATION_BUNDLE_IDS;

const TRANSLATION_BUNDLE_SET = new Set(TRANSLATION_BUNDLE_IDS);

// Static paths are required by Metro. Keeping the require calls inside loader
// functions prevents all catalogs from being evaluated during cold start.
export const LOCALE_BUNDLE_LOADERS = Object.freeze({
  en: () => require('./locales/en.json'),
  de: () => require('./locales/de.json'),
  fr: () => require('./locales/fr.json'),
  'fr-CA': () => require('./locales/fr-CA.json'),
  es: () => require('./locales/es.json'),
  'es-MX': () => require('./locales/es-MX.json'),
  'es-419': () => require('./locales/es-419.json'),
  pt: () => require('./locales/pt.json'),
  'pt-BR': () => require('./locales/pt-BR.json'),
  'pt-PT': () => require('./locales/pt-PT.json'),
  it: () => require('./locales/it.json'),
  ja: () => require('./locales/ja.json'),
  nl: () => require('./locales/nl.json'),
  ar: () => require('./locales/ar.json'),
  ca: () => require('./locales/ca.json'),
  cs: () => require('./locales/cs.json'),
  da: () => require('./locales/da.json'),
  el: () => require('./locales/el.json'),
  fi: () => require('./locales/fi.json'),
  he: () => require('./locales/he.json'),
  hi: () => require('./locales/hi.json'),
  hr: () => require('./locales/hr.json'),
  hu: () => require('./locales/hu.json'),
  id: () => require('./locales/id.json'),
  ko: () => require('./locales/ko.json'),
  ms: () => require('./locales/ms.json'),
  nb: () => require('./locales/nb.json'),
  pl: () => require('./locales/pl.json'),
  ro: () => require('./locales/ro.json'),
  ru: () => require('./locales/ru.json'),
  sk: () => require('./locales/sk.json'),
  sv: () => require('./locales/sv.json'),
  th: () => require('./locales/th.json'),
  tr: () => require('./locales/tr.json'),
  uk: () => require('./locales/uk.json'),
  vi: () => require('./locales/vi.json'),
  'zh-Hans': () => require('./locales/zh-Hans.json'),
  'zh-Hant': () => require('./locales/zh-Hant.json'),
  af: () => require('./locales/af.json'),
  sq: () => require('./locales/sq.json'),
  am: () => require('./locales/am.json'),
  hy: () => require('./locales/hy.json'),
  az: () => require('./locales/az.json'),
  bn: () => require('./locales/bn.json'),
  eu: () => require('./locales/eu.json'),
  be: () => require('./locales/be.json'),
  bg: () => require('./locales/bg.json'),
  my: () => require('./locales/my.json'),
  et: () => require('./locales/et.json'),
  fil: () => require('./locales/fil.json'),
  gl: () => require('./locales/gl.json'),
  ka: () => require('./locales/ka.json'),
  gu: () => require('./locales/gu.json'),
  is: () => require('./locales/is.json'),
  kn: () => require('./locales/kn.json'),
  kk: () => require('./locales/kk.json'),
  km: () => require('./locales/km.json'),
  ky: () => require('./locales/ky.json'),
  lo: () => require('./locales/lo.json'),
  lv: () => require('./locales/lv.json'),
  lt: () => require('./locales/lt.json'),
  mk: () => require('./locales/mk.json'),
  ml: () => require('./locales/ml.json'),
  mr: () => require('./locales/mr.json'),
  mn: () => require('./locales/mn.json'),
  ne: () => require('./locales/ne.json'),
  fa: () => require('./locales/fa.json'),
  'fa-AF': () => require('./locales/fa-AF.json'),
  pa: () => require('./locales/pa.json'),
  rm: () => require('./locales/rm.json'),
  sr: () => require('./locales/sr.json'),
  'sr-Latn': () => require('./locales/sr-Latn.json'),
  si: () => require('./locales/si.json'),
  sl: () => require('./locales/sl.json'),
  sw: () => require('./locales/sw.json'),
  ta: () => require('./locales/ta.json'),
  te: () => require('./locales/te.json'),
  ur: () => require('./locales/ur.json'),
  as: () => require('./locales/as.json'),
  bs: () => require('./locales/bs.json'),
  or: () => require('./locales/or.json'),
  uz: () => require('./locales/uz.json'),
  zu: () => require('./locales/zu.json'),
  ha: () => require('./locales/ha.json'),
  yo: () => require('./locales/yo.json'),
  ig: () => require('./locales/ig.json'),
});

const LATIN_AMERICAN_SPANISH_REGIONS = new Set([
  '419',
  'AR',
  'BO',
  'BZ',
  'CL',
  'CO',
  'CR',
  'CU',
  'DO',
  'EC',
  'GT',
  'HN',
  'MX',
  'NI',
  'PA',
  'PE',
  'PR',
  'PY',
  'SV',
  'UY',
  'VE',
]);

const SIMPLIFIED_CHINESE_REGIONS = new Set(['CN', 'MY', 'SG']);
const TRADITIONAL_CHINESE_REGIONS = new Set(['HK', 'MO', 'TW']);

function localeLikeToTag(localeLike) {
  if (typeof localeLike === 'string') {
    return localeLike;
  }

  if (!localeLike || typeof localeLike !== 'object') {
    return '';
  }

  if (localeLike.languageTag) {
    return String(localeLike.languageTag);
  }

  const language = String(localeLike.languageCode || '');
  const script = String(localeLike.scriptCode || '');
  const region = String(localeLike.countryCode || '');
  return [language, script, region].filter(Boolean).join('-');
}

/**
 * Normalizes casing, separators, and the legacy aliases returned by older
 * Android/Java versions. It intentionally accepts partial tags such as `ur`.
 */
export function normalizeLocaleTag(localeLike) {
  const rawTag = localeLikeToTag(localeLike).trim().replace(/_/g, '-');
  const rawParts = rawTag.split('-').filter(Boolean);
  if (rawParts.length === 0 || !/^[A-Za-z]{2,3}$/.test(rawParts[0])) {
    return '';
  }

  const rawLanguage = rawParts[0].toLowerCase();
  const language = LANGUAGE_ALIASES[rawLanguage] || rawLanguage;
  const normalized = [language];

  for (const rawPart of rawParts.slice(1)) {
    if (/^[A-Za-z]{4}$/.test(rawPart)) {
      normalized.push(
        rawPart.charAt(0).toUpperCase() + rawPart.slice(1).toLowerCase(),
      );
    } else if (/^[A-Za-z]{2}$/.test(rawPart)) {
      normalized.push(rawPart.toUpperCase());
    } else if (/^\d{3}$/.test(rawPart)) {
      normalized.push(rawPart);
    } else {
      normalized.push(rawPart.toLowerCase());
    }
  }

  return normalized.join('-');
}

function parseNormalizedLocale(normalizedTag) {
  const parts = normalizedTag.split('-');
  const language = parts[0] || '';
  let script = '';
  let region = '';

  for (const part of parts.slice(1)) {
    if (!script && /^[A-Z][a-z]{3}$/.test(part)) {
      script = part;
    } else if (!region && (/^[A-Z]{2}$/.test(part) || /^\d{3}$/.test(part))) {
      region = part;
    }
  }

  return { language, script, region };
}

/** Returns the app catalog that should serve a device locale, or null. */
export function resolveSupportedLocale(localeLike) {
  const normalized = normalizeLocaleTag(localeLike);
  if (!normalized) {
    return null;
  }

  const { language, script, region } = parseNormalizedLocale(normalized);

  if (language === 'zh') {
    if (script === 'Hant' || TRADITIONAL_CHINESE_REGIONS.has(region)) {
      return 'zh-Hant';
    }
    if (script === 'Hans' || SIMPLIFIED_CHINESE_REGIONS.has(region)) {
      return 'zh-Hans';
    }
    return 'zh-Hans';
  }

  if (language === 'es') {
    return LATIN_AMERICAN_SPANISH_REGIONS.has(region) ? 'es-419' : 'es';
  }

  if (language === 'pt') {
    return region === 'BR' ? 'pt-BR' : 'pt-PT';
  }

  if (language === 'fa' && region === 'AF') {
    return 'fa-AF';
  }

  if (language === 'fr' && region === 'CA') {
    return 'fr-CA';
  }

  if (language === 'sr' && script === 'Latn') {
    return 'sr-Latn';
  }

  return TRANSLATION_BUNDLE_SET.has(language) ? language : null;
}

/** Honors the user's preferred-locale order and falls back to English. */
export function getBestSupportedLocale(locales) {
  if (Array.isArray(locales)) {
    for (const locale of locales) {
      const supported = resolveSupportedLocale(locale);
      if (supported) {
        return supported;
      }
    }
  }

  return DEFAULT_LOCALE;
}

export function isRtlLocale(localeLike) {
  const normalized = normalizeLocaleTag(localeLike);
  const language = normalized.split('-')[0];
  return RTL_LANGUAGES.includes(language);
}

/**
 * Bundle candidates ordered from the requested catalog through safe same-
 * language compatibility sources, ending with the English ultimate fallback.
 */
export function getBundleCandidates(locale) {
  switch (locale) {
    case 'es-419':
      return ['es-419', 'es-MX', 'es', DEFAULT_LOCALE];
    case 'fa-AF':
      return ['fa-AF', 'fa', DEFAULT_LOCALE];
    case 'fr-CA':
      return ['fr-CA', 'fr', DEFAULT_LOCALE];
    case 'pt-BR':
      return ['pt-BR', 'pt', DEFAULT_LOCALE];
    case 'pt-PT':
      return ['pt-PT', 'pt', DEFAULT_LOCALE];
    case 'sr-Latn':
      return ['sr-Latn', 'sr', DEFAULT_LOCALE];
    default:
      return locale === DEFAULT_LOCALE
        ? [DEFAULT_LOCALE]
        : [locale, DEFAULT_LOCALE];
  }
}

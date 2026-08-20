import {
  ADDITIONAL_LOCALE_TAGS,
  ANDROID_LOCALE_TAGS,
  LOCALE_BUNDLE_LOADERS,
  PLAY_STORE_LOCALE_TAGS,
  SUPPORTED_LOCALES,
  TRANSLATION_BUNDLE_IDS,
  getBestSupportedLocale,
  isRtlLocale,
  normalizeLocaleTag,
  resolveSupportedLocale,
} from '../src/i18n/localeRegistry';

describe('locale registry', () => {
  test('covers every declared Play and additional locale without duplicates', () => {
    expect(PLAY_STORE_LOCALE_TAGS).toHaveLength(86);
    expect(new Set(PLAY_STORE_LOCALE_TAGS).size).toBe(86);
    expect(ADDITIONAL_LOCALE_TAGS).toEqual([
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
    expect(ANDROID_LOCALE_TAGS).toHaveLength(95);
    expect(new Set(ANDROID_LOCALE_TAGS).size).toBe(95);
    expect(ANDROID_LOCALE_TAGS).toContain('he-IL');
    expect(ANDROID_LOCALE_TAGS).toContain('nb-NO');
    expect(ANDROID_LOCALE_TAGS).not.toContain('iw-IL');
  });

  test('has one lazy loader for every translation bundle', () => {
    expect(TRANSLATION_BUNDLE_IDS).toHaveLength(86);
    expect(SUPPORTED_LOCALES).toBe(TRANSLATION_BUNDLE_IDS);
    expect(Object.keys(LOCALE_BUNDLE_LOADERS).sort()).toEqual(
      [...TRANSLATION_BUNDLE_IDS].sort(),
    );
    expect(typeof LOCALE_BUNDLE_LOADERS.en).toBe('function');
  });

  test.each([
    ['iw-IL', 'he-IL'],
    ['he_IL', 'he-IL'],
    ['in-ID', 'id-ID'],
    ['tl-PH', 'fil-PH'],
    ['no-NO', 'nb-NO'],
    ['SR_latn_rs', 'sr-Latn-RS'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeLocaleTag(input)).toBe(expected);
  });

  test.each([
    ['zh-CN', 'zh-Hans'],
    ['zh-Hans-SG', 'zh-Hans'],
    ['zh-TW', 'zh-Hant'],
    ['zh-HK', 'zh-Hant'],
    ['zh-Hant-MO', 'zh-Hant'],
    ['es-MX', 'es-419'],
    ['es-AR', 'es-419'],
    ['es-ES', 'es'],
    ['es-US', 'es'],
    ['pt-BR', 'pt-BR'],
    ['pt-AO', 'pt-PT'],
    ['fa-AF', 'fa-AF'],
    ['fa-IR', 'fa'],
    ['sr-Latn-RS', 'sr-Latn'],
    ['sr-Cyrl-RS', 'sr'],
    ['ur-PK', 'ur'],
    ['ha-NG', 'ha'],
  ])('routes %s to %s', (input, expected) => {
    expect(resolveSupportedLocale(input)).toBe(expected);
  });

  test('honors the phone preferred-language order and safely falls back', () => {
    expect(
      getBestSupportedLocale([
        { languageTag: 'cy-GB', languageCode: 'cy' },
        { languageTag: 'bn-BD', languageCode: 'bn' },
        { languageTag: 'fr-FR', languageCode: 'fr' },
      ]),
    ).toBe('bn');
    expect(getBestSupportedLocale([{ languageTag: 'cy-GB' }])).toBe('en');
    expect(getBestSupportedLocale([])).toBe('en');
  });

  test('identifies every supported RTL language after alias normalization', () => {
    expect(isRtlLocale('ar-EG')).toBe(true);
    expect(isRtlLocale('fa-AF')).toBe(true);
    expect(isRtlLocale('iw-IL')).toBe(true);
    expect(isRtlLocale('ur-PK')).toBe(true);
    expect(isRtlLocale('en-US')).toBe(false);
  });
});

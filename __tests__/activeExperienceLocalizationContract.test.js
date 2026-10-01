const fs = require('fs');
const path = require('path');

const localesDirectory = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const localeFiles = fs
  .readdirSync(localesDirectory)
  .filter(file => file.endsWith('.json'))
  .sort();

const readLocale = file =>
  JSON.parse(fs.readFileSync(path.join(localesDirectory, file), 'utf8'));

const flatten = (object, prefix = '', result = {}) => {
  Object.entries(object || {}).forEach(([key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') flatten(value, nextKey, result);
    else result[nextKey] = value;
  });
  return result;
};

const placeholders = value =>
  [...String(value).matchAll(/\{\{(.*?)\}\}/g)]
    .map(match => match[1])
    .sort();

const paywallSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'PremiumPaywallScreen.jsx'),
  'utf8',
);
const sharedPaywallKeys = [
  ...new Set([...paywallSource.matchAll(/\btr\('([^']+)'/g)].map(match => match[1])),
];
const getAtPath = (object, dottedPath) =>
  dottedPath.split('.').reduce((value, key) => value?.[key], object);

describe('active onboarding and paywall localization contract', () => {
  const english = readLocale('en.json');
  const englishOnboarding = flatten(english.onboarding.v4);
  const englishPaywall = flatten(english.paywall.v3);

  test('ships the active namespaces in every supported locale', () => {
    expect(localeFiles).toHaveLength(86);
    expect(Object.keys(englishOnboarding)).toHaveLength(45);
    expect(Object.keys(englishPaywall)).toHaveLength(24);

    localeFiles.forEach(file => {
      const locale = readLocale(file);
      expect(Object.keys(flatten(locale.onboarding?.v4)).sort()).toEqual(
        Object.keys(englishOnboarding).sort(),
      );
      expect(Object.keys(flatten(locale.paywall?.v3)).sort()).toEqual(
        Object.keys(englishPaywall).sort(),
      );
    });
  });

  test('contains no empty, joined, or untranslated onboarding copy', () => {
    localeFiles.forEach(file => {
      const localized = flatten(readLocale(file).onboarding.v4);
      Object.entries(localized).forEach(([key, value]) => {
        expect(`${file}:${key}:${value}`.includes('[ZX')).toBe(false);
        expect(String(value)).not.toContain('\n');
        expect(String(value).trim()).not.toBe('');
        if (file !== 'en.json') {
          expect(value).not.toBe(englishOnboarding[key]);
        }
      });
      expect(readLocale(file).onboarding.v4.valueDemo.title).toContain('Cloud AI');
    });
  });

  test('preserves paywall placeholders and the current purchase copy', () => {
    localeFiles.forEach(file => {
      const locale = readLocale(file);
      const localizedPaywall = flatten(locale.paywall.v3);

      Object.entries(englishPaywall).forEach(([key, value]) => {
        expect(placeholders(localizedPaywall[key])).toEqual(placeholders(value));
        expect(String(localizedPaywall[key])).not.toContain('\n');
        expect(String(localizedPaywall[key])).not.toContain('[ZX');
      });
      sharedPaywallKeys.forEach(key => {
        const value = getAtPath(locale, key);
        expect(typeof value).toBe('string');
        expect(value.trim()).not.toBe('');
        expect(value).not.toContain('\n');
        expect(value).not.toContain('[ZX');
      });
      expect(locale.paywall.v3.annual.cta).toBe(locale.paywall.cta);
      if (file !== 'en.json') {
        expect(locale.paywall.v3.trial.headline).not.toBe(
          english.paywall.v3.trial.headline,
        );
      }
      expect(locale.paywall.v3.trial.billingBody).not.toContain('{{price}}');
      expect(locale.paywall.v3.trial.billingBody).not.toContain('{{period}}');
    });
  });
});

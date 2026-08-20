const mockGetLocales = jest.fn(() => [
  {
    languageTag: 'fr-CA',
    languageCode: 'fr',
    countryCode: 'CA',
    isRTL: false,
  },
]);
const mockRemoveLocaleObserver = jest.fn();
const mockAddLocaleObserver = jest.fn(() => ({
  remove: mockRemoveLocaleObserver,
}));

jest.mock('react-native-localize', () => ({
  getLocales: mockGetLocales,
}));

const mockAllowRTL = jest.fn();
const mockForceRTL = jest.fn();
const mockI18nManager = {
  isRTL: false,
  allowRTL: mockAllowRTL,
  forceRTL: mockForceRTL,
};

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: mockAddLocaleObserver,
  },
  I18nManager: mockI18nManager,
}));

describe('i18n runtime', () => {
  afterAll(() => {
    const runtime = require('../src/i18n');
    runtime.stopDeviceLocaleObserver();
  });

  test('loads only English and the selected phone catalog at startup', async () => {
    const runtime = require('../src/i18n');
    const instance = await runtime.i18nReady;

    expect(runtime.getActiveLocale()).toBe('fr-CA');
    expect(instance.hasResourceBundle('en', 'translation')).toBe(true);
    expect(instance.hasResourceBundle('fr-CA', 'translation')).toBe(true);
    expect(instance.hasResourceBundle('de', 'translation')).toBe(false);
    expect(mockAddLocaleObserver).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
  });

  test('re-reads current device locales and lazily switches catalogs', async () => {
    const runtime = require('../src/i18n');
    const instance = await runtime.i18nReady;

    mockGetLocales.mockReturnValue([
      {
        languageTag: 'iw-IL',
        languageCode: 'iw',
        countryCode: 'IL',
        isRTL: true,
      },
    ]);

    await expect(runtime.syncLanguageFromDevice()).resolves.toBe('he');
    expect(runtime.getActiveLocale()).toBe('he');
    expect(instance.resolvedLanguage).toBe('he');
    expect(instance.hasResourceBundle('he', 'translation')).toBe(true);
    expect(instance.hasResourceBundle('de', 'translation')).toBe(false);
  });

  test('aligns the native layout direction with the active locale', async () => {
    const runtime = require('../src/i18n');
    await runtime.i18nReady;

    // Startup ran with LTR French Canadian; switching to Hebrew must request
    // an RTL layout, and switching back must request LTR again.
    expect(mockAllowRTL).toHaveBeenCalledWith(true);
    expect(mockForceRTL).toHaveBeenLastCalledWith(true);

    mockI18nManager.isRTL = true;
    mockGetLocales.mockReturnValue([
      { languageTag: 'fr-CA', languageCode: 'fr', countryCode: 'CA', isRTL: false },
    ]);
    await expect(runtime.syncLanguageFromDevice()).resolves.toBe('fr-CA');
    expect(mockForceRTL).toHaveBeenLastCalledWith(false);
    mockI18nManager.isRTL = false;
  });

  test('observer cleanup is safe and idempotent', () => {
    const runtime = require('../src/i18n');
    runtime.stopDeviceLocaleObserver();
    runtime.stopDeviceLocaleObserver();
    expect(mockRemoveLocaleObserver).toHaveBeenCalledTimes(1);
  });
});


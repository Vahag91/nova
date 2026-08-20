jest.mock('react-native-localize', () => ({
  getLocales: jest.fn(() => [
    {
      languageTag: 'en-US',
      languageCode: 'en',
      countryCode: 'US',
      isRTL: false,
    },
  ]),
}));

test('the real i18n runtime renders the catalogs standard {{variable}} placeholders', async () => {
  const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  const runtime = require('../src/i18n');
  await runtime.i18nReady;
  infoSpy.mockRestore();

  expect(
    runtime.default.t('modelSelector.currentModel', { name: 'Aurora' }),
  ).toBe('Current model: Aurora. Tap to change model.');
  expect(
    runtime.default.t('settings.version', { version: '2.4', status: ' · PRO' }),
  ).toBe('Version 2.4 · PRO');
  expect(runtime.default.t('coinStore.balanceValue', { amount: 120 })).toBe(
    '120 Credits',
  );
});

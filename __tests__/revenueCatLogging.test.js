import { shouldSuppressRevenueCatLog } from '../src/lib/revenueCatLogging';

describe('shouldSuppressRevenueCatLog', () => {
  test('suppresses expected emulator billing unavailable logs', () => {
    expect(
      shouldSuppressRevenueCatLog(
        'ERROR',
        'Error fetching offerings - PurchasesError(code=PurchaseNotAllowedError, underlyingErrorMessage=Billing is not available in this device. ErrorCode: BILLING_UNAVAILABLE.)',
      ),
    ).toBe(true);
  });

  test('keeps unrelated RevenueCat errors visible', () => {
    expect(
      shouldSuppressRevenueCatLog(
        'ERROR',
        'CustomerInfo request failed with an unexpected backend response',
      ),
    ).toBe(false);
  });

  test('does not throw when the native log handler cannot be installed', () => {
    const { installRevenueCatLogHandler } = require('../src/lib/revenueCatLogging');

    expect(() =>
      installRevenueCatLogHandler({
        setLogHandler: () => {
          throw new Error('native unavailable');
        },
      }),
    ).not.toThrow();
  });
});

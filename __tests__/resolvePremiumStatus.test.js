const {
  resolvePremiumStatus,
} = require('../src/lib/resolvePremiumStatus');

describe('resolvePremiumStatus', () => {
  test('waits for the first verified entitlement before treating a fresh subscriber as free', async () => {
    const refreshCustomerInfo = jest.fn();
    const waitForSubscriptionReady = jest.fn().mockResolvedValue(true);

    await expect(
      resolvePremiumStatus({
        isPremium: false,
        paymentsEnabled: true,
        refreshCustomerInfo,
        waitForSubscriptionReady,
      }),
    ).resolves.toBe(true);

    expect(waitForSubscriptionReady).toHaveBeenCalledTimes(1);
    expect(refreshCustomerInfo).not.toHaveBeenCalled();
  });

  test('refreshes RevenueCat after a verified non-premium result', async () => {
    const refreshCustomerInfo = jest.fn().mockResolvedValue(true);

    await expect(
      resolvePremiumStatus({
        isPremium: false,
        paymentsEnabled: true,
        refreshCustomerInfo,
        waitForSubscriptionReady: jest.fn().mockResolvedValue(false),
      }),
    ).resolves.toBe(true);

    expect(refreshCustomerInfo).toHaveBeenCalledTimes(1);
  });
});

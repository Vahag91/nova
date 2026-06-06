export async function resolvePremiumStatus(subscription) {
  if (subscription?.isPremium) {
    return true;
  }

  if (
    !subscription?.paymentsEnabled ||
    typeof subscription?.refreshCustomerInfo !== 'function'
  ) {
    return !!subscription?.isPremium;
  }

  try {
    return !!(await subscription.refreshCustomerInfo());
  } catch {
    return !!subscription?.isPremium;
  }
}

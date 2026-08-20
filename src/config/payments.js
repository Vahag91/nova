// RevenueCat public SDK keys (safe to ship in client)
const REVENUE_GOOGLE_PLAY_ANDROID = 'goog_fIcqplASRkoTuPhdAorZJgGnuAu';

export const REVENUE_PUBLIC_ANDROID = REVENUE_GOOGLE_PLAY_ANDROID;
export const REVENUE_ENTITLEMENT_ID = 'Create a project called Cloud Ai Pro';

// RevenueCat's public offerings endpoint returns package/product/base-plan
// identifiers even when Google Play Billing is temporarily unavailable. These
// verified Play Console prices keep the paywall stable until the native SDK
// supplies a localized StoreProduct for checkout.
export const REVENUE_OFFERINGS_BASE_URL =
  'https://api.revenuecat.com/v1/subscribers';
export const GOOGLE_PLAY_DISPLAY_PRODUCTS = Object.freeze({
  weekly: Object.freeze({
    identifier: 'cloud_ai_weekly',
    basePlanIdentifier: 'weekly',
    price: 3.99,
    priceString: 'USD 3.99',
    currencyCode: 'USD',
    subscriptionPeriod: 'P1W',
    hasFreeTrial: true,
  }),
  yearly: Object.freeze({
    identifier: 'cloud_ai_yearly',
    basePlanIdentifier: 'yearly',
    price: 44.99,
    priceString: 'USD 44.99',
    currencyCode: 'USD',
    subscriptionPeriod: 'P1Y',
    hasFreeTrial: false,
  }),
});

// Optional: offering identifiers you use in RevenueCat dashboard
export const OFFERING_IDS = {
  default: 'default',
  lifetime: 'lifetime', // if you use a separate lifetime offering (unused if you don't have)
  oneTime: 'oto', // if you use a dedicated one-time offering id
};

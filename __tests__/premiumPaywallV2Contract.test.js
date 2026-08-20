import fs from 'fs';
import path from 'path';
import vm from 'vm';

const readSource = relativePath =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

const legacySource = readSource('src/components/PaywallScreen.jsx');
const premiumSource = readSource('src/components/PremiumPaywallScreen.jsx');
const navigatorSource = readSource('src/navigation/DrawerNavigator.js');
const appSource = readSource('App.js');
const subscriptionSource = readSource('src/context/SubscriptionContext.js');
const paymentsSource = readSource('src/config/payments.js');
const flagsSource = readSource('src/constants/featureFlags.js');
const englishCatalog = JSON.parse(readSource('src/i18n/locales/en.json'));

function readEntranceGuard() {
  const start = premiumSource.indexOf(
    'export function shouldStartPaywallEntrance',
  );
  const end = premiumSource.indexOf('\n}\n\nfunction CloseIcon', start);
  const functionSource = premiumSource
    .slice(start, end + 2)
    .replace('export ', '');

  return vm.runInNewContext(`(${functionSource})`);
}

describe('pixel-matched paywall integration', () => {
  test('keeps the legacy paywall available behind a one-line flag', () => {
    expect(legacySource).toContain('export default function PaywallScreen');
    expect(flagsSource).toContain('PIXEL_PAYWALL_ENABLED = true');
    expect(navigatorSource).toContain("require('../components/PaywallScreen').default");
    expect(navigatorSource).toContain("require('../components/PremiumPaywallScreen').default");
    expect(navigatorSource).toContain('getActivePaywallScreen');
    expect(appSource).toContain('if (PIXEL_PAYWALL_ENABLED)');
    expect(appSource).toContain("setInitialLaunchScreen('PaywallScreen')");
  });

  test('uses the supplied hero image and screenshot copy', () => {
    expect(premiumSource).toContain('PaywallGirls.webp');
    expect(premiumSource).toContain('paywall.premium.headline');
    expect(premiumSource).toContain('paywall.premium.saveBadge');
    expect(englishCatalog.paywall.premium.headline).toBe(
      'All premium AI in one plan',
    );
    expect(englishCatalog.paywall.ctaFreeTrial).toBe('Try It For Free');
    expect(englishCatalog.paywall.premium.saveBadge).toBe('Save 83%');
  });

  test('preserves purchase, restore, and close-gate behavior', () => {
    expect(premiumSource).toContain('purchasePackage?.(selectedPackage)');
    expect(premiumSource).toContain('restorePurchases?.()');
    expect(premiumSource).toContain('PAYWALL_CLOSE_LOCK_MS');
    expect(premiumSource).toContain('consumePendingPremiumAction()');
    expect(premiumSource).toContain("offeringsState === 'error'");
    expect(premiumSource).toContain('handleRetryOfferings');
    expect(premiumSource).not.toContain('disabled={isBusy}\n              onPress={handleRestore}');
    expect(subscriptionSource).toContain('setAvailablePackages(next)');
    expect(subscriptionSource).toContain(
      'const OFFERINGS_RETRY_DELAYS_MS = [0, 750]',
    );
    expect(subscriptionSource).toContain('OFFERINGS_TIMEOUT_MS = 4000');
    expect(subscriptionSource).toContain(
      'RevenueCat returned no purchasable Google Play packages.',
    );
    expect(subscriptionSource).toContain(
      '[RevenueCat] offering catalog loaded',
    );
    expect(premiumSource).toContain('offeredPackages');
    expect(paymentsSource).toContain("identifier: 'cloud_ai_weekly'");
    expect(paymentsSource).toContain("priceString: 'USD 3.99'");
    expect(paymentsSource).toContain('hasFreeTrial: true');
    expect(paymentsSource).toContain("identifier: 'cloud_ai_yearly'");
    expect(paymentsSource).toContain("priceString: 'USD 44.99'");
    expect(premiumSource).toContain('new Intl.NumberFormat');
    expect(premiumSource).toContain('price={yearlyPrice}');
    expect(premiumSource).toContain('period={premiumCopy.year}');
    expect(premiumSource).toContain(
      '`${yearlyPerWeekPrice} / ${premiumCopy.week}`',
    );
    expect(premiumSource).toContain(
      "`${tr('paywall.plans.weekly.trialThen')} ${weeklyPrice} / ${premiumCopy.week}`",
    );
    expect(premiumSource).toContain('PLAY_SUBSCRIPTIONS_URL');
    expect(premiumSource).toContain('!selectedNativePackage');
    expect(premiumSource).not.toContain(
      'sourcePackages?.yearly ||\n      sourcePackages?.weekly',
    );
  });

  test('uses coordinated entrance and dismissal animations', () => {
    expect(premiumSource).toContain('transitionProgress');
    expect(premiumSource).toContain('fullScreenTransitionStyle');
    expect(premiumSource).toContain(
      'style={[styles.screen, fullScreenTransitionStyle]}',
    );
    expect(premiumSource).toContain('animateDismiss');
    expect(premiumSource).toContain('exitCommittedRef');
    expect(premiumSource).toContain('closeFallbackTimerRef');
    expect(premiumSource).toContain('start(finishDismissal)');
    expect(premiumSource).not.toContain('if (finished) {\n        performClose();');
    expect(premiumSource).toContain('Easing.inOut(Easing.cubic)');
    expect(navigatorSource).toContain("animation: 'none'");
    expect(premiumSource).toContain('resizeMethod="resize"');
    expect(premiumSource).toContain('fadeDuration={0}');
    expect(premiumSource).toContain('shouldStartPaywallEntrance({');
    expect(premiumSource).toContain('setSurfaceVisible(true)');
    expect(premiumSource).not.toContain('contentProgress');
    expect(premiumSource).not.toContain('usesPersistentHero');
    expect(premiumSource).not.toContain('transitionCurtain');
    expect(premiumSource).toContain('pricingIsLoading');
    expect(premiumSource).toContain("tr('chat.loading')");
    expect(premiumSource).not.toContain("|| '$69.99'");
    expect(premiumSource).not.toContain("|| '$7.99'");
  });

  test('does not restart entrance after early-premium dismissal begins', () => {
    const shouldStartPaywallEntrance = readEntranceGuard();

    expect(
      shouldStartPaywallEntrance({
        heroSurfaceReady: false,
        isPremium: true,
        isClosing: true,
      }),
    ).toBe(false);

    // The hero can finish loading after the premium effect starts dismissal.
    // Entrance must remain off or it can cancel the dismissal callback.
    expect(
      shouldStartPaywallEntrance({
        heroSurfaceReady: true,
        isPremium: true,
        isClosing: true,
      }),
    ).toBe(false);
    expect(
      shouldStartPaywallEntrance({
        heroSurfaceReady: true,
        isPremium: false,
        isClosing: true,
      }),
    ).toBe(false);
    expect(
      shouldStartPaywallEntrance({
        heroSurfaceReady: true,
        isPremium: false,
        isClosing: false,
      }),
    ).toBe(true);
  });
});

import {
  PAYWALL_CLOSE_LOCK_MS,
  shouldDelayPaywallClose,
} from '../src/lib/paywallCloseGate';
import fs from 'fs';
import path from 'path';

const paywallSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'PaywallScreen.jsx'),
  'utf8',
);
const localesDirectory = path.join(__dirname, '..', 'src', 'i18n', 'locales');

describe('paywall close gate', () => {
  test('keeps the close button immediately available', () => {
    expect(shouldDelayPaywallClose({ firstLaunchPaywall: true })).toBe(false);
    expect(shouldDelayPaywallClose({ firstLaunchPaywall: false })).toBe(false);
    expect(shouldDelayPaywallClose({})).toBe(false);
    expect(shouldDelayPaywallClose(null)).toBe(false);
  });

  test('does not impose a close lock', () => {
    expect(PAYWALL_CLOSE_LOCK_MS).toBe(0);
  });

  test('does not render a countdown indicator while close is locked', () => {
    expect(paywallSource).not.toContain('CloseCountdownProgress');
  });

  test('selects weekly first unless only yearly is available', () => {
    expect(paywallSource).toContain("useState('weekly')");
    expect(paywallSource).toContain(
      "setSelectedPlan(hasWeekly || !hasYearly ? 'weekly' : 'yearly')",
    );
  });

  test('shows a free trial call to action for the weekly plan', () => {
    expect(paywallSource).toContain("selectedPlan === 'weekly'");
    expect(paywallSource).toContain("tr('paywall.ctaFreeTrial'");
    expect(paywallSource).toContain("defaultValue: 'Try It For Free'");
    expect(paywallSource).toContain("tr('paywall.cta')");
    expect(paywallSource).not.toContain("textTransform: 'uppercase'");
  });

  test('provides a free trial call to action translation in every locale', () => {
    const missingTranslations = fs
      .readdirSync(localesDirectory)
      .filter(fileName => fileName.endsWith('.json'))
      .filter(fileName => {
        const locale = JSON.parse(
          fs.readFileSync(path.join(localesDirectory, fileName), 'utf8'),
        );

        return !locale.paywall?.ctaFreeTrial;
      });

    expect(missingTranslations).toEqual([]);
    const english = JSON.parse(
      fs.readFileSync(path.join(localesDirectory, 'en.json'), 'utf8'),
    );
    expect(english.paywall.ctaFreeTrial).toBe('Try It For Free');
  });
});

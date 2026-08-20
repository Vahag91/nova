const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Cloud AI public branding contract', () => {
  test('uses Cloud AI for the launcher and visible navigation branding', () => {
    expect(read('android/app/src/main/res/values/strings.xml')).toContain(
      '<string name="app_name">Cloud AI</string>',
    );
    expect(JSON.parse(read('app.json')).displayName).toBe('Cloud AI');
    expect(read('src/navigation/AndroidNavigationMenu.jsx')).toContain(
      '>Cloud AI</Text>',
    );
  });

  test('removes the former brands from every runtime localization', () => {
    const localeDirectory = path.join(root, 'src/i18n/locales');
    const localeFiles = fs
      .readdirSync(localeDirectory)
      .filter(file => file.endsWith('.json'));

    expect(localeFiles.length).toBeGreaterThan(0);
    for (const localeFile of localeFiles) {
      const locale = fs.readFileSync(
        path.join(localeDirectory, localeFile),
        'utf8',
      );
      expect(locale).not.toMatch(/chat\s*cloud/i);
      // Brand form only, so language words such as Turkish "Dolandırıcılık"
      // or Slovak "doladený" are not false positives.
      expect(locale).not.toMatch(/dola\s*ai/i);
    }
  });

  test('preserves identifiers required for upgrades and subscriptions', () => {
    expect(JSON.parse(read('app.json')).name).toBe('ChatCloud');
    expect(read('src/config/payments.js')).toContain(
      "'Create a project called Cloud Ai Pro'",
    );
    expect(read('android/app/build.gradle')).toContain(
      'applicationId "com.aicloudsolutions.cloud"',
    );
    const subscriptionContext = read('src/context/SubscriptionContext.js');
    expect(subscriptionContext).toContain('!!active[entitlementId]');
    expect(subscriptionContext).not.toContain('Object.keys(active)');
  });
});

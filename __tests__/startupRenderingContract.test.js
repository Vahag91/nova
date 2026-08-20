const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'App.js');
const subscriptionPath = path.join(
  __dirname,
  '..',
  'src',
  'context',
  'SubscriptionContext.js',
);

describe('startup rendering contract', () => {
  test('renders app content without waiting for background startup work', () => {
    const app = fs.readFileSync(appPath, 'utf8');

    expect(app).toContain('runStartupTask');
    expect(app).toContain('StartupLoadingScreen');
    expect(app).not.toContain('const bootReady =');
    expect(app).not.toMatch(/firstLaunch\s*&&\s*deviceIdReady/);
    expect(app.indexOf('<StatusBar')).toBeLessThan(
      app.indexOf('{firstLaunch !== null ? ('),
    );
  });

  test('bounds RevenueCat initialization without making it a render gate', () => {
    const subscription = fs.readFileSync(subscriptionPath, 'utf8');

    expect(subscription).toContain('runStartupTask');
    expect(subscription).toContain("label: 'initializeSubscriptions'");
    expect(subscription).not.toMatch(
      /return\s+null\s*;\s*\/\/\s*wait.*subscription/i,
    );
  });
});

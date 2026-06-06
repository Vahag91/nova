import fs from 'fs';
import path from 'path';

const readSource = relativePath =>
  fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

const endpointsSource = readSource('src/config/endpoints.js');
const supabaseDeviceSource = readSource('src/lib/supabaseDevice.js');
const subscriptionSource = readSource('src/context/SubscriptionContext.js');

describe('reviewer premium coins', () => {
  test('requests the server-backed reviewer coin grant', () => {
    expect(endpointsSource).toContain('RC_WEBHOOK_URL');
    expect(endpointsSource).toContain('/functions/v1/rc-webhook');
    expect(supabaseDeviceSource).toContain('RC_WEBHOOK_URL');
    expect(supabaseDeviceSource).toContain("action: 'grant_reviewer_coins'");
    expect(supabaseDeviceSource).not.toContain(".from('coins_ledger').insert");
  });

  test('shows only a confirmed server balance after reviewer activation', () => {
    expect(subscriptionSource).toContain('grantReviewerCoins(deviceId)');
    expect(subscriptionSource).toContain('setReviewerPremiumCoinsGranted(true)');
    expect(subscriptionSource).not.toContain(
      'Math.max(typeof currentBalance === \'number\' ? currentBalance : 0, 1000)',
    );
  });
});

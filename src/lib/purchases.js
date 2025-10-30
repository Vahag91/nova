import Purchases from 'react-native-purchases';

export async function initRevenueCat(deviceId) {
  if (__DEV__) {
    Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  } 
  await Purchases.configure({
    apiKey: __DEV__ ? 'appl_YOUR_SANDBOX_KEY' : 'appl_YOUR_PROD_KEY',
    appUserID: deviceId, // must equal coins_ledger.device_id
  });
}

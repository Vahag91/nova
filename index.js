/**
 * @format
 */

import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import './src/error/initErrorHandling'; // ✅ global JS error handler (one-time import)
import { setPendingNotificationNav } from './src/notifications/notificationNavQueue';

// Chat debug logs (dev-only). Override by setting `global.__CHATCLOUD_DEBUG__` yourself.
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  if (typeof global.__CHATCLOUD_DEBUG__ === 'undefined') {
    global.__CHATCLOUD_DEBUG__ = { streaming: true, scroll: true };
    console.log('[chat:debug] enabled', global.__CHATCLOUD_DEBUG__);
  }
}

notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type !== EventType.PRESS) return;

  const data = detail?.notification?.data;
  const route = data?.route;
  if (!route) return;

  await setPendingNotificationNav({ route, ts: Date.now() });
});

AppRegistry.registerComponent(appName, () => App);

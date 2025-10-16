// src/error/initErrorHandling.js
import { logException } from './logger';

// If you add Sentry later, you’ll do it here:
// import * as Sentry from '@sentry/react-native';
// Sentry.init({ dsn: 'YOUR_DSN', enableNative: true });

const previousHandler =
  (global.ErrorUtils &&
    global.ErrorUtils.getGlobalHandler &&
    global.ErrorUtils.getGlobalHandler()) ||
  null;

if (global.ErrorUtils && global.ErrorUtils.setGlobalHandler) {
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    try { logException(error, { isFatal }); } catch {}
    if (previousHandler) previousHandler(error, isFatal);
  });
}

// src/error/logger.js
let SENTRY = null; // optional: we can bind Sentry later

export function bindSentry(sentry) {
  SENTRY = sentry;
}

export function logException(error, extra = {}) {
  if (__DEV__) {
    // Keep useful info during dev
    // eslint-disable-next-line no-console
    console.error('[AppError]', error, extra);
  }
  if (SENTRY) {
    SENTRY.captureException(error, { extra });
  }
}

export function logMessage(message, extra = {}) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[AppLog]', message, extra);
  }
  if (SENTRY) {
    SENTRY.captureMessage(message, { level: 'info', extra });
  }
}

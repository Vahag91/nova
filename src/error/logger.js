// src/error/logger.js
let SENTRY = null; // optional: we can bind Sentry later

export function bindSentry(sentry) {
  SENTRY = sentry;
}

export function logException(error, extra = {}) {
  if (SENTRY) {
    SENTRY.captureException(error, { extra });
  }
}

export function logMessage(message, extra = {}) {
  if (SENTRY) {
    SENTRY.captureMessage(message, { level: 'info', extra });
  }
}

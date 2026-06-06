const BILLING_UNAVAILABLE_MARKERS = [
  'BILLING_UNAVAILABLE',
  'Billing service unavailable',
  'Billing is not available',
  'PurchaseNotAllowedError',
];

let revenueCatLogHandlerInstalled = false;

export function shouldSuppressRevenueCatLog(level, message) {
  const normalizedLevel = String(level || '').toUpperCase();
  const normalizedMessage = String(message || '');

  return (
    normalizedLevel === 'ERROR' &&
    BILLING_UNAVAILABLE_MARKERS.some(marker => normalizedMessage.includes(marker))
  );
}

export function installRevenueCatLogHandler(PurchasesModule, logger = console) {
  if (revenueCatLogHandlerInstalled || !PurchasesModule?.setLogHandler) {
    return;
  }

  try {
    PurchasesModule.setLogHandler((level, message) => {
      if (shouldSuppressRevenueCatLog(level, message)) {
        return;
      }

      const text = `[RevenueCat] ${message}`;
      const normalizedLevel = String(level || '').toUpperCase();

      if (normalizedLevel === 'ERROR') {
        logger.error?.(text);
        return;
      }
      if (normalizedLevel === 'WARN') {
        logger.warn?.(text);
        return;
      }
      if (normalizedLevel === 'INFO') {
        logger.info?.(text);
        return;
      }

      logger.debug?.(text);
    });

    revenueCatLogHandlerInstalled = true;
  } catch {}
}

export function isChatDebugEnabled(feature) {
  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
  if (!isDev) return false;

  const g = typeof global !== 'undefined' ? global : {};
  const flags = g?.__CHATCLOUD_DEBUG__;
  if (!flags) return false;
  if (flags === true) return true;
  if (typeof flags !== 'object') return false;
  return flags?.[feature] === true;
}

export function chatDebugLog(feature, ...args) {
  if (!isChatDebugEnabled(feature)) return;
  console.log(`[chat:${feature}]`, ...args);
}

export function mapProxyError(err) {
  const code = err?.code || err?.status;
  const msg = err?.message || '';
  const generic = { title: 'Something went wrong', message: 'Please try again.' };
  
  if (code === 429 || code === 'RATE_LIMIT') {
    const retryAfter = err?.retryAfter;
    const message = retryAfter
      ? `We are handling many requests. Please retry in about ${Math.ceil(retryAfter)} seconds.`
      : 'We are handling many requests. Please try again in a moment.';
    return { title: 'Too many requests', message };
  }
  
  if (code === 401 || /auth|token|unauthor/i.test(msg)) {
    return { title: 'Authorization issue', message: 'We could not verify your account. Please try again.' };
  }
  
  if (code >= 500) {
    return { title: 'Server hiccup', message: 'Our servers had trouble. Please try again shortly.' };
  }
  
  if (code === 'TIMEOUT' || code === 'INACTIVITY_TIMEOUT') {
    return { title: 'Taking too long', message: 'The request timed out. Please try again.' };
  }
  
  if (code === 'NETWORK') {
    return { title: 'No connection', message: 'Please check your internet connection and try again.' };
  }
  
  if (msg) {
    return { title: generic.title, message: msg };
  }

  return generic;
}

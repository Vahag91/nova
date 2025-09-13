export function mapProxyError(err) {
  const code = err?.code || err?.status;
  const msg = err?.message || '';
  
  if (code === 429 || code === 'RATE_LIMIT') {
    const retryAfter = err?.retryAfter;
    const message = retryAfter 
      ? `Too many requests. Try again in ~${Math.ceil(retryAfter)}s.`
      : 'Too many requests. Try again shortly.';
    return { title: 'Rate limited', message };
  }
  
  if (code === 401 || /auth|token|unauthor/i.test(msg)) {
    return { title: 'Authorization error', message: 'Server rejected the request.' };
  }
  
  if (code >= 500) {
    return { title: 'Server error', message: 'Upstream failed. Try again.' };
  }
  
  if (code === 'TIMEOUT' || code === 'INACTIVITY_TIMEOUT') {
    return { title: 'Timeout', message: 'Connection stalled.' };
  }
  
  if (code === 'NETWORK') {
    return { title: 'Network error', message: 'Check your internet connection.' };
  }
  
  return { title: 'Error', message: msg || 'Request failed.' };
}

export function mapProxyError(err) {
  const code = err?.code || err?.status;
  const msg = err?.message || '';
  const generic = { title: 'Something went wrong', message: 'Please try again.' };
  
  // Never return technical error messages - always return user-friendly ones
  
  if (code === 429 || code === 'RATE_LIMIT') {
    const retryAfter = err?.retryAfter;
    const message = retryAfter
      ? `We are handling many requests. Please retry in about ${Math.ceil(retryAfter)} seconds.`
      : 'We are handling many requests. Please try again in a moment.';
    return { title: 'Too many requests', message };
  }

  if (code === 'restricted_content') {
    return {
      title: 'Restricted Content',
      message: 'This request was blocked by safety filters.',
    };
  }

  if (code === 'insufficient_coins') {
    return {
      title: 'Not enough coins',
      message: 'Your current balance is too low for this request.',
    };
  }

  if (code === 'invalid_image_response') {
    return {
      title: 'Image unavailable',
      message: 'The generated image file was temporarily unavailable. Please try again.',
    };
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
  
  if (code === 'NETWORK' || code === 0 || /network|connection|fetch|failed|offline|no internet/i.test(msg)) {
    return { title: 'No connection', message: 'No internet connection. Please check your connection and try again.' };
  }
  
  // Catch HTTP errors (400, 404, etc.) and convert to user-friendly messages
  if (code >= 400 && code < 500 && code !== 401 && code !== 429) {
    return { title: 'Request issue', message: 'Something went wrong with your request. Please try again.' };
  }
  
  if (/timeout|timed out/i.test(msg)) {
    return { title: 'Taking too long', message: 'The request timed out. Please try again.' };
  }
  
  if (/rate limit|quota|too many/i.test(msg)) {
    return { title: 'Too many requests', message: 'We are handling many requests. Please try again in a moment.' };
  }
  
  if (/server|500|502|503|504/i.test(msg)) {
    return { title: 'Server hiccup', message: 'Our servers had trouble. Please try again shortly.' };
  }

  if (/temporarily unavailable|cloudflare|image file was temporarily unavailable/i.test(msg)) {
    return {
      title: 'Image unavailable',
      message: 'The generated image file was temporarily unavailable. Please try again.',
    };
  }
  
  // Catch HTTP error patterns in message text
  if (/http error|http status|status code|404|403|400/i.test(msg)) {
    return { title: 'Request issue', message: 'Something went wrong with your request. Please try again.' };
  }
  
  // Always return generic user-friendly message, never technical error details
  return generic;
}

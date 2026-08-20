function translateError(t, key, defaultValue, values = {}) {
  if (typeof t !== 'function') return defaultValue;
  return t(`app.proxyErrors.${key}`, { ...values, defaultValue });
}

export function mapProxyError(err, t) {
  const code = err?.code || err?.status;
  const msg = err?.message || '';
  const copy = (key, defaultValue, values) =>
    translateError(t, key, defaultValue, values);
  const generic = {
    title: copy('genericTitle', 'Something went wrong'),
    message: copy('genericMessage', 'Please try again.'),
  };

  // Never return technical error messages - always return user-friendly ones.
  if (code === 429 || code === 'RATE_LIMIT') {
    const retryAfter = err?.retryAfter;
    const seconds = retryAfter ? Math.ceil(retryAfter) : null;
    const message = seconds
      ? copy(
          'rateLimitRetryAfter',
          'We are handling many requests. Please retry in about {{seconds}} seconds.',
          { seconds },
        )
      : copy(
          'rateLimitMessage',
          'We are handling many requests. Please try again in a moment.',
        );
    return {
      title: copy('rateLimitTitle', 'Too many requests'),
      message,
    };
  }

  if (code === 'restricted_content') {
    return {
      title: copy('restrictedTitle', 'Restricted Content'),
      message: copy(
        'restrictedMessage',
        'This request was blocked by safety filters.',
      ),
    };
  }

  if (code === 'insufficient_coins') {
    return {
      title: copy('insufficientCoinsTitle', 'Not enough coins'),
      message: copy(
        'insufficientCoinsMessage',
        'Your current balance is too low for this request.',
      ),
    };
  }

  if (code === 'invalid_image_response') {
    return {
      title: copy('imageUnavailableTitle', 'Image unavailable'),
      message: copy(
        'imageUnavailableMessage',
        'The generated image file was temporarily unavailable. Please try again.',
      ),
    };
  }

  if (code === 401 || /auth|token|unauthor/i.test(msg)) {
    return {
      title: copy('authorizationTitle', 'Authorization issue'),
      message: copy(
        'authorizationMessage',
        'We could not verify your account. Please try again.',
      ),
    };
  }

  if (code >= 500 || /server|500|502|503|504/i.test(msg)) {
    return {
      title: copy('serverTitle', 'Server hiccup'),
      message: copy(
        'serverMessage',
        'Our servers had trouble. Please try again shortly.',
      ),
    };
  }

  if (
    code === 'TIMEOUT' ||
    code === 'INACTIVITY_TIMEOUT' ||
    /timeout|timed out/i.test(msg)
  ) {
    return {
      title: copy('timeoutTitle', 'Taking too long'),
      message: copy(
        'timeoutMessage',
        'The request timed out. Please try again.',
      ),
    };
  }

  if (
    code === 'NETWORK' ||
    code === 0 ||
    /network|connection|fetch|failed|offline|no internet/i.test(msg)
  ) {
    return {
      title: copy('networkTitle', 'No connection'),
      message: copy(
        'networkMessage',
        'No internet connection. Please check your connection and try again.',
      ),
    };
  }

  if (/rate limit|quota|too many/i.test(msg)) {
    return {
      title: copy('rateLimitTitle', 'Too many requests'),
      message: copy(
        'rateLimitMessage',
        'We are handling many requests. Please try again in a moment.',
      ),
    };
  }

  if (
    /temporarily unavailable|cloudflare|image file was temporarily unavailable/i.test(
      msg,
    )
  ) {
    return {
      title: copy('imageUnavailableTitle', 'Image unavailable'),
      message: copy(
        'imageUnavailableMessage',
        'The generated image file was temporarily unavailable. Please try again.',
      ),
    };
  }

  if (
    (code >= 400 && code < 500 && code !== 401 && code !== 429) ||
    /http error|http status|status code|404|403|400/i.test(msg)
  ) {
    return {
      title: copy('requestTitle', 'Request issue'),
      message: copy(
        'requestMessage',
        'Something went wrong with your request. Please try again.',
      ),
    };
  }

  return generic;
}

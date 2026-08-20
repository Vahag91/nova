import { mapProxyError } from '../src/lib/errors';

const fakeTranslate = (key, options = {}) =>
  options.seconds == null ? key : `${key}:${options.seconds}`;

describe('localized user-facing errors', () => {
  test('maps network failures through the translation catalog', () => {
    expect(mapProxyError({ code: 'NETWORK' }, fakeTranslate)).toEqual({
      title: 'app.proxyErrors.networkTitle',
      message: 'app.proxyErrors.networkMessage',
    });
  });

  test('preserves rounded retry timing as an interpolation value', () => {
    expect(
      mapProxyError(
        { code: 'RATE_LIMIT', retryAfter: 4.2 },
        fakeTranslate,
      ),
    ).toEqual({
      title: 'app.proxyErrors.rateLimitTitle',
      message: 'app.proxyErrors.rateLimitRetryAfter:5',
    });
  });

  test('keeps English fallbacks for non-React callers', () => {
    expect(mapProxyError({ code: 'restricted_content' })).toEqual({
      title: 'Restricted Content',
      message: 'This request was blocked by safety filters.',
    });
  });
});

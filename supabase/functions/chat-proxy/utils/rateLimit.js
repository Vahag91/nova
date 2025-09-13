const BUCKET = new Map(); // key -> { count, resetAt }

export function checkLimit(key, limit = 60, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const slot = BUCKET.get(key);
  if (!slot || now >= slot.resetAt) {
    BUCKET.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (slot.count >= limit) {
    const retryAfter = Math.ceil((slot.resetAt - now) / 1000);
    return { ok: false, retryAfter };
  }
  slot.count += 1;
  return { ok: true, retryAfter: 0 };
}

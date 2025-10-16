// lib/summaryBuilder.js

// Rough token estimator (~4 chars/token)
const estTok = (s = '') => Math.ceil((s.length || 0) / 4);

const MAX_BULLETS = 10;
const MAX_SUMMARY_TOKENS = 350; // allow richer context (still small)
const MIN_BULLETS_FOR_OK = 3;

// ===== Patterns (compact but useful) =====
const KEY_FIG_RE = new RegExp([
  String.raw`\b(?:\$|€|£)\s?\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?\b`,
  String.raw`\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b`,
  String.raw`\b\d+(?:\.\d+)?%`,
  String.raw`\border\s*(?:no\.?|#)\s*[A-Za-z0-9_-]{3,}\b`,
  String.raw`\b(?:invoice|receipt)\s*(?:no\.?|#)\s*\w{3,}\b`,
  String.raw`\b(?:id|ref(?:erence)?)\s*[:#]\s*[A-Za-z0-9_-]{3,}\b`
].join('|'), 'i');

const CONSTRAINT_RE = /\b(?:must|should|need|required|limit|cap|deadline|constraint|blocked|can(?:not|'t)|won(?:not|'t))\b/i;
const DECISION_RE   = /\b(?:let's|we (?:will|should|decided?)|decision|plan|next step|agree|choose|do this)\b/i;

function scrubPII(text, { keepFirstName = true } = {}) {
  if (!text) return text;
  let t = text;
  // emails & phones still scrubbed
  t = t.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
       .replace(/\+?\d[\d\s().-]{7,}\d/g, '[phone]');

  // ONLY redact "my name is ..." if we don't want names
  if (!keepFirstName) {
    t = t.replace(/\bmy name is\s+[A-Za-z][A-Za-z '-]{1,40}\b/i, 'my name is [redacted]');
  }
  return t;
}

function shorten(text, max = 180) {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 3) + '...' : t;
}

function safetyRewrite(line) {
  // if user proposes illegal sexual relationship involving a minor, etc.
  if (/(?:marry|sex|relationship).*(?:minor|child|under\s*18|\b\d{1,2}\b\s*year)/i.test(line)) {
    return 'Safety: user proposed an illegal/harmful request (minor). Do not comply—respond with a safety warning and lawful alternatives.';
  }
  return line;
}

function splitBullets(s = '') {
  return s.split('\n').map(x => x.replace(/^•\s?/, '').trim()).filter(Boolean);
}

function dedupeAndTrim(arr) {
  const seen = new Set();
  const out = [];
  for (const a of arr) {
    const key = a.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(a.length > 220 ? a.slice(0, 217) + '...' : a);
    }
  }
  return out;
}

// Fallback topic from last substantial user prompt
function inferTopicFromLastUser(thread) {
  const msgs = (thread.messages || []).filter(m => m.role !== 'system');
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'user') {
      const raw = Array.isArray(msgs[i].content)
        ? (msgs[i].content.find(p => p.type === 'text')?.text || '')
        : (msgs[i].content || '');
      const text = scrubPII(raw, { keepFirstName: true });
      if (text && text.replace(/\s+/g, '').length >= 12) {
        return `Topic: ${shorten(text, 160)}`;
      }
    }
  }
  return '';
}

// Build a fresh summary from the last 50 messages (newest→oldest scan)
export function buildFreshSummaryFromLast50(thread) {
  const msgs = (thread.messages || []).filter(m => m.role !== 'system');
  const last50 = msgs.slice(-50);

  const bullets = [];
  // Try to front-load a topic bullet if we end up with too few items
  let topic = '';

  for (let i = last50.length - 1; i >= 0; i--) {
    const m = last50[i];

    if (Array.isArray(m.content)) {
      const text = m.content.find(p => p.type === 'text')?.text || '';
      if (text) bullets.push(`Image noted: ${shorten(scrubPII(text, { keepFirstName: true }), 160)} (refer back with "see last image").`);
      continue;
    }

    const raw = m.content || '';
    const text = scrubPII(raw, { keepFirstName: true });
    if (!text) continue;

    const safe = safetyRewrite(text);
    if (safe !== text) {
      bullets.push(safe);
    } else if (/\bmy name is\s+[A-Za-z][A-Za-z '-]{1,40}\b/i.test(text)) {
      // Extract age if mentioned
      const ageMatch = text.match(/\b(\d{1,2})\s*years?\s*old\b/i);
      const age = ageMatch ? ` (${ageMatch[1]})` : '';
      bullets.push(`Identity: User is ${text.match(/\bmy name is\s+([A-Za-z][A-Za-z '-]{1,40})\b/i)?.[1] || 'unknown'}${age}.`);
    } else if (KEY_FIG_RE.test(text)) {
      bullets.push(`Key figure: ${shorten(text, 200)}`);
    } else if (CONSTRAINT_RE.test(text)) {
      bullets.push(`Constraint: ${shorten(text, 200)}`);
    } else if (DECISION_RE.test(text)) {
      bullets.push(`Decision/Next: ${shorten(text, 200)}`);
    }
    if (bullets.length >= MAX_BULLETS) break;
  }

  if (bullets.length < MIN_BULLETS_FOR_OK) {
    topic = inferTopicFromLastUser(thread);
    if (topic) bullets.unshift(topic);
  }

  const cleaned = dedupeAndTrim(bullets).slice(0, MAX_BULLETS);

  // Enforce token budget
  let body = cleaned.join('\n• ');
  while (estTok(body) > MAX_SUMMARY_TOKENS && cleaned.length > 0) {
    cleaned.pop();
    body = cleaned.join('\n• ');
  }

  return body ? `• ${body}` : '';
}

export function mergeSummaries(prev, next) {
  const p = splitBullets(prev);
  const n = splitBullets(next);
  const merged = dedupeAndTrim([...n, ...p]).slice(0, MAX_BULLETS);

  let body = merged.join('\n• ');
  while (estTok(body) > MAX_SUMMARY_TOKENS && merged.length > 0) {
    merged.pop();
    body = merged.join('\n• ');
  }
  return body ? `• ${body}` : '';
}

function bulletCount(s) { return splitBullets(s).length; }

export function shouldUpdateSummary(thread) {
  const msgs = (thread.messages || []).filter(m => m.role !== 'system');
  const messageCount = msgs.length;

  if (!thread.summary) return true;

  const lastSummaryCount = thread.meta?.summaryLastMsgCount ?? 0;
  const messagesSinceUpdate = messageCount - lastSummaryCount;
  const lastAt = thread.summaryUpdatedAt ?? 0;
  const minutesSince = (Date.now() - lastAt) / 60000;

  // Refresh sooner if summary is weak or a bit stale in small/churning chats
  if (bulletCount(thread.summary) < MIN_BULLETS_FOR_OK) return true;
  if (messagesSinceUpdate >= 15) return true;               // lower cadence than 50
  if (minutesSince >= 10 && messagesSinceUpdate >= 3) return true;

  // Fix for bad initial meta
  if (lastSummaryCount === 0 && messageCount > 0) return true;

  return false;
}

export function updateThreadSummary(thread, newSummary) {
  const nonSystemCount = (thread.messages || []).filter(m => m.role !== 'system').length;
  return {
    ...thread,
    summary: newSummary,
    summaryUpdatedAt: Date.now(),
    meta: {
      ...thread.meta,
      summaryLastMsgCount: nonSystemCount,
    },
  };
}

export async function ensureSummaryIfNeeded(thread, setThreadSummary) {
  try {
    if (typeof shouldUpdateSummary === 'function' && !shouldUpdateSummary(thread)) {
      return thread.summary;
    }

    const fresh = typeof buildFreshSummaryFromLast50 === 'function'
      ? buildFreshSummaryFromLast50(thread)
      : '';
    const merged = (typeof mergeSummaries === 'function' && thread.summary)
      ? mergeSummaries(thread.summary, fresh)
      : (fresh || thread.summary || '');

    if (merged && setThreadSummary) {
      const nonSystemCount = (thread.messages || []).filter(m => m?.role !== 'system').length;
      try {
        setThreadSummary(thread.id, merged, {
          summaryLastMsgCount: nonSystemCount,
          summaryUpdatedAt: Date.now(),
        });
      } catch {}
    }
    return merged;
  } catch {
    return thread.summary || '';
  }
}

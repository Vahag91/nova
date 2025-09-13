// Human-ish relative time for list items
export function formatRelative(ts) {
  const now = Date.now();
  const diff = Math.max(0, now - (ts || now));
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const dt = new Date(ts);
  return dt.toLocaleDateString();
}

// Prefer last assistant message; strip markdown/code; clamp length
export function betterPreview(messages) {
  if (!messages?.length) return 'Empty';
  const pick = [...messages].reverse().find(m => m.role === 'assistant') || messages[messages.length - 1];
  const raw = (pick?.content || '')
    .replace(/```[\s\S]*?```/g, '')   // remove fenced code
    .replace(/`[^`]*`/g, '')          // remove inline code
    .replace(/\s+/g, ' ')
    .trim();
  return raw.length > 80 ? raw.slice(0, 77) + '…' : (raw || 'Empty');
}

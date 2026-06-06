export function plainTextFromMarkdown(input) {
  let s = String(input ?? '');
  if (!s) return '';

  s = s.replace(/\r\n/g, '\n');

  // Keep code content but remove fences.
  s = s.replace(/```[^\n]*\n([\s\S]*?)\n?```/g, (_, code) =>
    String(code || '').replace(/\n+$/g, ''),
  );
  s = s.replace(/`([^`]+)`/g, '$1');

  // Images/links.
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const a = String(alt || '').trim();
    const u = String(url || '').trim();
    return a || u;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
    const t = String(text || '').trim();
    const u = String(url || '').trim();
    if (!t) return u;
    if (!u) return t;
    if (t === u) return u;
    return `${t} (${u})`;
  });

  // Headings / blockquotes.
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  s = s.replace(/^\s{0,3}>\s?/gm, '');

  // Horizontal rules.
  s = s.replace(/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/gm, '');

  // Lists.
  s = s.replace(/^\s{0,3}(\d+)\.\s+/gm, '- ');
  s = s.replace(/^\s{0,3}[-*+]\s+/gm, '- ');

  // Bold / italic / strike.
  s = s.replace(/\*\*([\s\S]+?)\*\*/g, '$1');
  s = s.replace(/__([\s\S]+?)__/g, '$1');
  s = s.replace(/(^|[^\w])\*([^*\n]+)\*(?=[^\w]|$)/g, '$1$2');
  s = s.replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g, '$1$2');
  s = s.replace(/~~([\s\S]+?)~~/g, '$1');

  // Tables: convert pipe-separated rows to tab-separated rows (skip separator lines).
  s = s
    .split('\n')
    .map(line => {
      const l = String(line);
      if (!l.includes('|')) return l;
      const trimmed = l.trim();
      if (!trimmed.startsWith('|')) return l;
      const sep = trimmed.replace(/[|:\-\s]/g, '');
      if (sep.length === 0) return '';
      const cells = trimmed
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map(c => c.trim());
      return cells.join('\t');
    })
    .join('\n');

  // Normalize whitespace.
  s = s.replace(/[ \t]+\n/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

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

export function stripImageArtifacts(input) {
  if (!input) return { text: '', imageCount: 0 };
  let imageCount = 0;
  const asString = String(input || '');
  const markless = asString.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, () => {
    imageCount += 1;
    return '';
  });
  const withoutDanglingMarkdown = markless.replace(/!\[([^\]]*)\]\((?=[^)]*$)/g, () => {
    imageCount += 1;
    return '';
  });
  const withoutBareMarkdown = withoutDanglingMarkdown.replace(/!\[([^\]]+)\]/g, () => {
    imageCount += 1;
    return '';
  });
  const withoutDataUris = withoutBareMarkdown.replace(/\bdata:image\/[a-z0-9.+-]+;base64,[^\s)]+/gi, () => {
    imageCount += 1;
    return '';
  });
  const withoutFileUris = withoutDataUris.replace(/\b(?:file|ph|assets-library):\/\/[^\s)]+/gi, () => {
    imageCount += 1;
    return '';
  });
  const withoutImageUrls = withoutFileUris.replace(/\bhttps?:\/\/[^\s)]+(?:\.(?:png|jpe?g|gif|webp|bmp|heic|svg))(?:\?[^\s)]*)?/gi, () => {
    imageCount += 1;
    return '';
  });
  const collapsed = withoutImageUrls.replace(/\s+/g, ' ').trim();
  return { text: collapsed, imageCount };
}

export function summaryPreview(summary) {
  if (!summary) return '';

  const summaryText = String(summary);
  const lines = summaryText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('•'))
    .map(line => line.replace(/^•\s*/, ''));

  if (lines.length === 0) {
    const { text, imageCount } = stripImageArtifacts(summaryText);
    if (!text && imageCount > 0) {
      return '';
    }
    return text || '';
  }

  let text = lines[0]
    .replace(/^Topic:\s*/i, '')
    .replace(/^Objective:\s*/i, '')
    .replace(/^Image noted:\s*/i, '')
    .replace(/^Key figure:\s*/i, '')
    .replace(/^Constraint:\s*/i, '')
    .replace(/^Decision\/Next:\s*/i, '')
    .replace(/^Identity:\s*/i, '')
    .replace(/^Safety:\s*/i, '')
    .trim();

  text = text.replace(/\s*\(refer back.*?\)\.?$/i, '');

  const { text: stripped, imageCount } = stripImageArtifacts(text);
  if (!stripped && imageCount > 0) {
    return '';
  }

  return stripped || '';
}

// Preview based on the first meaningful user message in the thread
export function firstUserPreview(messages) {
  if (!messages?.length) return '';

  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    if (message?.role !== 'user') continue;

    const candidate = buildCandidate(message);
    if (candidate.previewText) {
      return truncatePreview(candidate.previewText);
    }
    if (candidate.totalImages > 0) {
      return 'Image';
    }
  }

  return '';
}

const MAX_PREVIEW_LENGTH = 80;
const GENERIC_ACK_RE = /^(ok(?:ay)?|sure|thanks|thank you|sounds good|got it|understood|great|perfect|done|nice|cool|yep|yeah|alright|will do|no problem|cheers|roger that|noted)[.!]*$/i;

function flattenMessageContent(message) {
  if (!message) return '';
  const { content } = message;

  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    const parts = [];
    for (const part of content) {
      if (!part) continue;
      if (typeof part === 'string') {
        parts.push(part);
        continue;
      }
      if (typeof part.text === 'string') {
        parts.push(part.text);
        continue;
      }
      if (part.type === 'text' && typeof part.value === 'string') {
        parts.push(part.value);
        continue;
      }
      if (part.type === 'image_url' && part?.image_url?.url) {
        parts.push(`![image](${part.image_url.url})`);
        continue;
      }
      if (typeof part === 'object' && typeof part.content === 'string') {
        parts.push(part.content);
      }
    }
    return parts.filter(Boolean).join('\n');
  }

  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text;
    if (Array.isArray(content.parts)) {
      return content.parts
        .map(p => (typeof p?.text === 'string' ? p.text : ''))
        .filter(Boolean)
        .join('\n');
    }
  }

  if (typeof message === 'string') return message;
  return '';
}

function collapseLinks(text) {
  if (!text) return '';
  return text.replace(/\[([^\]]+)\]\((?:[^)]+)\)/g, '$1');
}

function stripSimpleMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/#{1,6}\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncatePreview(text, max = MAX_PREVIEW_LENGTH) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function buildCandidate(message) {
  const flattened = flattenMessageContent(message);
  const { text: noImages, imageCount: imagesInText } = stripImageArtifacts(flattened);
  const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
  const attachmentImages = attachments.filter(att => att && att.type === 'image').length;
  const totalImages = imagesInText + attachmentImages;
  const withLinksCollapsed = collapseLinks(noImages);
  const plain = stripSimpleMarkdown(withLinksCollapsed);
  const previewText = plain;
  const weak = !plain || plain.length < 12 || GENERIC_ACK_RE.test((plain || '').toLowerCase());

  return {
    previewText,
    plainText: plain,
    totalImages,
    imageOnly: !plain && totalImages > 0,
    weak,
  };
}

function scoreCandidate(role, candidate) {
  let score = 0;
  if (role === 'assistant') score += 5;
  else if (role === 'user') score += 4;
  else score += 1;

  const len = candidate.previewText.length;
  if (len >= 72) score += 4;
  else if (len >= 48) score += 3;
  else if (len >= 24) score += 2;
  else if (len >= 10) score += 1;

  if (candidate.imageOnly) score -= 2;
  if (candidate.weak) score -= 1;
  return score;
}

// Prefer meaningful assistant/user snippets; combine when helpful; clamp length
export function betterPreview(messages) {
  if (!messages?.length) return 'Empty';
  let bestAssistant = null;
  let bestUser = null;
  let bestAny = null;
  let sawImageOnly = false;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const candidate = buildCandidate(message);
    if (!candidate.previewText) {
      if (candidate.totalImages > 0) {
        sawImageOnly = true;
      }
      continue;
    }

    const scored = {
      ...candidate,
      role: message.role,
      truncated: truncatePreview(candidate.previewText),
    };
    scored.score = scoreCandidate(message.role, candidate);

    if (!bestAny || scored.score > bestAny.score) bestAny = scored;
    if (message.role === 'assistant') {
      if (!bestAssistant || scored.score > bestAssistant.score) bestAssistant = scored;
    } else if (message.role === 'user') {
      if (!bestUser || scored.score > bestUser.score) bestUser = scored;
    }
  }

  if (bestAssistant && bestUser) {
    if (!bestAssistant.imageOnly && !bestUser.imageOnly) {
      const combined = truncatePreview(`${bestUser.previewText} • ${bestAssistant.previewText}`);
      if (combined && combined.length >= 24) {
        return combined;
      }
    }
    if (bestAssistant.weak && !bestUser.weak) {
      return bestUser.truncated;
    }
    return bestAssistant.truncated;
  }

  if (bestAssistant) return bestAssistant.truncated;
  if (bestUser) return bestUser.truncated;
  if (bestAny) return bestAny.truncated;
  return sawImageOnly ? '' : 'Empty';
}

import { betterPreview, firstUserPreview, summaryPreview } from './format';

const DEFAULT_MODEL = 'gpt-5.4-nano';

export function hasRenderableMessages(messages) {
  return Array.isArray(messages)
    && messages.some(message => message?.role === 'user' || message?.role === 'assistant');
}

export function buildThreadPreview(thread) {
  const summaryText = typeof thread?.summary === 'string' ? thread.summary.trim() : '';
  const summaryBased = summaryText ? summaryPreview(summaryText) : '';
  const messages = Array.isArray(thread?.messages) ? thread.messages : [];

  return (
    firstUserPreview(messages)
    || summaryBased
    || betterPreview(messages)
    || ''
  );
}

export function normalizeThreadRecord(thread = {}) {
  const createdAt = Number(thread?.createdAt) || Date.now();
  const updatedAt = Number(thread?.updatedAt) || createdAt;
  const messages = Array.isArray(thread?.messages) ? thread.messages : [];

  return {
    id: thread?.id,
    title: typeof thread?.title === 'string' ? thread.title : '',
    createdAt,
    updatedAt,
    model: thread?.model || DEFAULT_MODEL,
    system: thread?.system ?? null,
    messages,
    summary: typeof thread?.summary === 'string' ? thread.summary : '',
    summaryUpdatedAt: Number(thread?.summaryUpdatedAt) || 0,
    pinned: !!thread?.pinned,
    meta: thread?.meta && typeof thread.meta === 'object' ? thread.meta : undefined,
    isPrivate: !!thread?.isPrivate,
  };
}

export function buildThreadIndexEntry(thread) {
  const normalized = normalizeThreadRecord(thread);

  return {
    id: normalized.id,
    title: normalized.title,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt,
    model: normalized.model,
    system: normalized.system,
    summary: normalized.summary,
    summaryUpdatedAt: normalized.summaryUpdatedAt,
    pinned: normalized.pinned,
    meta: normalized.meta,
    hasMessages: hasRenderableMessages(normalized.messages),
    preview: buildThreadPreview(normalized),
  };
}

export function mergeThreadRecord(indexEntry, threadRecord) {
  if (!indexEntry && !threadRecord) return null;

  const normalized = normalizeThreadRecord({
    ...(threadRecord || {}),
    ...(indexEntry || {}),
    messages: Array.isArray(threadRecord?.messages) ? threadRecord.messages : [],
  });

  return {
    ...normalized,
    meta: normalized.meta,
  };
}

export function buildThreadStateFromArray(threads = []) {
  const normalized = Array.isArray(threads)
    ? threads.map(thread => normalizeThreadRecord(thread))
    : [];

  const threadIndex = normalized
    .map(thread => buildThreadIndexEntry(thread))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  const threadsById = normalized.reduce((acc, thread) => {
    if (thread?.id) {
      acc[thread.id] = thread;
    }
    return acc;
  }, {});

  return { threadIndex, threadsById };
}

export function sortThreadIndex(index = []) {
  return [...index].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

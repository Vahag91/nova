export const FREE_MESSAGE_CHAR_LIMIT = 16_000;
export const PREMIUM_MESSAGE_CHAR_LIMIT = 64_000;
export const LARGE_PASTE_ATTACHMENT_THRESHOLD = 20_000;
export const PREMIUM_PASTE_CAPTURE_CHAR_LIMIT = 250_000;

export const MAX_DOCUMENTS_PER_MESSAGE = 3;
export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024;

export const FREE_CHAT_TOKEN_BUDGET = 6_000;
export const PREMIUM_CHAT_TOKEN_BUDGET = 20_000;

export const SUPPORTED_DOCUMENT_EXTENSIONS = Object.freeze([
  'pdf',
  'docx',
  'txt',
  'csv',
  'xlsx', 'pptx', 'odt', 'md', 'tsv', 'json',
]);

// Mirrors MAX_DOCUMENT_CONTEXT_CHARS in supabase/functions/chat-proxy-v2: the
// combined document text a single chat request can carry. Used only to disclose
// the cut to the user and the model; the proxy still enforces it.
export const CHAT_DOCUMENT_CONTEXT_CHARS = 48000;

export const SUPPORTED_DOCUMENT_MIME_TYPES = Object.freeze([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'text/markdown',
  'text/x-markdown',
  'application/zip',
  'text/tab-separated-values',
  'application/json',
  'text/comma-separated-values',
  'application/csv',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

export function getMessageCharLimit(isPremium) {
  return isPremium ? PREMIUM_MESSAGE_CHAR_LIMIT : FREE_MESSAGE_CHAR_LIMIT;
}

export function getChatTokenBudget(isPremium, modelContext) {
  const planBudget = isPremium
    ? PREMIUM_CHAT_TOKEN_BUDGET
    : FREE_CHAT_TOKEN_BUDGET;
  const context = Number(modelContext);

  if (!Number.isFinite(context) || context <= 0) {
    return planBudget;
  }

  // Keep ample room for system instructions and the model response.
  return Math.max(
    FREE_CHAT_TOKEN_BUDGET,
    Math.min(planBudget, Math.floor(context * 0.25)),
  );
}

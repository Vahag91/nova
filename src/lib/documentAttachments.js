import {
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_DOCUMENTS_PER_MESSAGE,
  SUPPORTED_DOCUMENT_EXTENSIONS,
  SUPPORTED_DOCUMENT_MIME_TYPES,
} from '../config/chatLimits';

const MIME_BY_EXTENSION = Object.freeze({
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  csv: 'text/csv',
});

export function getFileExtension(name = '') {
  const match = String(name).trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
}

export function sanitizeDocumentName(name, fallback = 'document.txt') {
  const withoutControlCharacters = Array.from(String(name || ''))
    .map(character => character.charCodeAt(0) < 32 ? '_' : character)
    .join('');
  const cleaned = withoutControlCharacters
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return fallback;
  if (cleaned.length <= 120) return cleaned;

  const extensionMatch = cleaned.match(/(\.[a-z0-9]{1,10})$/i);
  const suffix = extensionMatch?.[1] || '';
  return `${cleaned.slice(0, 120 - suffix.length)}${suffix}`;
}

export function resolveDocumentMimeType(file = {}) {
  const reported = String(file.type || file.mimeType || '').toLowerCase();
  const extension = getFileExtension(file.name);
  return MIME_BY_EXTENSION[extension] || reported || 'application/octet-stream';
}

export function isDocumentAttachment(attachment) {
  return attachment?.kind === 'document' || attachment?.type === 'file';
}

export function isImageAttachment(attachment) {
  return attachment?.kind === 'image'
    || (!attachment?.kind && /^image\//i.test(String(attachment?.type || '')));
}

export function isAttachmentReady(attachment) {
  return !isDocumentAttachment(attachment)
    || attachment?.status === 'selected'
    || attachment?.status === 'ready';
}

export function validatePickedDocument(file, existingAttachments = []) {
  const currentDocuments = existingAttachments.filter(isDocumentAttachment);
  if (currentDocuments.length >= MAX_DOCUMENTS_PER_MESSAGE) {
    return { ok: false, code: 'too_many_files', limit: MAX_DOCUMENTS_PER_MESSAGE };
  }

  const name = sanitizeDocumentName(file?.name);
  const extension = getFileExtension(name);
  const mimeType = resolveDocumentMimeType({ ...file, name });
  const reportedMime = String(file?.type || file?.mimeType || '').toLowerCase();
  const extensionAllowed = SUPPORTED_DOCUMENT_EXTENSIONS.includes(extension);
  const mimeAllowed = SUPPORTED_DOCUMENT_MIME_TYPES.includes(reportedMime || mimeType);

  if (!extensionAllowed || !mimeAllowed) {
    return { ok: false, code: 'unsupported_type' };
  }

  const size = Number(file?.size);
  if (Number.isFinite(size) && size > MAX_DOCUMENT_SIZE_BYTES) {
    return { ok: false, code: 'file_too_large', limit: MAX_DOCUMENT_SIZE_BYTES };
  }
  if (Number.isFinite(size) && size <= 0) {
    return { ok: false, code: 'empty_file' };
  }

  return {
    ok: true,
    value: {
      name,
      mimeType,
      size: Number.isFinite(size) ? size : null,
      uri: file?.uri,
    },
  };
}

export function toPersistedAttachment(attachment) {
  if (!isDocumentAttachment(attachment)) return null;
  return {
    id: attachment.remoteId || attachment.id,
    kind: 'document',
    name: sanitizeDocumentName(attachment.name),
    mimeType: attachment.mimeType || resolveDocumentMimeType(attachment),
    size: Number.isFinite(attachment.size) ? attachment.size : null,
    status: 'ready',
    source: attachment.source === 'paste' ? 'paste' : 'file',
    extractedChars: Number.isFinite(attachment.extractedChars)
      ? attachment.extractedChars
      : null,
  };
}

export function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

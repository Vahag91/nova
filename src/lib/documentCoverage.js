// Backward compatible: older attachments simply have no page metadata.
export function documentCoverage(raw = {}) {
  const coverage = {};
  if (typeof raw.truncated === 'boolean') coverage.truncated = raw.truncated;
  if (typeof raw.expiresAt === 'string' && Number.isFinite(Date.parse(raw.expiresAt))) {
    coverage.expiresAt = raw.expiresAt;
  }
  if (Number.isInteger(raw.pageCount) && raw.pageCount > 0 && raw.pageCount <= 100000
    && Number.isInteger(raw.extractedPages) && raw.extractedPages >= 0 && raw.extractedPages <= raw.pageCount) {
    coverage.pageCount = raw.pageCount;
    coverage.extractedPages = raw.extractedPages;
    coverage.partialText = raw.partialText === true || raw.extractedPages < raw.pageCount;
  } else if (raw.partialText === true) coverage.partialText = true;
  return coverage;
}

export function documentCoverageNotes(doc, copy) {
  const notes = [];
  const coverage = documentCoverage(doc);
  if (coverage.pageCount) notes.push(copy('documentPages', 'Text found on {{extracted}} of {{total}} pages.', {
    extracted: coverage.extractedPages, total: coverage.pageCount,
  }));
  if (coverage.partialText) notes.push(copy('documentPartialText', 'Some pages have no extractable text. Images and scans are not read.'));
  if (coverage.truncated) notes.push(copy('documentTruncated', 'Only the beginning of this document was extracted. The summary may miss later content.'));
  return notes;
}

const documentErrors = {
  ENCRYPTED_DOCUMENT: ['encrypted', 'This PDF is password-protected. Upload an unlocked copy.'],
  UNSUPPORTED_DOCUMENT: ['unsupportedDocument', 'This file is unreadable or its contents are unsupported. Use a PDF, DOCX, XLSX, PPTX, ODT, TXT, CSV, TSV, MD or JSON file.'],
  TOO_MANY_PAGES: ['tooManyPages', 'Split this PDF into files of up to 300 pages.'],
  NO_READABLE_TEXT: ['noReadableText', 'No readable text was found. Scanned PDFs need OCR; upload a text-based copy.'],
};
export function documentUploadError(error, t) {
  const mapped = documentErrors[error?.code];
  return mapped ? t(`chat.files.${mapped[0]}`, { defaultValue: mapped[1] })
    : error?.message || t('chat.files.failed', { defaultValue: 'Upload failed' });
}

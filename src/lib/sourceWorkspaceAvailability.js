// Versioned readiness contract: release builds stay closed until the backend
// explicitly supports every input used by this client. No source data is sent.
export function supportsSourceWorkspace(value, type) {
  if (value?.contractVersion !== 2 || value?.available !== true) return false;
  if (type === 'video')
    return ['youtube', 'upload', 'transcript'].some(
      key => value?.sources?.[key] === true,
    );
  if (type) return value?.sources?.[type] === true;
  return ['document', 'youtube', 'upload', 'transcript'].some(
    key => value?.sources?.[key] === true,
  );
}

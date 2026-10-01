import {
  DOCUMENT_PROCESS_URL,
  SUPABASE_ANON_KEY,
} from '../config/endpoints';

function normalizeResponse(payload, fallback) {
  const raw = payload?.attachment || payload?.document || payload;
  const remoteId = raw?.id || raw?.documentId || raw?.attachmentId;
  if (!remoteId) {
    throw new Error('Document processing returned no document ID.');
  }

  const responseSize = Number(raw?.size);
  const extractedChars = Number(raw?.extractedChars ?? raw?.extracted_chars);

  return {
    remoteId: String(remoteId),
    name: raw?.name || fallback.name,
    mimeType: raw?.mimeType || raw?.mime_type || fallback.mimeType,
    size: Number.isFinite(responseSize) ? responseSize : fallback.size,
    extractedChars: Number.isFinite(extractedChars) ? extractedChars : null,
  };
}

export function processDocument({ file, deviceId, signal, onProgress }) {
  let xhr = null;

  const promise = new Promise((resolve, reject) => {
    xhr = new XMLHttpRequest();
    xhr.open('POST', DOCUMENT_PROCESS_URL);
    xhr.timeout = 90_000;
    xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.setRequestHeader('x-client-id', String(deviceId));
    xhr.setRequestHeader('x-app-version', '1.0.0');

    xhr.upload.onprogress = event => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.max(0, Math.min(1, event.loaded / event.total)));
    };

    xhr.onerror = () => reject(new Error('Document upload failed.'));
    xhr.ontimeout = () => reject(new Error('Document processing timed out.'));
    xhr.onabort = () => {
      const error = new Error('Document upload cancelled.');
      error.code = 'ABORTED';
      reject(error);
    };
    xhr.onload = () => {
      let payload = null;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {}

      if (xhr.status < 200 || xhr.status >= 300) {
        const error = new Error(
          payload?.message || payload?.error || `Document upload failed (${xhr.status}).`,
        );
        error.status = xhr.status;
        error.code = payload?.code || 'DOCUMENT_UPLOAD_FAILED';
        reject(error);
        return;
      }

      try {
        resolve(normalizeResponse(payload, file));
      } catch (error) {
        reject(error);
      }
    };

    const form = new FormData();
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    });
    xhr.send(form);
  });

  const abort = () => {
    try {
      xhr?.abort();
    } catch {}
  };

  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  }

  return { promise, abort };
}

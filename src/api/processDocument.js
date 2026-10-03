import {
  DOCUMENT_PROCESS_URL,
  SUPABASE_ANON_KEY,
} from '../config/endpoints';
import { documentCoverage } from '../lib/documentCoverage';

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
    // Keep the picker label: Android multipart transport may encode or truncate
    // the server-side filename. The server ID remains the document identity.
    name: fallback.name || raw?.name,
    mimeType: raw?.mimeType || raw?.mime_type || fallback.mimeType,
    size: Number.isFinite(responseSize) ? responseSize : fallback.size,
    extractedChars: Number.isFinite(extractedChars) ? extractedChars : null,
    truncated: raw?.truncated === true,
    expiresAt: typeof raw?.expiresAt === 'string' ? raw.expiresAt : null,
    ...documentCoverage(raw),
  };
}

export function processDocument({ file, deviceId, signal, onProgress }) {
  let xhr = null;
  let rejectPending;
  let settled = false;
  const abort = () => {
    if (settled) return;
    try { xhr?.abort(); } catch {}
    rejectPending?.(Object.assign(new Error('Document upload cancelled.'), { code: 'ABORTED' }));
  };

  const promise = new Promise((resolve, reject) => {
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(value);
    };
    rejectPending = error => finish(error);
    if (signal?.aborted) { abort(); return; }
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

    xhr.onerror = () => finish(Object.assign(new Error('Document upload failed.'), { code: 'NETWORK' }));
    xhr.ontimeout = () => finish(Object.assign(new Error('Document processing timed out.'), { code: 'TIMEOUT' }));
    xhr.onabort = () => {
      const error = new Error('Document upload cancelled.');
      error.code = 'ABORTED';
      finish(error);
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
        finish(error);
        return;
      }

      try {
        finish(null, normalizeResponse(payload, file));
      } catch (error) {
        finish(error);
      }
    };

    const form = new FormData();
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType,
    });
    signal?.addEventListener('abort', abort, { once: true });
    try { xhr.send(form); } catch (error) { finish(error); }
  });

  return { promise, abort };
}

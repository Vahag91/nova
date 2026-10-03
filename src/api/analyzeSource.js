import { SUPABASE_BASE, SUPABASE_ANON_KEY } from '../config/endpoints';
import { APP_VERSION } from '../config/appInfo';
import { validateWorkspaceResult } from '../lib/workspaceContract';

function requestSource({
  source,
  deviceId,
  workspaceKey,
  requestId,
  signal,
  onProgress,
  method = 'POST',
}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve(value);
    };
    const abort = () => {
      xhr.abort();
      finish(Object.assign(new Error('Cancelled'), { code: 'ABORTED' }));
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    xhr.open(
      method,
      `${SUPABASE_BASE}/functions/v1/source-analyze${
        method === 'POST' ? '' : `?id=${encodeURIComponent(requestId)}`
      }`,
    );
    xhr.timeout = method === 'POST' ? 140000 : 15000;
    xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON_KEY}`);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.setRequestHeader('x-client-id', deviceId);
    xhr.setRequestHeader('x-app-version', APP_VERSION);
    if (workspaceKey) xhr.setRequestHeader('x-workspace-key', workspaceKey);
    if (requestId) xhr.setRequestHeader('x-request-id', requestId);
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onerror = () =>
      finish(Object.assign(new Error('Network error'), { code: 'NETWORK' }));
    xhr.ontimeout = () =>
      finish(Object.assign(new Error('Timed out'), { code: 'TIMEOUT' }));
    xhr.onabort = () =>
      finish(Object.assign(new Error('Cancelled'), { code: 'ABORTED' }));
    xhr.onload = () => {
      let body;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status < 200 || xhr.status >= 300) {
        finish(
          Object.assign(new Error(body?.message || 'Analysis failed'), {
            code:
              body?.code ||
              (xhr.status === 404 ? 'NOT_CONFIGURED' : 'ANALYSIS_FAILED'),
            status: xhr.status,
          }),
        );
      } else {
        finish(null, body);
      }
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (method !== 'POST') {
      xhr.send();
    } else if (source.file) {
      const form = new FormData();
      const { file, ...metadata } = source;
      form.append('metadata', JSON.stringify(metadata));
      form.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType,
      });
      xhr.send(form);
    } else {
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(source));
    }
  });
}

const invalid = () =>
  Object.assign(new Error('Invalid analysis job'), { code: 'INVALID_RESULT' });
export function validateSourceJob(job) {
  if (
    !job ||
    typeof job.id !== 'string' ||
    !['processing', 'completed', 'failed', 'cancelled'].includes(job.status)
  )
    throw invalid();
  if (job.status === 'completed')
    return { ...job, result: validateWorkspaceResult(job.result) };
  return job;
}
export async function getSourceJob(options) {
  const response = await requestSource({ ...options, method: 'GET' });
  const job = validateSourceJob(response?.job);
  if (job.id !== options.requestId) throw invalid();
  return job;
}
export async function cancelSourceJob(options) {
  const result = await requestSource({ ...options, method: 'DELETE' });
  if (result?.cancelled !== true) throw invalid();
}
export function waitForJobPoll(signal) {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('Stopped waiting'), { code: 'ABORTED' }));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, 2000);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
  });
}
export async function waitForSourceJob(options, initial) {
  let job = initial || (await getSourceJob(options));
  const deadline = Date.now() + 180000;
  while (job.status === 'processing') {
    if (Date.now() > deadline)
      throw Object.assign(new Error('Check this analysis again shortly'), {
        code: 'JOB_PENDING',
      });
    await waitForJobPoll(options.signal);
    job = await getSourceJob(options);
  }
  if (job.status !== 'completed')
    throw Object.assign(new Error('Analysis did not complete'), {
      code: job.code || 'ABORTED',
      terminal: true,
    });
  return job.result;
}
export async function analyzeSource(options) {
  const response = await requestSource(options);
  // Keep compatibility with the initial client contract during rollout.
  if (response?.result) return validateWorkspaceResult(response.result);
  const job = validateSourceJob(response?.job);
  if (job.id !== options.requestId) throw invalid();
  options.onAccepted?.(job);
  try {
    return await waitForSourceJob(options, job);
  } catch (error) {
    // The paid job already exists. A failed poll must not discard its recovery ID.
    error.accepted = true;
    throw error;
  }
}

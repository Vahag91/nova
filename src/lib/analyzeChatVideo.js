import { v4 as uuid } from 'uuid';
import { analyzeSource, cancelSourceJob } from '../api/analyzeSource';
import { ensureDeviceId } from './deviceId';
import { ensureWorkspaceKey } from './workspaceIdentity';
import { validateWorkspaceRecord } from './workspaceContract';
import { useWorkspaceJobs } from '../state/useWorkspaceJobs';
import { useWorkspaceStore } from '../state/useWorkspaceStore';

export async function analyzeChatVideo({ source, signal, privateMode = false, onProgress, onAccepted }) {
  const deviceId = await ensureDeviceId();
  const workspaceKey = await ensureWorkspaceKey();
  if (signal?.aborted) throw Object.assign(new Error(), { code: 'ABORTED' });
  const pending = { id: uuid(), type: source.type, createdAt: Date.now(), sourceLabel: source.file?.name || source.url, url: source.url || null, documents: [] };
  const options = { deviceId, workspaceKey, requestId: pending.id };
  if (!privateMode) await useWorkspaceJobs.getState().save(pending);
  try {
    const result = await analyzeSource({ ...options, source, signal, onProgress, onAccepted });
    if (signal?.aborted) throw Object.assign(new Error(), { code: 'ABORTED' });
    const record = validateWorkspaceRecord({ ...pending, result, documents: result.sourceDocuments || [] });
    let saveFailed = false;
    if (!privateMode) {
      try {
        await useWorkspaceStore.getState().save(record);
        await useWorkspaceJobs.getState().remove(pending.id);
      } catch { saveFailed = true; }
    }
    return { record, saveFailed };
  } catch (error) {
    if (signal?.aborted) {
      // The server owns cancellation; aborting the HTTP poll alone does not stop billing.
      try {
        await cancelSourceJob(options);
        if (!privateMode) await useWorkspaceJobs.getState().remove(pending.id);
      } catch { /* A persisted job remains recoverable from the video workspace. */ }
    } else if (!privateMode && (error.terminal || (!error.accepted && (
      ['NOT_CONFIGURED', 'VIDEO_NOT_CONFIGURED', 'WORKSPACE_KEY_REQUIRED', 'REQUEST_ID_REQUIRED'].includes(error.code) ||
      (error.status >= 400 && error.status < 500 && error.status !== 408)
    )))) {
      await useWorkspaceJobs.getState().remove(pending.id).catch(() => {});
    }
    throw error;
  }
}

// Questions use the same authenticated, quota-controlled job path but do not
// create another saved summary or duplicate the uploaded video.
export async function askSourceQuestion({ source, signal, requestId = uuid(), onRequestReady }) {
  const deviceId = await ensureDeviceId();
  const workspaceKey = await ensureWorkspaceKey();
  const options = { deviceId, workspaceKey, requestId };
  if (signal?.aborted) throw Object.assign(new Error(), { code: 'ABORTED' });
  onRequestReady?.({ requestId, source });
  try { return await analyzeSource({ ...options, source, signal }); }
  catch (error) {
    if (signal?.aborted) await cancelSourceJob(options).catch(() => {});
    throw error;
  }
}

export const askVideoQuestion = askSourceQuestion;

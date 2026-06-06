import { Platform } from 'react-native';
import { APP_VERSION } from '../config/appInfo';
import { ensureDeviceId } from '../lib/deviceId';
import { createSbWithDevice } from '../lib/supabaseDevice';

export const AI_REPORT_CONTENT_TYPES = [
  'chat_response',
  'generated_image',
  'edited_image',
];

export const AI_REPORT_REASONS = [
  'sexual',
  'violence_self_harm',
  'hate_harassment',
  'child_safety',
  'scam_deceptive',
  'other',
];

const SOURCE_SCREENS = ['chat', 'create_image_generating', 'image_viewer'];
const SUBMISSION_ERROR = 'Could not submit report. Please try again.';

function validationError(message) {
  const error = new Error(message);
  error.code = 'report_validation_failed';
  return error;
}

function optionalText(value, maxLength) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function imageUrl(value) {
  const trimmed = optionalText(value, 2048);
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return undefined;
  return trimmed;
}

function imageStoragePath(value) {
  const trimmed = optionalText(value, 1024);
  if (!trimmed || /^(data:|file:)/i.test(trimmed)) return undefined;
  return trimmed;
}

function metadataObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  try {
    return JSON.stringify(value).length <= 6000 ? value : {};
  } catch {
    return {};
  }
}

function addOptional(row, key, value) {
  if (value !== undefined) row[key] = value;
}

export function buildAiContentReportPayload(payload = {}, deviceId) {
  if (!AI_REPORT_CONTENT_TYPES.includes(payload.content_type)) {
    throw validationError('Unsupported report content type.');
  }
  if (!AI_REPORT_REASONS.includes(payload.reason)) {
    throw validationError('Please choose a report reason.');
  }

  const normalizedDeviceId = optionalText(deviceId, 256);
  if (!normalizedDeviceId) {
    throw validationError('Device unavailable. Please restart the app.');
  }
  if (payload.source_screen && !SOURCE_SCREENS.includes(payload.source_screen)) {
    throw validationError('Unsupported report source.');
  }

  const row = {
    content_type: payload.content_type,
    device_id: normalizedDeviceId,
    reason: payload.reason,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    metadata: metadataObject(payload.metadata),
  };

  addOptional(row, 'content_id', optionalText(payload.content_id, 256));
  addOptional(row, 'details', optionalText(payload.details, 2000));
  addOptional(row, 'prompt', optionalText(payload.prompt, 16000));
  addOptional(row, 'output_text', optionalText(payload.output_text, 32000));
  addOptional(row, 'image_url', imageUrl(payload.image_url));
  addOptional(row, 'image_storage_path', imageStoragePath(payload.image_storage_path));
  addOptional(row, 'model', optionalText(payload.model, 128));
  addOptional(row, 'source_screen', optionalText(payload.source_screen, 64));
  addOptional(row, 'app_version', optionalText(payload.app_version || APP_VERSION, 64));

  return row;
}

export async function submitAiContentReport(payload) {
  try {
    const deviceId = await ensureDeviceId();
    const row = buildAiContentReportPayload(payload, deviceId);
    const sb = createSbWithDevice(deviceId);
    const { error } = await sb.from('ai_content_reports').insert([row]);

    if (error) throw error;

    return { submitted: true };
  } catch (error) {
    if (error?.code === 'report_validation_failed') throw error;
    const submissionError = new Error(SUBMISSION_ERROR);
    submissionError.code = 'report_submission_failed';
    throw submissionError;
  }
}

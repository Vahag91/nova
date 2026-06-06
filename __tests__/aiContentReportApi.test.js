jest.mock('../src/lib/deviceId', () => ({
  ensureDeviceId: jest.fn(),
}));

jest.mock('../src/lib/supabaseDevice', () => ({
  createSbWithDevice: jest.fn(),
}));

import fs from 'fs';
import path from 'path';
import { Platform } from 'react-native';
import { ensureDeviceId } from '../src/lib/deviceId';
import { createSbWithDevice } from '../src/lib/supabaseDevice';
import { APP_VERSION } from '../src/config/appInfo';
import {
  AI_REPORT_CONTENT_TYPES,
  AI_REPORT_REASONS,
  buildAiContentReportPayload,
  submitAiContentReport,
} from '../src/api/reportContent';

describe('AI content report client API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
  });

  test('accepts only supported report types and reasons', () => {
    expect(AI_REPORT_CONTENT_TYPES).toEqual([
      'chat_response',
      'generated_image',
      'edited_image',
    ]);
    expect(AI_REPORT_REASONS).toEqual([
      'sexual',
      'violence_self_harm',
      'hate_harassment',
      'child_safety',
      'scam_deceptive',
      'other',
    ]);

    expect(() =>
      buildAiContentReportPayload({
        content_type: 'unknown',
        reason: 'sexual',
      }),
    ).toThrow('Unsupported report content type.');

    expect(() =>
      buildAiContentReportPayload({
        content_type: 'chat_response',
        reason: 'unknown',
      }),
    ).toThrow('Please choose a report reason.');
  });

  test('normalizes evidence without storing device media data', () => {
    const row = buildAiContentReportPayload({
      content_type: 'edited_image',
      content_id: ' image-1 ',
      reason: 'other',
      details: `  ${'d'.repeat(2100)} `,
      prompt: '  improve this ',
      image_url: 'file:///private/generated.jpg',
      image_storage_path: ' data:image/jpeg;base64,abc ',
      model: ' google:4@1 ',
      source_screen: 'image_viewer',
      metadata: { mode: 'img2img' },
    }, 'device-1');

    expect(row).toMatchObject({
      content_type: 'edited_image',
      content_id: 'image-1',
      device_id: 'device-1',
      reason: 'other',
      prompt: 'improve this',
      model: 'google:4@1',
      source_screen: 'image_viewer',
      platform: 'android',
      metadata: { mode: 'img2img' },
    });
    expect(row.details).toHaveLength(2000);
    expect(row.image_url).toBeUndefined();
    expect(row.image_storage_path).toBeUndefined();
    expect(row.user_id).toBeUndefined();
  });

  test('stores the current Android application version in reports', () => {
    const androidBuild = fs.readFileSync(
      path.resolve(__dirname, '../android/app/build.gradle'),
      'utf8',
    );
    const androidVersionName = androidBuild.match(/versionName\s+"([^"]+)"/)?.[1];
    const row = buildAiContentReportPayload({
      content_type: 'chat_response',
      reason: 'other',
    }, 'device-1');

    expect(androidVersionName).toBeTruthy();
    expect(APP_VERSION).toBe(androidVersionName);
    expect(row.app_version).toBe(androidVersionName);
  });

  test('inserts a report without reading moderation rows back to the client', async () => {
    ensureDeviceId.mockResolvedValue('device-123');
    const insert = jest.fn().mockResolvedValue({ error: null });
    const from = jest.fn().mockReturnValue({ insert });
    createSbWithDevice.mockReturnValue({ from });

    const result = await submitAiContentReport({
      content_type: 'chat_response',
      content_id: 'msg_123',
      reason: 'hate_harassment',
      output_text: 'reported assistant output',
      source_screen: 'chat',
    });

    expect(createSbWithDevice).toHaveBeenCalledWith('device-123');
    expect(from).toHaveBeenCalledWith('ai_content_reports');
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        content_type: 'chat_response',
        content_id: 'msg_123',
        reason: 'hate_harassment',
        output_text: 'reported assistant output',
        device_id: 'device-123',
      }),
    ]);
    expect(result).toEqual({ submitted: true });
  });

  test('presents a stable failure when Supabase rejects a report', async () => {
    ensureDeviceId.mockResolvedValue('device-123');
    createSbWithDevice.mockReturnValue({
      from: () => ({
        insert: jest.fn().mockResolvedValue({ error: { message: 'denied' } }),
      }),
    });

    await expect(
      submitAiContentReport({
        content_type: 'chat_response',
        reason: 'sexual',
      }),
    ).rejects.toThrow('Could not submit report. Please try again.');
  });
});

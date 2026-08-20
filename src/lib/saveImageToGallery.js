// src/lib/saveImageToGallery.js
import { Platform, PermissionsAndroid } from 'react-native';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { toLocalPath } from './imageDownloader';

// Adding an image to the gallery via MediaStore needs no runtime permission on
// Android 10+ (API 29+). Only legacy devices (API <= 28) require
// WRITE_EXTERNAL_STORAGE, which is declared scoped to maxSdkVersion="28".
async function ensureAndroidWritePermission() {
  if (Platform.OS !== 'android') return true;
  const apiLevel =
    typeof Platform.Version === 'number'
      ? Platform.Version
      : parseInt(Platform.Version, 10);
  if (!Number.isFinite(apiLevel) || apiLevel >= 29) return true;
  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/**
 * Saves a generated/edited image into the device gallery (camera roll).
 * Accepts data:, http(s):, or file:// sources — remote/data URIs are
 * downloaded/written to a local cache file first.
 *
 * @param {string} source Image URI to save.
 * @param {{ album?: string }} [options]
 * @returns {Promise<{ ok: boolean, reason?: 'no-source' | 'permission-denied' | 'no-file' | 'save-failed' }>}
 */
export async function saveImageToGallery(source, options = {}) {
  if (!source) return { ok: false, reason: 'no-source' };

  const hasPermission = await ensureAndroidWritePermission();
  if (!hasPermission) return { ok: false, reason: 'permission-denied' };

  // CameraRoll needs a local file path; resolve remote/data URIs to a file first.
  const local = await toLocalPath(source);
  if (!local) return { ok: false, reason: 'no-file' };

  try {
    await CameraRoll.saveAsset(local, { type: 'photo', album: options.album });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'save-failed' };
  }
}

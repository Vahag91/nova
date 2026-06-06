import RNFS from 'react-native-fs';

// Ensure cache directory exists
const ensureCacheDir = async () => {
  try {
    const exists = await RNFS.exists(RNFS.CachesDirectoryPath);
    if (!exists) {
      await RNFS.mkdir(RNFS.CachesDirectoryPath);
    }
  } catch (error) {
  }
};

// Safer URL normalizer for image URIs
const isHttp = (u = '') => /^https?:\/\//i.test(u);
const isDataUri = (u = '') => /^data:image\/[a-zA-Z]+;base64,/i.test(u);
const isFileOrBlob = (u = '') => u.startsWith('file://') || u.startsWith('blob:');
const IMAGE_SIGNATURE_PREFIXES = [
  '/9j/', // jpeg
  'iVBORw0KGgo', // png
  'R0lGOD', // gif
  'UklGR', // webp / riff
  'Qk', // bmp
  'AAAAFGZ0eX',
  'AAAAGGZ0eX',
  'AAAAHGZ0eX',
  'AAAAIGZ0eX', // heic/heif variants
];

const isProbablyBase64 = (s = '') => {
  const t = s.trim();
  if (t.length < 16) return false;
  if (t.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(t);
};

function getHeaderValue(headers = {}, name = '') {
  if (!headers || !name) {
    return '';
  }

  const match = Object.keys(headers).find(
    key => key.toLowerCase() === name.toLowerCase(),
  );
  const value = match ? headers[match] : '';
  return typeof value === 'string' ? value : String(value || '');
}

function createInvalidImageResponseError(message) {
  const error = new Error(message);
  error.code = 'invalid_image_response';
  return error;
}

function looksLikeHtmlResponse(text = '') {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized.startsWith('<!doctype html') ||
    normalized.startsWith('<html') ||
    normalized.startsWith('<?xml') ||
    normalized.includes('<head') ||
    normalized.includes('<body') ||
    normalized.includes('<title>temporarily unavailable') ||
    normalized.includes('| cloudflare') ||
    normalized.includes('cf-error')
  );
}

function looksLikeImageSignature(base64Chunk = '') {
  return IMAGE_SIGNATURE_PREFIXES.some(prefix => base64Chunk.startsWith(prefix));
}

async function validateCachedFile(dest, contentType = '') {
  const stat = await RNFS.stat(dest);
  if (!(Number(stat?.size) > 0)) {
    throw createInvalidImageResponseError('Downloaded file is empty.');
  }

  if (contentType && !/^image\//i.test(contentType)) {
    throw createInvalidImageResponseError(
      `Expected an image but received ${contentType}.`,
    );
  }

  const headText = await RNFS.read(dest, 512, 0, 'utf8').catch(() => '');
  if (looksLikeHtmlResponse(headText)) {
    throw createInvalidImageResponseError(
      'Expected an image but received an HTML error page.',
    );
  }

  if (!contentType) {
    const headBase64 = await RNFS.read(dest, 24, 0, 'base64').catch(() => '');
    if (headBase64 && !looksLikeImageSignature(headBase64)) {
      throw createInvalidImageResponseError(
        'Downloaded file does not look like a supported image.',
      );
    }
  }
}

export function normalizeImageUri(url) {
  if (!url) return '';
  if (isHttp(url) || isDataUri(url) || isFileOrBlob(url)) return url;
  if (isProbablyBase64(url)) return `data:image/png;base64,${url.trim()}`;
  // Unknown scheme/relative path → let caller decide to skip or transform
  return '';
}

// Cache remote URLs to file:// when they arrive
export async function cacheToFile(url) {
  try {
    if (!/^https?:\/\//i.test(url)) return url; // already local/data
    
    // Ensure cache directory exists
    await ensureCacheDir();
    
    // Create a safe filename from URL
    const urlPath = new URL(url).pathname;
    const urlHash = url.split('').reduce((acc, char) => {
      const next = (acc * 33) + char.charCodeAt(0);
      return next % 2147483647;
    }, 5381);
    
    // Extract extension from URL or default to jpg
    let ext = 'jpg';
    if (urlPath.includes('.png')) ext = 'png';
    else if (urlPath.includes('.webp')) ext = 'webp';
    else if (urlPath.includes('.gif')) ext = 'gif';
    
    // Create safe filename with timestamp and hash
    const timestamp = Date.now();
    const safeName = `img_${timestamp}_${Math.abs(urlHash)}.${ext}`;
    const dest = `${RNFS.CachesDirectoryPath}/${safeName}`;
    
    // Check if file already exists and is valid
    const exists = await RNFS.exists(dest);
    if (exists) {
      try {
        await validateCachedFile(dest);
        return `file://${dest}`;
      } catch {
        await RNFS.unlink(dest);
      }
    }

    let responseHeaders = {};

    // Download the file
    const downloadResult = await RNFS.downloadFile({
      fromUrl: url,
      toFile: dest,
      begin: (res) => {
        responseHeaders = res?.headers || {};
      },
    }).promise;

    if (downloadResult.statusCode === 200) {
      const contentType = getHeaderValue(responseHeaders, 'content-type');
      try {
        await validateCachedFile(dest, contentType);
      } catch (error) {
        await RNFS.unlink(dest).catch(() => {});
        throw error;
      }

      return `file://${dest}`;
    }

    await RNFS.unlink(dest).catch(() => {});
    throw createInvalidImageResponseError(
      `Image download failed with status ${downloadResult.statusCode}.`,
    );
  } catch (error) {
    if (error?.code === 'invalid_image_response') {
      throw error;
    }

    return url; // fallback
  }
}

// Clean up corrupted cache files
export async function cleanupCorruptedCache() {
  try {
    const files = await RNFS.readDir(RNFS.CachesDirectoryPath);
    let cleanedCount = 0;
    
    for (const file of files) {
      if (file.name.startsWith('img_') && file.name.includes('%')) {
        await RNFS.unlink(file.path);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  } catch (error) {
    return 0;
  }
}

// Clear all cached images
export async function clearImageCache() {
  try {
    const files = await RNFS.readDir(RNFS.CachesDirectoryPath);
    let clearedCount = 0;
    
    for (const file of files) {
      if (file.name.startsWith('img_')) {
        await RNFS.unlink(file.path);
        clearedCount++;
      }
    }
    
    return clearedCount;
  } catch (error) {
    return 0;
  }
}

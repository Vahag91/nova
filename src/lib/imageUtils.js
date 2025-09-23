import RNFS from 'react-native-fs';

// Ensure cache directory exists
const ensureCacheDir = async () => {
  try {
    const exists = await RNFS.exists(RNFS.CachesDirectoryPath);
    if (!exists) {
      await RNFS.mkdir(RNFS.CachesDirectoryPath);
    }
  } catch (error) {
    console.warn('Failed to ensure cache directory:', error);
  }
};

// Safer URL normalizer for image URIs
const isHttp = (u = '') => /^https?:\/\//i.test(u);
const isDataUri = (u = '') => /^data:image\/[a-zA-Z]+;base64,/i.test(u);
const isFileOrBlob = (u = '') => u.startsWith('file://') || u.startsWith('blob:');
const isProbablyBase64 = (s = '') => {
  const t = s.trim();
  if (t.length < 16) return false;
  if (t.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(t);
};

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
    const urlHash = url.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
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
      // Verify the file is not corrupted by checking its size
      const stat = await RNFS.stat(dest);
      if (stat.size > 0) {
        return `file://${dest}`;
      } else {
        // File exists but is empty/corrupted, remove it
        await RNFS.unlink(dest);
      }
    }
    
    // Download the file
    const downloadResult = await RNFS.downloadFile({
      fromUrl: url,
      toFile: dest,
    }).promise;
    
    if (downloadResult.statusCode === 200) {
      return `file://${dest}`;
    } else {
      return url; // fallback to original URL
    }
  } catch (error) {
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

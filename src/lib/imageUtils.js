import RNFS from 'react-native-fs';

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
    const name = encodeURIComponent(url.split('?')[0]).slice(-64); // stable-ish
    const ext = url.includes('.png') ? 'png' : url.includes('.webp') ? 'webp' : 'jpg';
    const dest = `${RNFS.CachesDirectoryPath}/img_${name}.${ext}`;
    
    // Check if file already exists
    const exists = await RNFS.exists(dest);
    if (exists) {
      return `file://${dest}`;
    }
    
    // Download the file
    const downloadResult = await RNFS.downloadFile({
      fromUrl: url,
      toFile: dest,
    }).promise;
    
    if (downloadResult.statusCode === 200) {
      return `file://${dest}`;
    } else {
      console.warn('🔄 [CACHE] Download failed:', downloadResult.statusCode);
      return url; // fallback to original URL
    }
  } catch (error) {
    console.warn('🔄 [CACHE] Cache error:', error?.message);
    return url; // fallback
  }
}

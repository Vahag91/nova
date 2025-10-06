// app/src/lib/imageDownloader.js
import RNFS from 'react-native-fs';

const CACHE_DIR = RNFS.CachesDirectoryPath;

function extFromMeta(meta) {
  const m = /image\/(\w+)/.exec(meta || '');
  return m?.[1] || 'png';
}

export async function toLocalPath(source) {
  if (!source) {
    return '';
  }
  
  try {
    // data URI → write to file
    if (source.startsWith('data:image/')) {
      const [meta, b64] = source.split(',');
      if (!b64) {
        return source;
      }
      const ext = extFromMeta(meta);
      const path = `${CACHE_DIR}/img_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      await RNFS.writeFile(path, b64, 'base64');
      return `file://${path}`;
    }
    
    // http(s) → download (lazy download - call this when user opens image)
    if (/^https?:\/\//i.test(source)) {
      const path = `${CACHE_DIR}/img_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      const result = await RNFS.downloadFile({ fromUrl: source, toFile: path }).promise;
      if (result.statusCode === 200) {
        return `file://${path}`;
      } else {
        return source;
      }
    }
    
    // already file://
    return source;
  } catch (error) {
    return source; // fallback to original
  }
}

export async function deleteLocalFile(filePath) {
  if (!filePath || !filePath.startsWith('file://')) return;
  
  try {
    const localPath = filePath.replace('file://', '');
    await RNFS.unlink(localPath);
  } catch (error) {
  }
}

export async function cleanupOldImages(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7 days
  try {
    const files = await RNFS.readDir(CACHE_DIR);
    const now = Date.now();
    
    for (const file of files) {
      if (file.name.startsWith('img_') && (now - file.mtime.getTime()) > maxAge) {
        await RNFS.unlink(file.path);
      }
    }
  } catch (error) {
  }
}

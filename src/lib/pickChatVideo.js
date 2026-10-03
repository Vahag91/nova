import { pick, keepLocalCopy, types } from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import { v4 as uuid } from 'uuid';
import { MAX_VIDEO_BYTES } from './workspace';
import { sanitizeDocumentName } from './documentAttachments';

export async function pickChatVideo() {
  const [file] = await pick({ type: [types.video], allowMultiSelection: false, allowVirtualFiles: false, mode: 'import' });
  if (!file) return null;
  if (!/\.(mp4|webm)$/i.test(file.name || '')) throw Object.assign(new Error(), { code: 'INVALID_VIDEO' });
  if (file.size > MAX_VIDEO_BYTES) throw Object.assign(new Error(), { code: 'FILE_TOO_LARGE' });
  const id = uuid(), name = sanitizeDocumentName(file.name);
  const [copy] = await keepLocalCopy({ destination: 'cachesDirectory', files: [{ uri: file.uri, fileName: `video-${id}-${name}` }] });
  if (copy?.status !== 'success') throw Object.assign(new Error(), { code: 'INVALID_VIDEO' });
  try {
    const size = Number((await RNFS.stat(decodeURIComponent(copy.localUri.replace(/^file:\/\//, '')))).size);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_VIDEO_BYTES) throw Object.assign(new Error(), { code: 'FILE_TOO_LARGE' });
    return { id, name, size, uri: copy.localUri, kind: 'video', status: 'selected', mimeType: /\.webm$/i.test(name) ? 'video/webm' : 'video/mp4' };
  } catch (error) {
    await RNFS.unlink(decodeURIComponent(copy.localUri.replace(/^file:\/\//, ''))).catch(() => {});
    throw error;
  }
}

import { normalizeYouTubeUrl } from './workspace';

// A video source is handled by source-analyze, never sent as an unwatched URL to a text model.
export function getChatVideoSource(text = '', attachments = []) {
  const files = attachments.filter(a => a.kind === 'video');
  const links = [...new Set((text.match(/https?:\/\/[^\s<>]+/gi) || [])
    .map(value => normalizeYouTubeUrl(value.replace(/[),.!?\]"']+$/, ''))).filter(Boolean))];
  if (!files.length && !links.length) return null;
  if (files.length + links.length > 1) throw Object.assign(new Error(), { code: 'ONE_VIDEO' });
  if (attachments.some(a => a.kind !== 'video')) throw Object.assign(new Error(), { code: 'VIDEO_MIXED_SOURCES' });
  if (text.length > 4000) throw Object.assign(new Error(), { code: 'VIDEO_QUESTION_TOO_LONG' });
  return { type: files.length ? 'upload' : 'youtube', ...(files.length ? { file: files[0] } : { url: links[0] }), question: text, detail: 'detailed' };
}

export function asksForVideoWithoutSource(text) {
  return /(?:summari[sz]e|summary|analyse|analyze|обобщ|суммари|кратк|ամփոփ).{0,70}(?:video|youtube|видео|տեսանյութ)|(?:video|youtube|видео|տեսանյութ).{0,70}(?:summary|summari[sz]|ամփոփ)/i.test(text);
}

export const videoErrors = {
  ONE_VIDEO: 'Choose one video or paste one YouTube link at a time.',
  VIDEO_MIXED_SOURCES: 'Send the video separately from images and documents.',
  VIDEO_QUESTION_TOO_LONG: 'Keep your video question under 4,000 characters.',
  INVALID_VIDEO: 'Choose an MP4 or WebM video.',
  FILE_TOO_LARGE: 'This video file is too large. Choose a smaller file.',
  SOURCE_UNAVAILABLE: 'We could not access this video. Try a public YouTube video or upload an MP4 or WebM file.',
  INVALID_RESULT: 'The video analysis was incomplete. Please try again.',
  NETWORK: 'Connection interrupted. Check Video summaries for the result before trying again.',
  TIMEOUT: 'The video took too long to analyze. Try a shorter clip.',
  JOB_PENDING: 'Your video is still processing. Open Video summaries to check its progress.',
  DAILY_LIMIT: 'You have reached today’s video and document analysis limit. Please try again tomorrow.',
  ALREADY_PROCESSING: 'An analysis is already running. Open Video summaries to check its progress.',
  SERVICE_BUSY: 'Video analysis is busy. Please try again shortly.',
  PROVIDER_UNAVAILABLE: 'Video analysis is temporarily unavailable. Please try again shortly.',
  NOT_CONFIGURED: 'Video analysis is temporarily unavailable. Please try again later.',
  VIDEO_NOT_CONFIGURED: 'Video analysis is temporarily unavailable. Please try again later.',
  SAVE_FAILED: 'Your summary is ready, but could not be saved to your library. Keep this chat or copy the summary.',
};

export function videoQuestionSource(thread, question) {
  if (!question?.trim()) return null;
  const messages = thread?.messages || [];
  const latest = [...messages].reverse().find(m => m.meta?.videoSource || (m.meta?.videoSummary && !m.meta?.videoQuestion));
  const reference = latest ? latest.meta.videoSource : thread?.meta?.workspaceVideoSource;
  if (!reference) {
    if (latest || ['upload', 'youtube'].includes(thread?.meta?.workspaceType)) throw Object.assign(new Error(), { code: 'VIDEO_SOURCE_EXPIRED' });
    return null;
  }
  if (question.length > 4000) throw Object.assign(new Error(), { code: 'VIDEO_QUESTION_TOO_LONG' });
  if (Date.parse(reference.expiresAt) <= Date.now()) throw Object.assign(new Error(), { code: 'VIDEO_SOURCE_EXPIRED' });
  return { type: reference.type, sourceJobId: reference.jobId, question, detail: 'concise', conversation: messages.filter(m => ['user', 'assistant'].includes(m.role)).slice(-6).map(m => ({ role: m.role, content: String(m.content || '').slice(0, 2000) })) };
}

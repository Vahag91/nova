// app/src/api/generateImage.js
import { CHAT_PROXY_URL, SUPABASE_ANON_KEY } from '../config/endpoints';
import { SSEClient } from '../lib/SSEClient';

export function generateImage({ prompt, size = '1024x1024', deviceId, onImage, onDone, onError, signal }) {
  const headers = {
    'Content-Type': 'application/json',
    'x-client-id': deviceId,
    'x-app-version': '1.0.0',
  };
  if (__DEV__ && SUPABASE_ANON_KEY) headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;

  const client = new SSEClient(CHAT_PROXY_URL, {
    method: 'POST',
    headers,
    body: { model: 'gpt-image-1', prompt, size },
    onEvent: (evt) => {
      if (evt?.type === 'image' && evt.url) { onImage?.(evt.url); return; }
      if (evt?.type === 'done') { onDone?.(); return; }
      if (evt?.type === 'error') { onError?.(evt); return; }
    },
    onError: (e) => onError?.(e),
    onClose: () => onDone?.(),
  });

  client.start();
  if (signal) (signal.aborted ? client.abort() : signal.addEventListener('abort', () => client.abort(), { once: true }));
  return client;
}

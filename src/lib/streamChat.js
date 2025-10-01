// app/src/api/streamChat.js
import { CHAT_PROXY_URL } from '../config/endpoints';
import { readSSE } from '../lib/sse';

// Small helper: does any message contain an image_url part?
function payloadHasImages(messages) {
  try {
    return messages?.some(m =>
      Array.isArray(m?.content) &&
      m.content.some(p => p?.type === 'image_url' && p?.image_url?.url)
    );
  } catch {
    return false;
  }
}

// streamChat sends messages to chat-proxy and emits typed events.
// onToken: (chunk) -> void
// onDone: () => void
// onError: (errEnvelope) -> void
export async function streamChat({
  model,
  messages,
  deviceId,
  temperature = 0.7,
  signal,
  onToken,
  onDone,
  onError,
  // Optional override if you ever want to force it:
  supportsImages: supportsImagesOverride,
}) {
  // Auto-detect image usage unless caller overrides it
  const supportsImages =
    typeof supportsImagesOverride === 'boolean'
      ? supportsImagesOverride
      : payloadHasImages(messages);

  let res;
  try {
    res = await fetch(CHAT_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': deviceId,
        'x-app-version': '1.0.0',
      },
      body: JSON.stringify({
        model,
        temperature,
        thread_id: messages?.length ? 'thread-local' : undefined,
        // Pass the content as-is; it may be an array of {type:'text'|'image_url', ...}
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        tools: [],
        capabilities: {
          supportsImages,
          supportsAudio: false,
          supportsVideo: false,
        },
      }),
      signal,
    });
  } catch (err) {
    onError?.({ type: 'error', code: 'NETWORK', message: String(err?.message || err) });
    return;
  }

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    onError?.({ type: 'error', code: 'HTTP_ERROR', message: text || `HTTP ${res.status}` });
    return;
  }

  await readSSE(res.body, (evt) => {
    if (evt.type === 'token') {
      const delta = evt.delta || '';
      onToken?.(delta);
    } else if (evt.type === 'done') {
      onDone?.();
    } else if (evt.type === 'error') {
      onError?.(evt);
    }
  });
}

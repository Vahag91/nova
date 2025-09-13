import { CHAT_PROXY_URL } from '../config/endpoints';
import { readSSE } from '../lib/sse';

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
}) {
  const res = await fetch(CHAT_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-client-id': deviceId,
      'x-app-version': '1.0.0',
    },
    body: JSON.stringify({
      model,
      temperature,
      thread_id: messages?.length ? 'thread-local' : undefined, // optional tag for logs
      messages: messages.map(m => ({ role: m.role, content: m.content })), // keep it simple in v1
      tools: [],
      capabilities: { supportsImages: false, supportsAudio: false, supportsVideo: false },
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    onError?.({ type: 'error', code: 'HTTP_ERROR', message: text || `HTTP ${res.status}` });
    return;
  }

  await readSSE(res.body, (evt) => {
    if (evt.type === 'token') onToken?.(evt.delta || '');
    else if (evt.type === 'done') onDone?.();
    else if (evt.type === 'error') onError?.(evt);
    // message_metadata can be handled later
  });
}

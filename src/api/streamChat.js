// app/src/api/streamChat.js
import { CHAT_PROXY_URL, SUPABASE_ANON_KEY } from '../config/endpoints';
import { SSEClient } from '../lib/SSEClient';

export function streamChat({
  model,
  messages,
  deviceId,
  onToken,
  onDone,
  onError,
  signal,
  secretMode = false,
}) {
  const headers = {
    'Content-Type': 'application/json',
    'x-client-id': deviceId,
    'x-app-version': '1.0.0',
    ...(secretMode ? { 'x-secret-mode': '1' } : {}),
  };
  if (__DEV__ && SUPABASE_ANON_KEY) {
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  // Keep using the app's chat-style message shape; the proxy converts to Responses `input`.
  const outMessages = messages.map((m) => {
    if (Array.isArray(m.content)) return { role: m.role, content: m.content };

    // Optional convenience: when message has imageUrls[], convert to multimodal parts
    if (Array.isArray(m.imageUrls) && m.imageUrls.length) {
      const parts = [];
      if (m.content) parts.push({ type: 'text', text: m.content }); // proxy remaps -> input_text
      for (const url of m.imageUrls) parts.push({ type: 'image_url', image_url: { url } }); // -> input_image
      return { role: m.role, content: parts };
    }

    return { role: m.role, content: m.content ?? '' };
  });

  let doneCalled = false;
  const safeOnDone = () => { if (!doneCalled) { doneCalled = true; onDone?.(); } };

  const client = new SSEClient(CHAT_PROXY_URL, {
    method: 'POST',
    headers,
    body: {
      model,
      messages: outMessages,
      tools: [],
      capabilities: { supportsImages: true, supportsAudio: false, supportsVideo: false },
      // NOTE: no temperature anywhere
    },
    onEvent: (evt) => {
      // Proxy-normalized events
      if (evt?.type === 'token' && typeof evt.delta === 'string') { onToken?.(evt.delta); return; }
      if (evt?.type === 'done') { safeOnDone(); return; }
      if (evt?.type === 'error') { onError?.(evt); return; }

      // Extra fallbacks (if proxy ever passes raw OpenAI events)
      const maybe = evt?.output_text_delta || evt?.delta;
      if (typeof maybe === 'string') { onToken?.(maybe); return; }
      const cc = evt?.choices?.[0]?.delta?.content; // old Chat Completions fallback
      if (typeof cc === 'string') onToken?.(cc);
    },
    onOpen: () => {},
    onError: (e) => onError?.(e),
    onClose: () => safeOnDone(),
    retryDelays: [1500, 3000, 5000],
    heartbeatInterval: 15000,
    timeoutMs: 60000,
    inactivityTimeoutMs: 30000,
    log: false,
  });

  client.start();

  if (signal) {
    if (signal.aborted) client.abort();
    else signal.addEventListener('abort', () => client.abort(), { once: true });
  }

  return client;
}

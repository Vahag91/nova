// app/src/api/streamChat.js
import { CHAT_PROXY_URL, SUPABASE_ANON_KEY } from '../config/endpoints';
import { SSEClient } from '../lib/SSEClient';

export function streamChat({
  model, messages, deviceId, temperature = 0.7,
  onToken, onDone, onError, signal,
  secretMode = false, // NEW: header hint for the proxy
}) {
  // Build headers (add anon key only for local dev serve)
  const headers = {
    'Content-Type': 'application/json',
    'x-client-id': deviceId,
    'x-app-version': '1.0.0',
    ...(secretMode ? { 'x-secret-mode': '1' } : {}),
  };
  if (__DEV__ && SUPABASE_ANON_KEY) {
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  // Map to OpenAI format
  const outMessages = messages.map((m) => {
    // if already an array (vision parts), pass through
    if (Array.isArray(m.content)) return { role: m.role, content: m.content };

    // if you add your own 'imageUrls' field to messages:
    if (Array.isArray(m.imageUrls) && m.imageUrls.length) {
      const parts = [];
      if (m.content) parts.push({ type: 'text', text: m.content });
      for (const url of m.imageUrls) parts.push({ type: 'image_url', image_url: { url } });
      return { role: m.role, content: parts };
    }

    // plain text
    return { role: m.role, content: m.content ?? '' };
  });

  // Track if onDone has been called to prevent double calls
  let doneCalled = false;
  const safeOnDone = () => {
    if (!doneCalled) {
      doneCalled = true;
      onDone?.();
    }
  };

  const client = new SSEClient(CHAT_PROXY_URL, {
    method: 'POST',
    headers,
    body: {
      model,
      temperature,
      messages: outMessages,
      tools: [],
      capabilities: { supportsImages: true, supportsAudio: false, supportsVideo: false }, // <- stop telling the model "no images"
    },
    onEvent: (evt) => {
      if (evt?.type === 'token' && typeof evt.delta === 'string') { onToken?.(evt.delta); return; }
      if (evt?.type === 'done') { safeOnDone(); return; }
      if (evt?.type === 'error') { onError?.(evt); return; }

      // Fallback for raw OpenAI passthrough
      const fallback = evt?.choices?.[0]?.delta?.content;
      if (typeof fallback === 'string') onToken?.(fallback);
    },
    onOpen: () => {},
    onError: (e) => onError?.(e),
    onClose: () => safeOnDone(), // Use safeOnDone to prevent double calls
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

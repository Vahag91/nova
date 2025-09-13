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

  const client = new SSEClient(CHAT_PROXY_URL, {
    method: 'POST',
    headers,
    body: {
      model,
      temperature,
      // Send only role & content
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      tools: [],
      capabilities: { supportsImages:false, supportsAudio:false, supportsVideo:false },
    },
    onEvent: (evt) => {
      if (evt?.type === 'token' && typeof evt.delta === 'string') { onToken?.(evt.delta); return; }
      if (evt?.type === 'done') { onDone?.(); return; }
      if (evt?.type === 'error') { onError?.(evt); return; }

      // Fallback for raw OpenAI passthrough
      const fallback = evt?.choices?.[0]?.delta?.content;
      if (typeof fallback === 'string') onToken?.(fallback);
    },
    onOpen: () => {},
    onError: (e) => onError?.(e),
    onClose: () => onDone?.(),
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

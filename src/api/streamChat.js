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

  // NEW:
  allowWebSearch = false,
  forceWebSearch = false,
  webSearchConfig = undefined,
}) {
  const startTime = Date.now();
  const performanceStart = performance.now();
  // Build headers (add anon key only for local dev)
  const headers = {
    'Content-Type': 'application/json',
    'x-client-id': deviceId,
    'x-app-version': '1.0.0',
    ...(secretMode ? { 'x-secret-mode': '1' } : {}),
  };
  if (__DEV__ && SUPABASE_ANON_KEY) {
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  // Map to OpenAI-style content parts (vision ready)
  const outMessages = messages.map((m) => {
    if (Array.isArray(m.content)) return { role: m.role, content: m.content };

    if (Array.isArray(m.imageUrls) && m.imageUrls.length) {
      const parts = [];
      if (m.content) parts.push({ type: 'text', text: m.content });
      for (const url of m.imageUrls) parts.push({ type: 'image_url', image_url: { url } });
      return { role: m.role, content: parts };
    }

    return { role: m.role, content: m.content ?? '' };
  });

  // ✅ NEW: Track stream state to prevent onDone after errors
  let doneCalled = false;
  let errorOccurred = false;
  let doneEventSeen = false;
  let closeInfo = null;

  const safeOnDone = () => {
    if (!doneCalled) {
      doneCalled = true;
      onDone?.();
    }
  };

  // ✅ NEW: Only call onDone if stream completed successfully
  const finishIfAppropriate = (source) => {
    if (errorOccurred) {
      // Never call onDone after any error
      return;
    }
    
    // Accept completion either by explicit provider event or clean HTTP close
    const okClose = closeInfo?.reason === 'complete';
    const userAborted = closeInfo?.reason === 'client_abort';
    
    if (userAborted) {
      // User canceled - don't call onDone, but don't treat as error either
      return;
    }
    
    if (doneEventSeen || okClose) {
      safeOnDone();
    }
    // else: closed without error but no done event - treat as incomplete/canceled
  };

  const body = {
    model,
    messages: outMessages,
    tools: [], // client-side placeholder (not used by proxy, safe to keep)
    capabilities: { supportsImages: true, supportsAudio: false, supportsVideo: false },
  };
  if (allowWebSearch) body.allowWebSearch = true;
  if (forceWebSearch) body.forceWebSearch = true;
  if (webSearchConfig) body.webSearchConfig = webSearchConfig;

  const client = new SSEClient(CHAT_PROXY_URL, {
    method: 'POST',
    headers,
    body,
    onEvent: (evt) => {
      if (evt?.type === 'token' && typeof evt.delta === 'string') { 
        onToken?.(evt.delta); 
        return; 
      }
      if (evt?.type === 'done') {
        // ✅ Track that provider sent done event
        doneEventSeen = true;
        finishIfAppropriate('done_event');
        return; 
      }
      if (evt?.type === 'error') {
        // ✅ Mark error occurred - prevents onDone
        errorOccurred = true;
        onError?.(evt); 
        return; 
      }

      // Optional: show tool events if you decide to surface them
      // if (evt?.type === 'tool') { /* surface "Searching..." etc. */ return; }

      // Fallbacks for raw formats
      const rtext = evt?.output_text_delta || evt?.delta;
      if (typeof rtext === 'string') { 
        onToken?.(rtext); 
        return; 
      }
      const cc = evt?.choices?.[0]?.delta?.content;
      if (typeof cc === 'string') {
        onToken?.(cc);
      }
    },
    onOpen: () => {},
    onError: (e) => {
      // ✅ Mark error occurred - prevents onDone from firing later
      errorOccurred = true;
      onError?.(e);
    },
    onClose: (info) => {
      // ✅ Store close info and finish appropriately
      closeInfo = info;
      finishIfAppropriate('close');
    },
    retryPolicy: 'none',  // ✅ CRITICAL: Disable auto-retry for chat generations
    retryDelays: [],      // ✅ Backup: empty array also prevents retries
    heartbeatInterval: 15000,
    timeoutMs: 60000,
    inactivityTimeoutMs: 30000,
    log: __DEV__ === true,  // Verbose logs only during development
  });

  client.start();

  if (signal) {
    if (signal.aborted) client.abort();
    else signal.addEventListener('abort', () => client.abort(), { once: true });
  }

  return client;
}

import { CHAT_PROXY_URL, SUPABASE_ANON_KEY } from '../config/endpoints';
import { SSEClient } from '../lib/SSEClient';

const DEFAULT_FALLBACK_MODEL = 'gpt-5-nano';
const logStream = () => {};

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
  fallbackModel = DEFAULT_FALLBACK_MODEL,
}) {

  // Build headers (add anon key only for local dev)
  const headers = {
    'Content-Type': 'application/json',
    'x-client-id': deviceId,
    'x-app-version': '1.0.0',
    ...(secretMode ? { 'x-secret-mode': '1' } : {}),
  };
  if (SUPABASE_ANON_KEY) {
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

  const body = {
    messages: outMessages,
    tools: [], // client-side placeholder (not used by proxy, safe to keep)
    capabilities: { supportsImages: true, supportsAudio: false, supportsVideo: false },
  };
  if (allowWebSearch) body.allowWebSearch = true;
  if (forceWebSearch) body.forceWebSearch = true;
  if (webSearchConfig) body.webSearchConfig = webSearchConfig;

  const canUseFallback = Boolean(fallbackModel && fallbackModel !== model);
  let doneCalled = false;
  let finished = false;
  let fallbackStarted = false;
  let tokensEmitted = false;
  let primaryError = null;
  let activeClient = null;
  let aborted = false;
  const timings = {
    start: Date.now(),
    firstTokenMs: null,
    tokens: 0,
    lastModel: null,
  };

  const safeOnDone = () => {
    if (!doneCalled) {
      doneCalled = true;
      finished = true;
      onDone?.();
    }
  };

  const stopAll = () => {
    aborted = true;
    activeClient?.abort();
  };

  const startAttempt = (modelToUse, isFallback = false) => {
    let doneEventSeen = false;
    let closeInfo = null;
    let attemptErrored = false;
    let errorHandled = false;


    const finishIfAppropriate = (source) => {
      if (finished || attemptErrored) return;
      const okClose = closeInfo?.reason === 'complete';
      const userAborted = closeInfo?.reason === 'client_abort' || aborted;

      if (userAborted) {
        return;
      }

      if (doneEventSeen || okClose) {
        safeOnDone();
      }
    };

    const forwardError = (errEnvelope, source) => {
      if (finished || errorHandled) return;
      attemptErrored = true;
      errorHandled = true;

      const enriched = {
        ...(typeof errEnvelope === 'object' ? errEnvelope : { message: String(errEnvelope) }),
        source,
        model: modelToUse,
        isFallback,
      };

      if (!tokensEmitted && !isFallback && canUseFallback && !fallbackStarted) {
        fallbackStarted = true;
        primaryError = enriched;
        logStream('attempt_failed_primary', { error: enriched, fallbackModel });
        // Abort current client before retrying to ensure clean state
        activeClient?.abort('fallback_switch');
        startAttempt(fallbackModel, true);
        return;
      }

      finished = true;
      const finalError = fallbackStarted || isFallback
        ? { ...enriched, fallbackTried: true, fallbackModel, primaryError: primaryError || enriched }
        : enriched;

      logStream('attempt_failed_final', finalError);
      onError?.(finalError);
    };

    const client = new SSEClient(CHAT_PROXY_URL, {
      method: 'POST',
      headers,
      body: { ...body, model: modelToUse },
      onEvent: (evt) => {
        if (evt?.type === 'token' && typeof evt.delta === 'string') {
          tokensEmitted = true;
          timings.tokens += 1;
          timings.lastModel = modelToUse;
          if (timings.firstTokenMs === null) {
            timings.firstTokenMs = Date.now() - timings.start;
          }
          onToken?.(evt.delta);
          return;
        }
        if (evt?.type === 'done') {
          doneEventSeen = true;
          finishIfAppropriate('done_event');
          return;
        }
        if (evt?.type === 'error') {
          forwardError(evt, 'provider_event');
          return;
        }

        const rtext = evt?.output_text_delta || evt?.delta;
        if (typeof rtext === 'string') {
          tokensEmitted = true;
          timings.tokens += 1;
          timings.lastModel = modelToUse;
          if (timings.firstTokenMs === null) {
            timings.firstTokenMs = Date.now() - timings.start;
            logStream('first_token', { model: modelToUse, latencyMs: timings.firstTokenMs });
          }
          onToken?.(rtext);
          return;
        }
        const cc = evt?.choices?.[0]?.delta?.content;
        if (typeof cc === 'string') {
          tokensEmitted = true;
          timings.tokens += 1;
          timings.lastModel = modelToUse;
          if (timings.firstTokenMs === null) {
            timings.firstTokenMs = Date.now() - timings.start;
            logStream('first_token', { model: modelToUse, latencyMs: timings.firstTokenMs });
          }
          onToken?.(cc);
        }
      },
      onOpen: () => {},
      onError: (e) => {
        forwardError(e, 'transport');
      },
      onClose: (info) => {
        closeInfo = info;
        finishIfAppropriate('close');
      },
      retryPolicy: 'none',  // Disable auto-retry; we control fallback manually
      retryDelays: [],
      heartbeatInterval: 15000,
      timeoutMs: 60000,
      inactivityTimeoutMs: 30000,
      log: __DEV__ === true,
    });

    activeClient = client;
    client.start();
    return client;
  };

  const controller = {
    abort: stopAll,
  };

  startAttempt(model, false);

  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return controller;
}

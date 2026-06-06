// app/src/api/streamChat.js
import { CHAT_PROXY_URL } from '../config/endpoints';
import { readSSE } from '../lib/sse';

const DEFAULT_FALLBACK_MODEL = 'gpt-5.4-nano';
const logStream = (...args) => {
  // Logging disabled for production
};

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
  fallbackModel = DEFAULT_FALLBACK_MODEL,
  // Optional override if you ever want to force it:
  supportsImages: supportsImagesOverride,
}) {
  // Auto-detect image usage unless caller overrides it
  const supportsImages =
    typeof supportsImagesOverride === 'boolean'
      ? supportsImagesOverride
      : payloadHasImages(messages);

  logStream('Starting stream', { model, fallbackModel, supportsImages });

  const basePayload = {
    temperature,
    thread_id: messages?.length ? 'thread-local' : undefined,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    tools: [],
    capabilities: {
      supportsImages,
      supportsAudio: false,
      supportsVideo: false,
    },
  };

  let anyTokensEmitted = false;

  const runWithModel = async (modelToUse, isFallback = false) => {
    logStream('→ Requesting model', { model: modelToUse, isFallback });
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
          ...basePayload,
          model: modelToUse,
        }),
        signal,
      });
    } catch (err) {
      logStream('Network error', { model: modelToUse, isFallback, error: err?.message || err });
      return {
        success: false,
        error: {
          type: 'error',
          code: 'NETWORK',
          message: String(err?.message || err),
          model: modelToUse,
          isFallback,
        },
      };
    }

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      logStream('HTTP error', { model: modelToUse, isFallback, status: res.status, body: text });
      return {
        success: false,
        error: {
          type: 'error',
          code: 'HTTP_ERROR',
          message: text || `HTTP ${res.status}`,
          model: modelToUse,
          isFallback,
        },
      };
    }

    let doneSeen = false;
    let errorEvent = null;
    try {
      await readSSE(res.body, (evt) => {
        if (evt.type === 'token') {
          const delta = evt.delta || '';
          anyTokensEmitted = true;
          onToken?.(delta);
        } else if (evt.type === 'done') {
          doneSeen = true;
          logStream('Done event received', { model: modelToUse, isFallback });
        } else if (evt.type === 'error') {
          errorEvent = evt;
          logStream('Provider error event', { model: modelToUse, isFallback, error: evt });
        }
      });
    } catch (err) {
      logStream('SSE failure', { model: modelToUse, isFallback, error: err?.message || err });
      return {
        success: false,
        error: {
          type: 'error',
          code: 'SSE_FAILED',
          message: String(err?.message || err),
          model: modelToUse,
          isFallback,
        },
      };
    }

    if (errorEvent) {
      return { success: false, error: { ...errorEvent, model: modelToUse, isFallback } };
    }

    if (!doneSeen) {
      logStream('Stream incomplete', { model: modelToUse, isFallback });
      return {
        success: false,
        error: {
          type: 'error',
          code: 'STREAM_INCOMPLETE',
          message: 'Stream ended without completion signal.',
          model: modelToUse,
          isFallback,
        },
      };
    }

    logStream('Stream completed', { model: modelToUse, isFallback });
    return { success: true };
  };

  let lastModelUsed = model;
  let result = await runWithModel(model, false);
  const canFallback =
    !result.success &&
    fallbackModel &&
    fallbackModel !== model &&
    !anyTokensEmitted;

  let firstError = result.success ? null : result.error;

  if (canFallback) {
    logStream('Primary failed, retrying with fallback', {
      requestedModel: model,
      fallbackModel,
      error: result.error,
    });
    result = await runWithModel(fallbackModel, true);
    lastModelUsed = fallbackModel;
  }

  if (result.success) {
    logStream('Stream succeeded', { modelUsed: lastModelUsed, usedFallback: lastModelUsed === fallbackModel });
    onDone?.();
    return;
  }

  const finalError = canFallback
    ? { ...result.error, fallbackTried: true, fallbackModel, primaryError: firstError }
    : result.error;
  logStream('Stream failed', finalError);

  onError?.(finalError);
}

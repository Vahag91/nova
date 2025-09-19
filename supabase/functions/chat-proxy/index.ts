/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

// supabase/functions/chat-proxy/index.ts
import { MODELS } from "./registry.js";
import { openaiChatStream, openaiImageStream } from "./providers/openai.js";

// ---------- CORS helpers ----------
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-id, x-app-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

// ---------- Simple in-memory rate limiter ----------
type Key = string;
type Bucket = { count: number; windowStart: number };
const buckets = new Map<Key, Bucket>();

const WINDOW_MS = Number(Deno.env.get("RATE_WINDOW_MS") || 60 * 60 * 1000); // 1h
const MAX_REQ = Number(Deno.env.get("RATE_MAX") || 60);                      // 60/h

function rateKey(deviceId: string, ip: string) {
  return `${deviceId || "anon"}|${ip || "unknown"}`;
}

function isRateLimited(key: Key) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket) {
    buckets.set(key, { count: 1, windowStart: now });
    return { limited: false, retryAfter: 0 };
  }
  // window rollover
  if (now - bucket.windowStart > WINDOW_MS) {
    bucket.count = 1;
    bucket.windowStart = now;
    return { limited: false, retryAfter: 0 };
  }
  bucket.count += 1;
  if (bucket.count > MAX_REQ) {
    const retryAfter = Math.max(0, WINDOW_MS - (now - bucket.windowStart));
    return { limited: true, retryAfter };
  }
  return { limited: false, retryAfter: 0 };
}

// Optional: periodic cleanup of old buckets (best-effort)
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets.entries()) {
    if (now - b.windowStart > WINDOW_MS * 2) buckets.delete(k);
  }
}, WINDOW_MS).unref?.();

// ---------- SSE error response helper ----------
function sseError(code: string, message: string, status = 429, extra: Record<string, unknown> = {}) {
  const evt = `data: ${JSON.stringify({ type: "error", code, message, ...extra })}\n\n`;
  return new Response(evt, {
    status,
    headers: { "Content-Type": "text/event-stream", ...CORS_HEADERS },
  });
}

// ---------- Provider router ----------
async function route(body: any, signal: AbortSignal): Promise<Response> {
  const model = MODELS[body.model];
  if (!model) return sseError("UNKNOWN_MODEL", "Unknown model", 400);

  if (model.provider === "openai" && model.kind === "chat") {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    
    if (!apiKey) return sseError("SERVER_CONFIG", "OpenAI API key is not set", 500);
    return openaiChatStream({ body, signal, apiKey });
  }

  if (model.provider === "openai" && model.kind === "image") {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return sseError("SERVER_CONFIG", "OpenAI API key is not set", 500);
    return openaiImageStream({ body, signal, apiKey });
  }

  return sseError("UNSUPPORTED", "Provider/kind not implemented", 400);
}

// ---------- Telemetry (best-effort, no PII) ----------
function logEvent(event: Record<string, unknown>): void {
  // Visible in "supabase functions logs --follow"
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...event }));
}

// ---------- Handler ----------
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("Only POST", { status: 405, headers: CORS_HEADERS });
  }

  const started = Date.now();
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  const deviceId = req.headers.get("x-client-id") || "anon";
  const appVersion = req.headers.get("x-app-version") || "unknown";

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400, headers: CORS_HEADERS });
  }

  // Payload shape validation
  const model = MODELS[body?.model];
  if (!model || typeof body?.model !== 'string') {
    return new Response("Bad Request", { status: 400, headers: CORS_HEADERS });
  }

  // Validate based on model kind
  if (model.kind === 'chat' && !Array.isArray(body?.messages)) {
    return new Response("Bad Request: messages required for chat models", { status: 400, headers: CORS_HEADERS });
  }
  
  if (model.kind === 'image' && typeof body?.prompt !== 'string') {
    return new Response("Bad Request: prompt required for image models", { status: 400, headers: CORS_HEADERS });
  }

  // Size limits (only for chat models)
  if (model.kind === 'chat') {
    const MAX_MSGS = 100;
    if (body.messages.length > MAX_MSGS) {
      return new Response("Too many messages", { status: 400, headers: CORS_HEADERS });
    }
    
    // Quick size check without expensive JSON.stringify
    const totalChars = body.messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
    if (totalChars > 20000) {
      return new Response("Payload too large", { status: 413, headers: CORS_HEADERS });
    }
  }


  // ---- RATE LIMIT CHECK ----
  const key = rateKey(deviceId, ip);
  const rl = isRateLimited(key);
  if (rl.limited) {
    logEvent({ evt: "rate_limit", deviceId, ip, model: body.model, retryAfter: rl.retryAfter });
    return sseError("RATE_LIMIT", "Too many requests. Please retry later.", 429, {
      retryAfter: Math.ceil(rl.retryAfter / 1000),
    });
  }

  // ---- Route to provider ----
  const upstream = await route(body, req.signal);
  if (!(upstream instanceof Response)) {
    // route already returned a Response (e.g., sseError or error Response)
    return upstream as Response;
  }

  // If upstream is an error Response (non-2xx), bubble text back
  if (!upstream.ok || !upstream.body) {
    const txt = await upstream.text().catch(() => "");
    logEvent({ evt: "upstream_error", status: upstream.status, model: body.model, txt: txt.slice(0, 200) });
    return new Response(txt || `Upstream error ${upstream.status}`, {
      status: upstream.status,
      headers: CORS_HEADERS,
    });
  }

  // ---- Telemetry: log start ----
  logEvent({ evt: "chat_start", deviceId, ip, model: body.model, appVersion });

  // ---- SSE passthrough (as before) ----
  const headers = new Headers({ "Content-Type": "text/event-stream", ...CORS_HEADERS });
  const resp = new Response(upstream.body, { status: 200, headers });

  // When the connection closes, log duration
  resp.headers.set("X-Accel-Buffering", "no"); // hint for some proxies
  
  // Listen for request abort to log duration
  req.signal?.addEventListener?.("abort", () => {
    const ms = Date.now() - started;
    logEvent({ evt: "chat_end", deviceId, model: body.model, ms });
  });

  return resp;
});
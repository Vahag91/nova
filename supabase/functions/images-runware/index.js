/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
import { MODELS } from "./registry.js";
import { openaiChatStream } from "./providers/openai.js";
import { anthropicChatStream } from "./providers/anthropic.js";
import { googleChatStream } from "./providers/google.js";
import { xaiChatStream } from "./providers/xai.js";

// The function remains deployed, but all chat requests are stopped.
// Change this to false and redeploy when the app is active again.
const CHAT_SERVICE_STOPPED = false;

// ---------- DeepSeek provider (unchanged logic) ----------
function mapMessagesToDeepSeek(src) {
  const out = [];
  for (const m of src || []) {
    const role = (m.role || "user").toLowerCase();
    if (role === "system" || role === "user" || role === "assistant") {
      let text = "";
      if (Array.isArray(m.content)) {
        text = m.content
          .map((p) =>
            p?.type === "text"
              ? p.text || ""
              : typeof p === "string"
                ? p
                : ""
          )
          .filter(Boolean)
          .join("\n");
      } else if (typeof m.content === "string") {
        text = m.content;
      }
      if (text) {
        out.push({
          role,
          content: text,
        });
      }
    }
  }
  return out;
}

/**
 * Streams via DeepSeek Chat Completions API; normalizes to
 * {type:'token'|'done'|'error'}.
 */
export async function deepseekChatStream({ body, signal, apiKey }) {
  const messages = mapMessagesToDeepSeek(body.messages);
  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: body.model,
      messages,
      stream: true,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => "");
    return new Response(txt || "DeepSeek error", {
      status: res.status,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = res.body.getReader();
      let buffer = "";
      const emit = (obj) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      const handleLine = (line) => {
        if (!line.startsWith("data:")) return;
        const payload = line.slice(5).trim();
        if (!payload) return;
        if (payload === "[DONE]") {
          emit({
            type: "done",
          });
          return;
        }
        try {
          const js = JSON.parse(payload);
          const choice = js?.choices?.[0];
          const delta = choice?.delta || {};
          const text = delta.content || "";
          if (text) {
            emit({
              type: "token",
              delta: text,
            });
          }
        } catch {
          // Ignore malformed upstream frames.
        }
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += dec.decode(value, {
            stream: true,
          });
          let idx;
          while ((idx = buffer.indexOf("\n\n")) >= 0) {
            const frame = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            for (const ln of frame.split("\n")) {
              handleLine(ln.trim());
            }
          }
        }
        emit({
          type: "done",
        });
      } catch (e) {
        emit({
          type: "error",
          message: String(e?.message || e),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
    },
  });
}

// ---------- CORS ----------
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-client-id, x-app-version, x-secret-mode",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function sseError(code, message, status = 429, extra = {}) {
  const evt = `data: ${JSON.stringify({
    type: "error",
    code,
    message,
    ...extra,
  })}\n\n`;
  return new Response(evt, {
    status,
    headers: {
      "Content-Type": "text/event-stream",
      ...CORS_HEADERS,
    },
  });
}

function t(str, n = 180) {
  if (typeof str !== "string") return "";
  return str.length <= n ? str : str.slice(0, n) + "…";
}

async function route(body, signal) {
  const DEBUG_PROXY = Deno.env.get("DEBUG_PROXY") === "1";
  const modelMeta = MODELS[body.model];
  if (DEBUG_PROXY) {
    const firstMsg = Array.isArray(body.messages) ? body.messages[0] : null;
    console.log("[PROXY] incoming", {
      model: body?.model,
      provider: modelMeta?.provider,
      hasMessages: Array.isArray(body?.messages),
      msgCount: Array.isArray(body?.messages) ? body.messages.length : 0,
      firstRole: firstMsg?.role,
      firstPreview: t(
        Array.isArray(firstMsg?.content)
          ? firstMsg.content
              .map((p) => p?.text || p?.content || "")
              .filter(Boolean)
              .join("\n")
          : firstMsg?.content || "",
        160
      ),
    });
  }

  if (!modelMeta) return sseError("UNKNOWN_MODEL", "Unknown model", 400);

  const upstreamBody = {
    ...body,
    model: modelMeta.upstreamModel || body.model,
  };

  console.log("[MODEL ROUTE]", {
    requestedModel: body.model,
    upstreamModel: upstreamBody.model,
    provider: modelMeta.provider,
  });

  switch (modelMeta.provider) {
    case "openai": {
      const apiKey = Deno.env.get("OPENAI_API_KEY");
      if (!apiKey) {
        return sseError(
          "SERVER_CONFIG",
          "OpenAI API key is not set",
          500
        );
      }
      if (DEBUG_PROXY) console.log("[PROXY] dispatch -> openai");
      return openaiChatStream({
        body: upstreamBody,
        signal,
        apiKey,
      });
    }
    case "anthropic": {
      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) {
        return sseError(
          "SERVER_CONFIG",
          "Anthropic API key is not set",
          500
        );
      }
      if (DEBUG_PROXY) console.log("[PROXY] dispatch -> anthropic");
      return anthropicChatStream({
        body,
        signal,
        apiKey,
      });
    }
    case "google": {
      const apiKey = Deno.env.get("GOOGLE_API_KEY");
      if (!apiKey) {
        return sseError(
          "SERVER_CONFIG",
          "Google API key is not set",
          500
        );
      }
      if (DEBUG_PROXY) {
        console.log(
          "[PROXY] dispatch -> google (Gemini) model=",
          body.model
        );
      }
      return googleChatStream({
        body,
        signal,
        apiKey,
      });
    }
    case "xai": {
      const apiKey = Deno.env.get("XAI_API_KEY");
      if (!apiKey) {
        return sseError("SERVER_CONFIG", "xAI API key is not set", 500);
      }
      if (DEBUG_PROXY) console.log("[PROXY] dispatch -> xai");
      return xaiChatStream({
        body,
        signal,
        apiKey,
      });
    }
    case "deepseek": {
      const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
      if (!apiKey) {
        return sseError(
          "SERVER_CONFIG",
          "DeepSeek API key is not set",
          500
        );
      }
      if (DEBUG_PROXY) console.log("[PROXY] dispatch -> deepseek");
      return deepseekChatStream({
        body,
        signal,
        apiKey,
      });
    }
    default:
      return sseError(
        "UNSUPPORTED",
        `Provider '${modelMeta.provider}' not implemented`,
        400
      );
  }
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: CORS_HEADERS,
    });
  }

  if (req.method !== "POST") {
    return new Response("Only POST", {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  // IMPORTANT: this gate runs before the request body is parsed and before
  // any provider API key is read or any upstream AI provider is contacted.
  if (CHAT_SERVICE_STOPPED) {
    console.warn("[CHAT_PROXY] Request rejected: chat service is suspended");
    return sseError(
      "SERVICE_SUSPENDED",
      "Chat service is temporarily unavailable.",
      503,
      {
        retryable: false,
      }
    );
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const model = MODELS[body?.model];
  if (!model || typeof body?.model !== "string") {
    return new Response("Bad Request", {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  if (model.kind === "chat" && !Array.isArray(body?.messages)) {
    return new Response("Bad Request: messages required for chat", {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  const upstream = await route(body, req.signal);
  if (!(upstream instanceof Response)) return upstream;

  if (!upstream.ok || !upstream.body) {
    const txt = await upstream.text().catch(() => "");
    return new Response(txt || `Upstream error ${upstream.status}`, {
      status: upstream.status,
      headers: CORS_HEADERS,
    });
  }

  const resp = new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      ...CORS_HEADERS,
    },
  });
  resp.headers.set("X-Accel-Buffering", "no");
  return resp;
});

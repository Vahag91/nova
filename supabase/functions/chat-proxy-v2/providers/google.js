// supabase/functions/chat-proxy/providers/google.js

function parseDataUrl(u) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(u || "");
  if (!m) return null;
  return { mime: m[1], b64: m[2] };
}

function mapMessagesToGemini(src) {
  let system = "";
  const contents = [];

  for (const m of src || []) {
    const role = (m.role || "user").toLowerCase();

    if (role === "system") {
      // System → systemInstruction (text only)
      if (Array.isArray(m.content)) {
        const txt = m.content
          .map((p) =>
            p?.type === "text" ? (p.text || "") :
            (typeof p === "string" ? p : "")
          )
          .filter(Boolean)
          .join("\n");
        if (txt) system = system ? `${system}\n${txt}` : txt;
      } else if (typeof m.content === "string") {
        system = system ? `${system}\n${m.content}` : m.content;
      }
      continue;
    }

    // User/Assistant → contents[{ role: "user" | "model", parts: [...] }]
    const parts = [];
    if (Array.isArray(m.content)) {
      for (const part of m.content) {
        if (part?.type === "text") {
          const text = part.text ?? "";
          if (text) parts.push({ text });
        } else if (part?.type === "image_url" && part?.image_url?.url) {
          const parsed = parseDataUrl(part.image_url.url);
          if (parsed) parts.push({ inline_data: { mime_type: parsed.mime, data: parsed.b64 } });
        } else if (typeof part === "string") {
          parts.push({ text: part });
        }
      }
    } else if (typeof m.content === "string") {
      parts.push({ text: m.content });
    }

    if (parts.length) {
      const r = role === "assistant" ? "model" : "user";
      contents.push({ role: r, parts });
    }
  }

  const systemInstruction = system ? { parts: [{ text: system }] } : undefined;
  return { systemInstruction, contents };
}

/**
 * Robust stream parser:
 * - Tries SSE "data:" frames (rare with Gemini)
 * - Otherwise uses a bracket-depth chunker to extract complete JSON objects
 *   from pretty-printed / multi-line streaming
 */
function makeRobustJsonStreamer(onObject, onSseObject, onWarn) {
  // For SSE frames
  let sseBuffer = "";

  // For generic JSON objects (pretty printed)
  let objBuffer = "";
  let depth = 0;
  let inString = false;
  let esc = false;
  let started = false;

  return function feed(chunk) {
    if (!chunk) return;

    // ---- First, try to split SSE frames (frames are separated by \n\n and lines start with "data:")
    sseBuffer += chunk;
    let frameIdx;
    let consumedSse = false;
    while ((frameIdx = sseBuffer.indexOf("\n\n")) >= 0) {
      const raw = sseBuffer.slice(0, frameIdx);
      sseBuffer = sseBuffer.slice(frameIdx + 2);
      const lines = raw.split("\n");
      let data = "";
      for (const line of lines) {
        if (line.startsWith("data:")) data += (data ? "\n" : "") + line.slice(5).trim();
      }
      if (data) {
        consumedSse = true;
        try {
          const js = JSON.parse(data);
          onSseObject(js);
        } catch (e) {
          onWarn?.(`JSON.parse(SSE) error: ${e?.message} dataPreview=${data.slice(0, 100)}`);
        }
      }
    }

    // If we handled true SSE frames, we still also feed the JSON chunker below,
    // because some responses are mixed/ambiguous. But generally, SSE flow would
    // be complete here.

    // ---- Now try bracket-depth chunker for pretty-printed JSON tokens
    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];

      objBuffer += ch;

      if (inString) {
        if (esc) {
          esc = false;
        } else if (ch === "\\") {
          esc = true;
        } else if (ch === "\"") {
          inString = false;
        }
        continue;
      }

      if (ch === "\"") {
        inString = true;
        continue;
      }

      if (ch === "{" || ch === "[") {
        depth++;
        started = true;
      } else if (ch === "}" || ch === "]") {
        depth--;
      }

      if (started && depth === 0) {
        // We *believe* we have one complete JSON object in objBuffer
        const candidate = objBuffer.trim();
        objBuffer = "";
        started = false;

        // Often Gemini pretty-prints, but each "object" we receive this way should still be valid JSON.
        // However, sometimes arrays of objects are sent; handle either.
        try {
          // If it looks like multiple concatenated objects, try to split top-level array
          // else parse as a single object
          let parsed;
          if (candidate.startsWith("[")) {
            parsed = JSON.parse(candidate);
            // Array of objects; emit each
            if (Array.isArray(parsed)) {
              for (const item of parsed) onObject(item);
            } else {
              onObject(parsed);
            }
          } else {
            parsed = JSON.parse(candidate);
            onObject(parsed);
          }
        } catch (e) {
          onWarn?.(`JSON.parse(DepthChunk) error: ${e?.message} chunkPreview=${candidate.slice(0, 100)}`);
        }
      }
    }
  };
}

/**
 * Streams via Gemini (Generative Language API) using :streamGenerateContent.
 * Normalizes to {type:'token'|'done'|'error'} and includes rich diagnostics when empty.
 */
export async function googleChatStream({ body, signal, apiKey }) {
  const DEBUG = Deno.env.get("DEBUG_GEMINI") === "1";

  const { systemInstruction, contents } = mapMessagesToGemini(body.messages);

  if (DEBUG) {
    const firstUser = (contents.find(c => c.role === "user")?.parts?.[0]?.text || "").slice(0, 64);
    console.log(`[GEMINI] model= ${body.model}`);
    console.log(`[GEMINI] system.len= ${systemInstruction ? (systemInstruction.parts?.[0]?.text?.length || 0) : 0}`);
    console.log(`[GEMINI] contents.roles=`, JSON.stringify(contents.map(c => c.role)));
    console.log(`[GEMINI] firstUserPreview= ${firstUser}`);
    console.log(`[GEMINI] apiKeyPresent= ${!!apiKey}`);
  }

  // Endpoint with API key as query param (per Google docs).
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    body.model
  )}:streamGenerateContent?key=${encodeURIComponent(apiKey)}`;

  // No safetySettings (to avoid INVALID_ARGUMENT on enums)
  // Ask for plain text so model emits text tokens
  const reqBody = {
    contents,
    systemInstruction,
    generationConfig: {
      responseMimeType: "text/plain",
      // temperature: (typeof body.temperature === "number") ? body.temperature : undefined,
    },
  };

  if (DEBUG) {
    const payload = JSON.stringify(reqBody);
    console.log(`[GEMINI] POST ${endpoint} (payload bytes=${payload.length})`);
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(reqBody),
    signal,
  });

  if (DEBUG) {
    console.log(`[GEMINI] upstream.status= ${res.status} ${res.statusText}`);
    console.log(`[GEMINI] upstream.headers.content-type= ${res.headers.get("content-type")}`);
  }

  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => "");
    if (DEBUG) console.error("[GEMINI] upstream error body:", txt.slice(0, 500));
    return new Response(txt || "Google error", { status: res.status, headers: { "Content-Type": "text/plain" } });
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      const reader = res.body.getReader();

      // Diagnostics
      let emittedAnyText = false;
      const finishReasons = new Set();
      let lastPromptFeedback = null;
      let lastSafetyRatings = [];

      const onObject = (obj) => {
        try {
          if (obj?.promptFeedback) lastPromptFeedback = obj.promptFeedback;
          const candidates = obj?.candidates || [];
          for (const c of candidates) {
            if (c?.finishReason) finishReasons.add(c.finishReason);
            if (Array.isArray(c?.safetyRatings)) lastSafetyRatings = c.safetyRatings;

            const parts = c?.content?.parts || [];
            for (const p of parts) {
              if (typeof p?.text === "string" && p.text) {
                emittedAnyText = true;
                emit({ type: "token", delta: p.text });
              }
            }
          }
        } catch (e) {
          if (DEBUG) console.warn("[GEMINI] onObject error:", e?.message);
        }
      };

      const onSseObject = (obj) => {
        // Same shape, so reuse onObject
        onObject(obj);
      };

      const onWarn = (msg) => {
        if (DEBUG) console.warn("[GEMINI]", msg);
      };

      const feed = makeRobustJsonStreamer(onObject, onSseObject, onWarn);

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = dec.decode(value, { stream: true });
          feed(chunk);
        }

        if (!emittedAnyText) {
          const details = {
            finishReasons: Array.from(finishReasons),
            promptFeedback: lastPromptFeedback,
            safetyRatings: lastSafetyRatings,
          };
          if (DEBUG) console.warn("[GEMINI] EMPTY COMPLETION", JSON.stringify(details));
          if (lastPromptFeedback?.blockReason) {
            emit({
              type: "error",
              code: "GEMINI_SAFETY_BLOCK",
              message: `Gemini blocked the prompt (${lastPromptFeedback.blockReason}).`,
              details,
            });
          } else {
            emit({
              type: "error",
              code: "GEMINI_EMPTY_COMPLETION",
              message: "Gemini returned no text tokens.",
              details,
            });
          }
        } else {
          emit({ type: "done" });
        }
      } catch (e) {
        emit({ type: "error", message: String(e?.message || e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}


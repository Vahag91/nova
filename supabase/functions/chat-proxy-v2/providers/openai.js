import { MODELS } from "../registry.js";

/**
 * Streams via OpenAI Responses API.
 * - Converts chat-style `messages` to Responses `{ input, instructions }`.
 * - USER turns -> {type:'input_text' | 'input_image'}
 * - ASSISTANT turns -> {type:'output_text'}   (no images)
 * - SYSTEM turns are merged into top-level `instructions`.
 * - Optional built-in Web Search tool:
 *     body.allowWebSearch === true  -> tools: [{type:'web_search'}]
 *     body.forceWebSearch === true  -> tool_choice: { type: 'web_search' } (else 'auto')
 *     body.webSearchConfig: { recencyDays?, maxCalls?, includeDomains?, excludeDomains? }
 *   Server-side caps via env:
 *     WEB_MAX_TOOL_CALLS (default 2), WEB_RECENCY_DAYS (default 30),
 *     WEB_INCLUDE_DOMAINS, WEB_EXCLUDE_DOMAINS (CSV)
 * - Normalizes SSE to {type:'token' | 'done' | 'error'}.
 * - No temperature anywhere.
 */
export async function openaiChatStream({ body, signal, apiKey }) {
  const src = Array.isArray(body.messages) ? body.messages : [];

  let instructions;         // system text merged here
  const input = [];         // Responses API input array

  for (const m of src) {
    const role = (m.role || "user").toLowerCase();

    // Merge system → instructions
    if (role === "system") {
      if (Array.isArray(m.content)) {
        const sysText = m.content
          .map((p) =>
            p?.type === "text" || p?.type === "input_text" ? (p.text || p.content || "") : ""
          )
          .filter(Boolean)
          .join("\n");
        if (sysText) instructions = instructions ? `${instructions}\n${sysText}` : sysText;
      } else if (typeof m.content === "string") {
        instructions = instructions ? `${instructions}\n${m.content}` : m.content;
      }
      continue;
    }

    const content = [];

    if (role === "user") {
      // USER -> input_text / input_image
      if (Array.isArray(m.content)) {
        for (const part of m.content) {
          if (part?.type === "text" || part?.type === "input_text") {
            const text = part.text ?? part.content ?? "";
            if (text) content.push({ type: "input_text", text });
          } else if (part?.type === "image_url" || part?.type === "input_image") {
            const url = part?.image_url?.url ?? part?.image_url ?? part?.url;
            if (url) content.push({ type: "input_image", image_url: url });
          } else if (typeof part === "string") {
            content.push({ type: "input_text", text: part });
          }
        }
      } else {
        const text = m.content ?? "";
        if (text) content.push({ type: "input_text", text });
      }
    } else if (role === "assistant") {
      // ASSISTANT history -> output_text
      if (Array.isArray(m.content)) {
        for (const part of m.content) {
          if (part?.type === "text" || part?.type === "input_text") {
            const text = part.text ?? part.content ?? "";
            if (text) content.push({ type: "output_text", text });
          } else if (typeof part === "string") {
            content.push({ type: "output_text", text: part });
          }
          // ignore assistant images for now
        }
      } else {
        const text = m.content ?? "";
        if (text) content.push({ type: "output_text", text });
      }
    } else {
      // Any other roles -> treat as user text
      const text = typeof m.content === "string" ? m.content : "";
      if (text) content.push({ type: "input_text", text });
    }

    if (content.length) input.push({ role, content });
  }

  // ---- Web Search tool (optional) ----
  const allowWebSearch = !!body.allowWebSearch;
  const forceWebSearch = !!body.forceWebSearch;

  // server caps / defaults
  const ENV_MAX = parseInt(Deno.env.get("WEB_MAX_TOOL_CALLS") || "", 10);
  const ENV_RECENCY = parseInt(Deno.env.get("WEB_RECENCY_DAYS") || "", 10);
  const ENV_INCLUDE = (Deno.env.get("WEB_INCLUDE_DOMAINS") || "").trim();
  const ENV_EXCLUDE = (Deno.env.get("WEB_EXCLUDE_DOMAINS") || "").trim();

  const requestedCfg = body.webSearchConfig || {};
  const serverMaxCalls = Number.isFinite(ENV_MAX) ? Math.max(1, ENV_MAX) : 2;
  const requestedMaxCalls = Number(requestedCfg.maxCalls);
  const cfg = {
    maxCalls: Number.isFinite(requestedMaxCalls)
      ? Math.max(1, Math.min(serverMaxCalls, requestedMaxCalls))
      : serverMaxCalls,
    recencyDays: Number.isFinite(ENV_RECENCY) ? Math.max(0, ENV_RECENCY) : 30,
    includeDomains: ENV_INCLUDE ? ENV_INCLUDE.split(",").map((s) => s.trim()).filter(Boolean) : [],
    excludeDomains: ENV_EXCLUDE ? ENV_EXCLUDE.split(",").map((s) => s.trim()).filter(Boolean) : [],
    ...requestedCfg,
  };
  cfg.maxCalls = Math.max(1, Math.min(serverMaxCalls, Number(cfg.maxCalls) || 1));

  // Add guardrails to instructions when search is enabled
  if (allowWebSearch) {
    const prefs = [];
    if (cfg.includeDomains?.length) prefs.push(`Prefer sources from: ${cfg.includeDomains.join(", ")}`);
    if (cfg.excludeDomains?.length) prefs.push(`Avoid sources from: ${cfg.excludeDomains.join(", ")}`);
    const guard = [
      `You may use web search if and only if the information is likely to have changed recently or isn't in the context.`,
      `At most ${cfg.maxCalls} searches. Prefer recency within ~${cfg.recencyDays} days when applicable.`,
      ...(prefs.length ? [prefs.join(". ")] : []),
      `If you use web search, cite sources with title and URL.`,
    ].join("\n");

    instructions = instructions ? `${instructions}\n\n${guard}` : guard;
  }

  const requestBody = {
    model: body.model,
    stream: true,
    input,
    reasoning: {
      effort: "none",
      context: "current_turn",
    },
    text: {
      verbosity: "low",
    },
    max_output_tokens: 1200,
  };
  if (instructions) requestBody.instructions = instructions;
  if (body.promptCacheKey) requestBody.prompt_cache_key = body.promptCacheKey;
  if (body.safetyIdentifier) {
    requestBody.safety_identifier = body.safetyIdentifier;
  }
  if (allowWebSearch) {
    requestBody.tools = [{ type: "web_search" }];
    requestBody.tool_choice = forceWebSearch ? { type: "web_search" } : "auto";
    requestBody.max_tool_calls = cfg.maxCalls;
  }

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => "");
    return new Response(txt || "OpenAI error", {
      status: res.status,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // ---- Normalize OpenAI SSE -> {type:'token' | 'done' | 'error'}
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = res.body.getReader();
      let buf = "";
      let terminalEventSeen = false;

      const emitDone = (data, status) => {
        if (terminalEventSeen) return;
        terminalEventSeen = true;

        const usage = data?.response?.usage || data?.usage || null;
        if (usage) {
          console.log("[OPENAI USAGE V2]", {
            requestedModel: body.requestedModel,
            upstreamModel: body.model,
            status,
            inputTokens: usage.input_tokens || 0,
            cachedInputTokens: usage.input_tokens_details?.cached_tokens || 0,
            cacheWriteTokens: usage.cache_write_tokens || 0,
            outputTokens: usage.output_tokens || 0,
            reasoningTokens:
              usage.output_tokens_details?.reasoning_tokens || 0,
            totalTokens: usage.total_tokens || 0,
          });
        }

        controller.enqueue(
          enc.encode(
            `data: ${JSON.stringify({
              type: "done",
              ...(usage ? { usage } : {}),
              ...(status === "incomplete" ? { incomplete: true } : {}),
            })}\n\n`
          )
        );
      };

      const flush = (evtName, dataStr) => {
        if (!dataStr) return;
        try {
          const data = JSON.parse(dataStr);

          // Primary text streaming
          if (evtName === "response.output_text.delta") {
            const delta = data?.delta ?? data?.output_text_delta ?? "";
            if (delta) controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "token", delta })}\n\n`));
            return;
          }
          if (evtName === "response.completed") {
            emitDone(data, "completed");
            return;
          }
          if (evtName === "response.incomplete") {
            emitDone(data, "incomplete");
            return;
          }
          if (evtName === "response.error") {
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "error", ...data })}\n\n`));
            return;
          }

          // (Optional) Forward tool-related events verbatim for future UI:
          // Any event starting with 'response.tool_' will be passed along.
          if (evtName && evtName.startsWith("response.tool_")) {
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "tool", event: evtName, data })}\n\n`));
            return;
          }

          // (Optional) Forward search-specific events if OpenAI emits them (future-proof)
          if (evtName && evtName.includes("web_search")) {
            controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "tool", event: evtName, data })}\n\n`));
          }
        } catch {
          // ignore malformed
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });

          let idx;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const raw = buf.slice(0, idx);
            buf = buf.slice(idx + 2);

            let evtName = "";
            let dataStr = "";
            for (const line of raw.split("\n")) {
              if (line.startsWith("event:")) evtName = line.slice(6).trim();
              else if (line.startsWith("data:")) dataStr += (dataStr ? "\n" : "") + line.slice(5).trim();
            }
            flush(evtName, dataStr);
          }
        }
        if (!terminalEventSeen) emitDone(null, "stream_closed");
      } catch (e) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "error", message: String(e?.message || e) })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}

/* Not used here. */
export async function openaiImageStream() {
  return new Response(
    JSON.stringify({ error: "IMAGE_UNSUPPORTED_IN_THIS_FUNCTION" }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}

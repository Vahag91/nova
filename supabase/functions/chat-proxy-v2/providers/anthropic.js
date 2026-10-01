// supabase/functions/chat-proxy/providers/anthropic.js
function parseDataUrl(u) {
  // data:mime;base64,XXXX
  const m = /^data:([^;]+);base64,(.+)$/.exec(u || "");
  if (!m) return null;
  return { mime: m[1], b64: m[2] };
}

function mapMessagesToAnthropic(src) {
  let system = "";
  const messages = [];

  for (const m of src || []) {
    const role = (m.role || "user").toLowerCase();
    if (role === "system") {
      if (Array.isArray(m.content)) {
        const txt = m.content
          .map((p) => (p?.type === "text" ? (p.text || "") : (typeof p === "string" ? p : "")))
          .filter(Boolean)
          .join("\n");
        if (txt) system = system ? `${system}\n${txt}` : txt;
      } else if (typeof m.content === "string") {
        system = system ? `${system}\n${m.content}` : m.content;
      }
      continue;
    }

    const content = [];
    if (Array.isArray(m.content)) {
      for (const part of m.content) {
        if (part?.type === "text") {
          const text = part.text ?? "";
          if (text) content.push({ type: "text", text });
        } else if (part?.type === "image_url" && part?.image_url?.url) {
          const parsed = parseDataUrl(part.image_url.url);
          if (parsed) {
            content.push({
              type: "image",
              source: { type: "base64", media_type: parsed.mime, data: parsed.b64 },
            });
          }
        } else if (typeof part === "string") {
          content.push({ type: "text", text: part });
        }
      }
    } else if (typeof m.content === "string") {
      content.push({ type: "text", text: m.content });
    }

    if (content.length) {
      // Anthropic expects roles "user" or "assistant"
      const r = role === "assistant" ? "assistant" : "user";
      messages.push({ role: r, content });
    }
  }

  return { system: system || undefined, messages };
}

/**
 * Stream text via Anthropic Messages API as SSE normalized to {type:'token'|'done'|'error'}.
 */
export async function anthropicChatStream({ body, signal, apiKey }) {
  const { system, messages } = mapMessagesToAnthropic(body.messages);

  const reqBody = {
    model: body.model,
    messages,
    system,
    stream: true,
    max_tokens: 8192, // required by Anthropic
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(reqBody),
    signal,
  });

  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => "");
    return new Response(txt || "Anthropic error", {
      status: res.status,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = res.body.getReader();
      let buf = "";

      const emit = (obj) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));

      const flush = (evtName, dataStr) => {
        if (!dataStr) return;
        try {
          const data = JSON.parse(dataStr);

          // Text deltas come as content_block_delta -> delta.type === 'text_delta'
          if (evtName === "content_block_delta" && data?.delta?.type === "text_delta") {
            const delta = data.delta.text || "";
            if (delta) emit({ type: "token", delta });
          } else if (evtName === "message_stop") {
            emit({ type: "done" });
          } else if (evtName === "error") {
            emit({ type: "error", message: data?.error?.message || "Anthropic error" });
          }
        } catch { /* ignore */ }
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });

          let idx;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const raw = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            let evt = "", data = "";
            for (const line of raw.split("\n")) {
              if (line.startsWith("event:")) evt = line.slice(6).trim();
              else if (line.startsWith("data:")) data += (data ? "\n" : "") + line.slice(5).trim();
            }
            flush(evt, data);
          }
        }
        emit({ type: "done" });
      } catch (e) {
        emit({ type: "error", message: String(e?.message || e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}


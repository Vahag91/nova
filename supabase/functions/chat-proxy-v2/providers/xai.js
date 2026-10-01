// supabase/functions/chat-proxy/providers/xai.js

function mapMessagesToXAI(src) {
  const out = [];
  for (const m of src || []) {
    const role = (m.role || "user").toLowerCase();
    if (role === "system" || role === "user" || role === "assistant") {
      // collapse array content to text; xAI stream is text-only in chat/completions
      let text = "";
      if (Array.isArray(m.content)) {
        text = m.content
          .map((p) =>
            p?.type === "text" ? (p.text || "") :
            (typeof p === "string" ? p : "")
          )
          .filter(Boolean)
          .join("\n");
      } else if (typeof m.content === "string") {
        text = m.content;
      }
      if (text) out.push({ role, content: text });
    }
  }
  return out;
}

/**
 * Streams via xAI Chat Completions API; normalizes to {type:'token'|'done'|'error'}.
 * Note: image parts are ignored here (text-only).
 */
export async function xaiChatStream({ body, signal, apiKey }) {
  const messages = mapMessagesToXAI(body.messages);

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: body.model,       // e.g., "grok-2" or "grok-2-mini"
      messages,
      stream: true,
    }),
    signal,
  });

  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => "");
    return new Response(txt || "xAI error", { status: res.status, headers: { "Content-Type": "text/plain" } });
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = res.body.getReader();
      let buffer = "";

      const emit = (obj) => controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));

      const handleLine = (line) => {
        // expect "data: {...}" or "data: [DONE]"
        if (!line.startsWith("data:")) return;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") { emit({ type: "done" }); return; }
        try {
          const js = JSON.parse(payload);
          const delta = js?.choices?.[0]?.delta?.content || "";
          if (delta) emit({ type: "token", delta });
        } catch { /* ignore */ }
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += dec.decode(value, { stream: true });

          let idx;
          while ((idx = buffer.indexOf("\n\n")) >= 0) {
            const frame = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            for (const ln of frame.split("\n")) handleLine(ln.trim());
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


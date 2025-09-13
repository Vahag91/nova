// supabase/functions/chat-proxy/index.js
import { MODELS } from "./registry.js";

function sseHeaders() {
  return new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
}
function write(controller, obj) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Only POST", { status: 405, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  let body = {};
  try { body = await req.json(); } catch { 
    return new Response(JSON.stringify({ type:"error", code:"BAD_INPUT" }), {
      status: 400, headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" }
    });
  }

  const info = MODELS[body.model];
  if (!info || info.provider !== "openai") {
    return new Response(JSON.stringify({ type:"error", code:"UNKNOWN_MODEL" }), {
      status: 400, headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" }
    });
  }

  // Upstream call (streaming)
  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: body.model,
      stream: true,
      temperature: body.temperature ?? 0.7,
      messages: (body.messages ?? []).map(m => ({ role: m.role, content: m.content })),
    }),
    signal: req.signal
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(JSON.stringify({ type:"error", code:"UPSTREAM", message: await upstream.text() }), {
      status: upstream.status, headers: { "Content-Type":"application/json", "Access-Control-Allow-Origin":"*" }
    });
  }

  // Transform OpenAI SSE --> typed SSE {type:"token", delta:"..."}
  const stream = new ReadableStream({
    start(controller) {
      (async () => {
        const reader = upstream.body.getReader();
        const dec = new TextDecoder();
        let buf = "";

        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;

            buf += dec.decode(value, { stream: true });
            const lines = buf.replace(/\r/g,"").split("\n");
            buf = lines.pop() || "";

            for (let line of lines) {
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;

              try {
                const json = JSON.parse(payload);
                const delta = json?.choices?.[0]?.delta?.content;
                if (delta) write(controller, { type: "token", delta });
              } catch {}
            }
          }
          write(controller, { type: "done" });
          controller.close();
        } catch (e) {
          write(controller, { type: "error", code:"STREAM_ABORTED", message: String(e?.message || e) });
          controller.close();
        }
      })();
    }
  });

  return new Response(stream, { status: 200, headers: sseHeaders() });
});
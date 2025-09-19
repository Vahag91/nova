import { MODELS } from "../registry.js";

export async function openaiChatStream({ body, signal, apiKey }) {
  const msg = (body.messages ?? []).map((m) => {
    // allow either string or array parts
    const out = { role: m.role };
    if (Array.isArray(m.content)) out.content = m.content;          // [{type:'text'},{type:'image_url',...}]
    else out.content = m.content ?? "";                              // plain text
    return out;
  });

  const requestBody = {
    model: body.model,
    stream: true,
    messages: msg,
  };

  const temperatureSupported = MODELS[body.model]?.temperatureSupported;
  if (temperatureSupported) {
    requestBody.temperature = body.temperature ?? 0.7;
  }

  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
    signal,
  });
}

const enc = new TextEncoder();

export async function openaiImageStream({ body, signal, apiKey }) {
  const prompt = body.prompt || body.text || "";
  if (!prompt) {
    return new Response("Missing prompt", { status: 400, headers: { "Content-Type": "text/plain" } });
  }

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      size: body.size || "1024x1024",
      response_format: "url", // or "b64_json" if you want base64
    }),
    signal,
  });

  if (!res.ok) {
    const txt = await res.text().catch(()=>"");
    return new Response(txt || "OpenAI image error", { status: res.status, headers: { "Content-Type": "text/plain" } });
  }

  const json = await res.json();
  const url = json?.data?.[0]?.url || null;

  const stream = new ReadableStream({
    start(controller) {
      if (url) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "image", url })}\n\n`));
      } else {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "error", code: "IMAGE_EMPTY" })}\n\n`));
      }
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
      controller.close();
    }
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, x-client-id, x-app-version" },
  });
}
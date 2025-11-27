/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-id, x-app-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Only POST", { status: 405, headers: CORS });

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return new Response("Server not configured", { status: 500, headers: CORS });

  let body: any = {};
  try { body = await req.json(); } catch { return new Response("Bad JSON", { status: 400, headers: CORS }); }

  const prompt = String(body?.prompt || "").slice(0, 4000).trim();
  const model  = String(body?.model || "gpt-image-1");
  const size   = (body?.size === "1024x1024" || body?.size === "1024x1536" || body?.size === "1536x1024" || body?.size === "auto")
    ? body.size : "1024x1024";
  const n      = Math.max(1, Math.min(Number(body?.n ?? 2), 4));

  if (!prompt) return new Response("Missing prompt", { status: 400, headers: CORS });

  // Validate model
  const validModels = ["gpt-image-1", "dall-e-3", "dall-e-2"];
  if (!validModels.includes(model)) {
    return new Response(`Invalid model: ${model}. Supported models: ${validModels.join(", ")}`, { status: 400, headers: CORS });
  }

  // Validate size for dall-e-3 (only supports 1024x1024, 1024x1792, 1792x1024)
  if (model === "dall-e-3") {
    const validSizes = ["1024x1024", "1024x1792", "1792x1024"];
    if (!validSizes.includes(size)) {
      return new Response(`Invalid size for dall-e-3: ${size}. Supported sizes: ${validSizes.join(", ")}`, { status: 400, headers: CORS });
    }
  }

  // Validate n for dall-e-3 (only supports n=1)
  if (model === "dall-e-3" && n !== 1) {
    return new Response("dall-e-3 only supports n=1", { status: 400, headers: CORS });
  }

  // Call OpenAI Images (returns JSON, not stream)
  const resp = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, size, n }),
    signal: req.signal,
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    return new Response(txt || "Upstream error", { status: resp.status, headers: CORS });
  }

  let json: any;
  try {
    json = await resp.json();
  } catch (error) {
    return new Response("Invalid response from OpenAI", { status: 502, headers: CORS });
  }

  // Validate response structure
  if (!json || !Array.isArray(json.data)) {
    return new Response("Invalid response structure from OpenAI", { status: 502, headers: CORS });
  }

  // Normalize images
  const images = json.data.map((d: any, i: number) => {
    let imageUrl = "";
    
    if (d.url) {
      // Direct URL from OpenAI
      imageUrl = d.url;
    } else if (d.b64_json) {
      // Base64 data - format as data URI
      imageUrl = `data:image/png;base64,${d.b64_json}`;
    }
    
    return {
      id: crypto.randomUUID(),
      url: imageUrl,
      index: i,
    };
  });

  // Validate that we have at least one image with valid URLs
  const validImages = images.filter(img => img.url && img.url.trim().length > 0);
  if (validImages.length === 0) {
    return new Response("No valid images generated", { status: 502, headers: CORS });
  }

  return new Response(JSON.stringify({
    status: "done",
    prompt,
    model,
    size,
    images: validImages,
  }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
});

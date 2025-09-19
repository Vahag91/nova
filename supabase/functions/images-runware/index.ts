/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-id, x-app-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

type Body = {
  prompt?: string;
  model?: string;                 // one of: runware-flux-dev | runware-flux-schnell | runware-qwen-image | runware-gemini-flash
  size?: string;                  // ignored for now; we force 512x512
  negativePrompt?: string;        // optional
  steps?: number;                 // optional; we set sane defaults per model
  n?: number;                     // ignored; we force 1 for now
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Only POST", { status: 405, headers: CORS });

  const RUNWARE_API_KEY = Deno.env.get("RUNWARE_KEY") || "";
  if (!RUNWARE_API_KEY) {
    return new Response("Runware not configured", { status: 500, headers: CORS });
  }

  // Map friendly keys -> AIR IDs (paste yours from Runware Model Explorer)
  const AIR = {
    // Examples:
    // FLUX.1 dev is often `runware:101@1` (verify in Model Explorer)
    "runware-flux-dev":       Deno.env.get("RUNWARE_AIR_FLUX_DEV")       || "", 
    // FLUX.1 schnell has its own AIR ID (paste yours)
    "runware-flux-schnell":   Deno.env.get("RUNWARE_AIR_FLUX_SCHNELL")   || "",
    "runware-qwen-image":     Deno.env.get("RUNWARE_AIR_QWEN_IMAGE")     || "",
    "runware-gemini-flash":   Deno.env.get("RUNWARE_AIR_GEMINI_FLASH")   || "",
  } as const;

  let body: Body = {};
  try { body = await req.json(); } catch { 
    return new Response("Bad JSON", { status: 400, headers: CORS }); 
  }

  const prompt = String(body?.prompt || "").trim();
  const modelKey = String(body?.model || "runware-flux-dev").trim();
  const sizeParam = String(body?.size || "512x512").trim();
  const negativePrompt = typeof body?.negativePrompt === "string" ? body.negativePrompt.trim() : "";
  if (!prompt) return new Response("Missing prompt", { status: 400, headers: CORS });

  const air = AIR[modelKey as keyof typeof AIR];
  if (!air) {
    const allowed = Object.keys(AIR).join(", ");
    return new Response(`Invalid Runware model: ${modelKey}. Allowed: ${allowed}`, { status: 400, headers: CORS });
  }

  // Parse size parameter (e.g., "1024x1024" -> width=1024, height=1024)
  const sizeMatch = sizeParam.match(/^(\d+)x(\d+)$/);
  if (!sizeMatch) {
    return new Response(`Invalid size format: ${sizeParam}. Expected format: WIDTHxHEIGHT (e.g., 512x512)`, { status: 400, headers: CORS });
  }
  
  const width = parseInt(sizeMatch[1], 10);
  const height = parseInt(sizeMatch[2], 10);
  
  // Model-specific pixel limits
  const pixelLimits: Record<string, number> = {
    "runware-flux-dev": 2097152,      // 2M pixels (e.g., 1024x2048)
    "runware-flux-schnell": 2097152,  // 2M pixels
    "runware-qwen-image": 1048576,    // 1M pixels (1024x1024 max)
    "runware-gemini-flash": 1048576,  // 1M pixels (uses default anyway)
  };
  
  const maxPixels = pixelLimits[modelKey] || 1048576;
  const totalPixels = width * height;
  
  // Validate dimensions
  if (width < 64 || width > 2048 || height < 64 || height > 2048) {
    return new Response(`Invalid dimensions: ${width}x${height}. Must be between 64x64 and 2048x2048`, { status: 400, headers: CORS });
  }
  
  // Validate pixel limit for specific model
  if (totalPixels > maxPixels) {
    const maxDimension = Math.sqrt(maxPixels);
    return new Response(`Invalid dimensions for ${modelKey}: ${width}x${height} (${totalPixels} pixels). Maximum allowed: ${maxPixels} pixels (e.g., ${Math.floor(maxDimension)}x${Math.floor(maxDimension)})`, { status: 400, headers: CORS });
  }

  // Sane default steps per model (can tune later)
  const defaultSteps: Record<string, number> = {
    "runware-flux-dev": 28,
    "runware-flux-schnell": 4,
    "runware-qwen-image": 20,
    "runware-gemini-flash": 28, // conservative default
  };
  
  // Models that support steps parameter
  const modelsWithSteps = new Set([
    "runware-flux-dev",
    "runware-flux-schnell", 
    "runware-qwen-image"
  ]);
  
  // Models that support width/height parameters
  const modelsWithDimensions = new Set([
    "runware-flux-dev",
    "runware-flux-schnell", 
    "runware-qwen-image"
  ]);
  
  const steps = Math.max(1, Math.min(100, Number(body?.steps ?? defaultSteps[modelKey] ?? 20)));

  // Build Runware tasks array (per docs)
  // Docs: POST https://api.runware.ai/v1 with JSON array of tasks
  const taskUUID = crypto.randomUUID();
  const task: any = {
    taskUUID: taskUUID,
    taskType: "imageInference",
    model: air,               // AIR identifier
    positivePrompt: prompt,
    // Note: FLUX ignores negativePrompt; including it is harmless
    ...(negativePrompt ? { negativePrompt } : {}),
  };
  
  // Only add dimensions for models that support it
  if (modelsWithDimensions.has(modelKey)) {
    task.width = width;
    task.height = height;
  }
  
  // Only add steps for models that support it
  if (modelsWithSteps.has(modelKey)) {
    task.steps = steps;
  }
  
  const tasks = [task];

  const headers = {
    "Content-Type": "application/json",
    // Runware accepts either of these; we send both for compatibility
    "Authorization": `Bearer ${RUNWARE_API_KEY}`,
    "X-API-Key": RUNWARE_API_KEY,
  };


  const resp = await fetch("https://api.runware.ai/v1", {
    method: "POST",
    headers,
    body: JSON.stringify(tasks),
    signal: req.signal,
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(()=> "");
    console.error(`Runware error ${resp.status} ${resp.statusText}`, txt);
    return new Response(txt || "Runware upstream error", { status: resp.status, headers: CORS });
  }

  // Expected shape:
  // { data: [{ taskType:"imageInference", imageUUID:"...", imageURL:"https://..." } ... ] }
  let json: any;
  try { json = await resp.json(); }
  catch (e) {
    console.error("Parse error from Runware:", e);
    return new Response("Invalid response from Runware", { status: 502, headers: CORS });
  }

  const data = Array.isArray(json?.data) ? json.data : [];
  const images = data
    .map((d: any, i: number) => {
      const url = d?.imageURL || d?.imageUrl || "";           // primary path
      const b64 = d?.imageBase64 || d?.b64_json || "";        // fallback if base64 returned
      const finalUrl = url ? url : (b64 ? `data:image/jpeg;base64,${b64}` : "");
      return finalUrl ? { id: crypto.randomUUID(), url: finalUrl, index: i } : null;
    })
    .filter(Boolean);

  if (!images.length) {
    console.error("Runware returned no images:", json);
    return new Response("No valid images generated", { status: 502, headers: CORS });
  }

  return new Response(JSON.stringify({
    provider: "runware",
    status: "done",
    prompt,
    model: modelKey,
    size: `${width}x${height}`,
    images
  }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
});

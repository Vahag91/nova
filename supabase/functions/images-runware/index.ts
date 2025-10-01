/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-id, x-app-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

// Helper functions
function snap64(n: number) {
  const r = Math.max(128, Math.min(2048, Math.round(n / 64) * 64));
  return r;
}

function with64Dims(width: number, height: number) {
  return { width: snap64(width), height: snap64(height) };
}

// Helper function to upload image if it's a data URI
async function uploadImageIfNeeded(imageData: string, headers: any, signal: AbortSignal) {
  const maxRetries = 2;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📤 [RUNWARE] Uploading image (attempt ${attempt + 1})...`);
      
      const uploadTaskUUID = crypto.randomUUID();
      const uploadTask = {
        taskUUID: uploadTaskUUID,
        taskType: "imageUpload",
        image: imageData
      };
      
      const uploadResp = await fetch("https://api.runware.ai/v1", {
        method: "POST",
        headers,
        body: JSON.stringify([uploadTask]),
        signal,
      });
      
      if (uploadResp.ok) {
        const uploadJson = await uploadResp.json();
        const uploadData = Array.isArray(uploadJson?.data) ? uploadJson.data : [];
        const uploadedImage = uploadData.find(d => d.taskType === "imageUpload");
        
        if (uploadedImage?.imageUUID) {
          return { uuid: uploadedImage.imageUUID };
        } else {
          console.error("❌ [RUNWARE] No imageUUID returned from upload:", uploadJson);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
            continue;
          }
          return { error: "Image upload failed - no UUID returned" };
        }
      }
      
      const txt = await uploadResp.text().catch(()=> "");
      console.error(`Upload error ${uploadResp.status} ${uploadResp.statusText} (attempt ${attempt + 1}):`, txt);
      
      // If it's a server error and we have retries left, wait and retry
      if (uploadResp.status >= 500 && attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
        continue;
      }
      
      return { error: `Image upload failed: ${txt}` };
      
    } catch (error) {
      console.error(`❌ [RUNWARE] Upload error (attempt ${attempt + 1}):`, error);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
        continue;
      }
      
      return { error: `Upload failed: ${error?.message || error}` };
    }
  }
  
  return { error: "Upload failed after all retries" };
}

type Body = {
  prompt?: string;
  model?: string;                 // one of: runware-flux-dev | runware-flux-schnell | runware-flux-canny | runware-sdxl-civitai
  size?: string;                  // ignored for now; we force 512x512
  negativePrompt?: string;        // optional
  steps?: number;                 // optional; we set sane defaults per model
  n?: number;                     // ignored; we force 1 for now
  
  // Modes
  mode?: string;                  // 'text2img' | 'img2img'
  seedImage?: string;             // imageUUID | data:uri | base64 | public URL
  strength?: number;              // for img2img mode (0-1)
  CFGScale?: number;              // CFG scale parameter
  outputType?: string;            // 'URL' | 'dataURI' | 'base64Data'
  outputFormat?: string;          // 'JPG' | 'PNG' | 'WEBP'
  outputQuality?: number;         // JPG/WEBP quality
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Only POST", { status: 405, headers: CORS });

  const RUNWARE_API_KEY = Deno.env.get("RUNWARE_KEY") || "";
  if (!RUNWARE_API_KEY) {
    return new Response("Runware not configured", { status: 500, headers: CORS });
  }

  // 1) Friendly keys you expose in the app → concrete model id Runware expects.
  //    You can keep env vars, but we'll also allow literals.
  const AIR = {
    'runware-flux-dev':     Deno.env.get('RUNWARE_AIR_FLUX_DEV')    || 'runware:101@1', // FLUX dev
    'runware-flux-schnell': Deno.env.get('RUNWARE_AIR_FLUX_SCHNELL')|| 'runware:101@1', // fallback to dev if you don't have schnell AIR
    'runware-flux-canny':   Deno.env.get('RUNWARE_AIR_FLUX_CANNY')  || 'runware:104@1', // FLUX Canny
    'runware-sdxl-civitai': Deno.env.get('RUNWARE_AIR_SDXL_CIVITAI')|| 'civitai:25694@143906', // SDXL community model
  } as const;

  // Accept direct "runware:xxx@yyy" or "civitai:xxx@yyy" passthrough too.
  function resolveModelKey(requested: string): string | null {
    const mapped = AIR[requested as keyof typeof AIR];
    if (mapped) return mapped;

    if (/^(runware|civitai):\d+@\d+$/i.test(requested)) {
      return requested; // pass-through
    }
    return null;
  }

// FLUX: allow up to ~2M pixels (e.g., 1536x1024, 1024x1536, 1280x1280), snapped to ÷64.
// SDXL (Civitai): keep it ≤ 1024×1024 for best quality and speed.
function maxPixelsFor(modelKey: string) {
  const resolved = resolveModelKey(modelKey) || modelKey;
  if (/^civitai:/i.test(resolved)) return 1024 * 1024;        // SDXL: 1M pixels max
  return 2048 * 1024; // FLUX: 2,097,152 ~2M pixels max
}

  const defaultStepsMap: Record<string, number> = {
    'runware-flux-dev':     28,
    'runware-flux-schnell': 4,
    'runware-flux-canny':   24,
    'runware-sdxl-civitai': 30,
  };

  function defaultStepsFor(modelKey: string) {
    return defaultStepsMap[modelKey] ?? 28;
  }

  // Model capabilities - which models support which features
  const MODEL_CAPABILITIES = {
    'runware-flux-dev':      { text2img: true, img2img: true },
    'runware-flux-schnell':  { text2img: true, img2img: true },
    'runware-flux-canny':    { text2img: false, img2img: true }, // canny is for img2img
    'runware-sdxl-civitai':  { text2img: true, img2img: true },
  } as const;

  // Get the best model for a specific mode
  function getBestModelForMode(mode: string, preferredModel?: string): string {
    const img2imgCapableModels = Object.keys(MODEL_CAPABILITIES).filter(
      model => MODEL_CAPABILITIES[model as keyof typeof MODEL_CAPABILITIES]?.[mode as keyof typeof MODEL_CAPABILITIES[string]]
    );
    
    // If preferred model supports the mode, use it
    if (preferredModel && img2imgCapableModels.includes(preferredModel)) {
      return preferredModel;
    }
    
    // Otherwise, use the first capable model (prefer FLUX models)
    const fluxModels = img2imgCapableModels.filter(m => m.includes('flux'));
    return fluxModels[0] || img2imgCapableModels[0] || "runware-flux-dev";
  }

  let body: Body = {};
  try { body = await req.json(); } catch { 
    console.error("❌ [RUNWARE] Bad JSON received");
    return new Response("Bad JSON", { status: 400, headers: CORS }); 
  }

  console.log("📥 [RUNWARE] Received request body:", JSON.stringify(body, null, 2));
  console.log("📥 [RUNWARE] Request headers:", Object.fromEntries(req.headers.entries()));

  const prompt = String(body?.prompt || "").trim();
  const requestedModel = String(body?.model || "runware-flux-dev").trim();
  const negativePrompt = typeof body?.negativePrompt === "string" ? body.negativePrompt.trim() : "";
  const mode = String(body?.mode || "text2img").trim();
  
  // Auto-select appropriate model based on mode
  const modelKey = getBestModelForMode(mode, requestedModel);
  
  // Use the resolved model + size validation
  const resolvedModelKey = resolveModelKey(modelKey);
  if (!resolvedModelKey) {
    return new Response(`Invalid Runware model: ${modelKey}`, { status: 400, headers: CORS });
  }

  const sizeParam = String(body?.size || '1024x1024').trim();
  const m = sizeParam.match(/^(\d+)x(\d+)$/);
  if (!m) return new Response(`Invalid size: ${sizeParam}`, { status: 400, headers: CORS });
  let width  = Math.max(64, Math.min(2048, parseInt(m[1], 10)));
  let height = Math.max(64, Math.min(2048, parseInt(m[2], 10)));

  // snap to multiples of 64
  width  = Math.round(width  / 64) * 64;
  height = Math.round(height / 64) * 64;

  const total = width * height;
  const maxPx = maxPixelsFor(modelKey);
  if (total > maxPx) {
    const maxDim = Math.floor(Math.sqrt(maxPx));
    const modelName = modelKey.includes('sdxl') ? 'SDXL (Civitai)' : 'FLUX models';
    const examples = modelKey.includes('sdxl') 
      ? '1024x1024' 
      : '1536x1024, 1024x1536, 1280x1280';
    return new Response(
      `Too large for ${modelName}: ${width}x${height} (${total.toLocaleString()} pixels). Max ${maxPx.toLocaleString()} pixels (e.g., ${examples}).`,
      { status: 400, headers: CORS }
    );
  }
  
  
  // For advanced modes, prompt might be optional
  // Only require prompt for text2img mode
  // Steps/CFG defaults (leave CFG 9; tweak for canny if you like)
  const steps = Math.max(1, Math.min(100, Number(body?.steps ?? defaultStepsFor(requestedModel))));
  const cfg = Number.isFinite(body?.CFGScale) ? body.CFGScale : 9;

  // Build tasks (keep ONLY text2img & img2img)
  if (mode === 'text2img' && !prompt) {
    return new Response('Missing prompt', { status: 400, headers: CORS });
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${RUNWARE_API_KEY}`,
    'X-API-Key': RUNWARE_API_KEY,
  };

  const task: any = {
    taskUUID: crypto.randomUUID(),
    taskType: 'imageInference',
    model: resolvedModelKey,               // resolved earlier
    positivePrompt: prompt || '__BLANK__',
    ...(negativePrompt ? { negativePrompt } : {}),
    width, height,
    steps,
    CFGScale: cfg,
    outputType: body?.outputType ?? 'URL',
    outputFormat: body?.outputFormat ?? 'JPG',
    outputQuality: body?.outputQuality ?? 95,
  };

  if (mode === 'img2img') {
    if (!body?.seedImage) return new Response('Missing seedImage', { status: 400, headers: CORS });

    let seedImageUUID = body.seedImage;
    // Upload if comes as data URI/base64
    if (/^data:/i.test(seedImageUUID)) {
      const up = await uploadImageIfNeeded(seedImageUUID, headers, req.signal);
      if (up.error) return new Response(up.error, { status: 502, headers: CORS });
      seedImageUUID = up.uuid;
    }
    task.seedImage = seedImageUUID;
    task.strength  = Math.max(0, Math.min(1, body?.strength ?? 0.85));
  }
  
  const tasks = [task];

  console.log("📤 [RUNWARE] Final task to send:", JSON.stringify(task, null, 2));
  console.log("🌐 [RUNWARE] Making request to Runware API...");

  // Add retry logic for Runware API reliability
  let resp;
  let lastError;
  const maxRetries = 2;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      resp = await fetch("https://api.runware.ai/v1", {
        method: "POST",
        headers,
        body: JSON.stringify(tasks),
        signal: req.signal,
      });

      console.log(`📥 [RUNWARE] Runware response status (attempt ${attempt + 1}):`, resp.status, resp.statusText);

      if (resp.ok) {
        break; // Success, exit retry loop
      }

      const txt = await resp.text().catch(()=> "");
      console.error(`Runware error ${resp.status} ${resp.statusText} (attempt ${attempt + 1}):`, txt);
      
      lastError = { status: resp.status, statusText: resp.statusText, text: txt };
      
      // If it's a server error (5xx) and we have retries left, wait and retry
      if (resp.status >= 500 && attempt < maxRetries) {
        console.log(`🔄 [RUNWARE] Retrying in ${(attempt + 1) * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
        continue;
      }
      
      // If it's a client error (4xx) or we're out of retries, return error
      return new Response(txt || "Runware upstream error", { status: resp.status, headers: CORS });
      
    } catch (error) {
      console.error(`Runware request error (attempt ${attempt + 1}):`, error);
      lastError = error;
      
      if (attempt < maxRetries) {
        console.log(`🔄 [RUNWARE] Retrying in ${(attempt + 1) * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000));
        continue;
      }
      
      return new Response(`Runware request failed: ${error?.message || error}`, { status: 502, headers: CORS });
    }
  }

  if (!resp || !resp.ok) {
    const errorMsg = lastError?.text || lastError?.message || "Runware upstream error";
    return new Response(errorMsg, { status: lastError?.status || 502, headers: CORS });
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
    mode: mode,
    size: `${width}x${height}`,
    images,
    // Include model selection info for debugging
    modelSelection: {
      requested: requestedModel,
      selected: modelKey,
      changed: requestedModel !== modelKey,
      reason: requestedModel !== modelKey ? `Model ${requestedModel} does not support ${mode} mode` : null
    }
  }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
});

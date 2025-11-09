/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-id, x-app-version, x-device-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store"
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_KEY") || "";
const supabaseClient = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false
  },
  global: {
    headers: {
      "X-Client-Info": "images-runware-edge@1"
    }
  }
}) : null;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Helper functions
function snap64(n) {
  const r = Math.max(128, Math.min(2048, Math.round(n / 64) * 64));
  return r;
}
function with64Dims(width, height) {
  return {
    width: snap64(width),
    height: snap64(height)
  };
}
// Helper function to upload image if it's a data URI
async function uploadImageIfNeeded(imageData, headers, signal) {
  const maxRetries = 2;
  const buildImageUrl = (uuid)=>uuid ? `https://im.runware.ai/image/ii/${uuid}.jpg` : null;
  for(let attempt = 0; attempt <= maxRetries; attempt++){
    try {
      const uploadTaskUUID = crypto.randomUUID();
      const uploadTask = {
        taskUUID: uploadTaskUUID,
        taskType: "imageUpload",
        image: imageData
      };
      const uploadResp = await fetch("https://api.runware.ai/v1", {
        method: "POST",
        headers,
        body: JSON.stringify([
          uploadTask
        ]),
        signal
      });
      if (uploadResp.ok) {
        const uploadJson = await uploadResp.json();
        const uploadData = Array.isArray(uploadJson?.data) ? uploadJson.data : [];
        const uploadedImage = uploadData.find((d)=>d.taskType === "imageUpload");
        if (uploadedImage?.imageUUID) {
          const url = uploadedImage?.imageURL || uploadedImage?.imageUrl || buildImageUrl(uploadedImage.imageUUID);
          return {
            uuid: uploadedImage.imageUUID,
            url
          };
        } else {
          if (attempt < maxRetries) {
            await new Promise((resolve)=>setTimeout(resolve, (attempt + 1) * 1000));
            continue;
          }
          return {
            error: "Image upload failed - no UUID returned"
          };
        }
      }
      const txt = await uploadResp.text().catch(()=>"");
      // If it's a server error and we have retries left, wait and retry
      if (uploadResp.status >= 500 && attempt < maxRetries) {
        await new Promise((resolve)=>setTimeout(resolve, (attempt + 1) * 1000));
        continue;
      }
      return {
        error: `Image upload failed: ${txt}`
      };
    } catch (error) {
      if (attempt < maxRetries) {
        await new Promise((resolve)=>setTimeout(resolve, (attempt + 1) * 1000));
        continue;
      }
      return {
        error: `Upload failed: ${error?.message || error}`
      };
    }
  }
  return {
    error: "Upload failed after all retries"
  };
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: CORS
  });
  if (req.method !== "POST") return new Response("Only POST", {
    status: 405,
    headers: CORS
  });
  const RUNWARE_API_KEY = Deno.env.get("RUNWARE_KEY") || "";
  if (!RUNWARE_API_KEY) {
    return new Response("Runware not configured", {
      status: 500,
      headers: CORS
    });
  }
  if (!supabaseClient) {
    return new Response("Supabase not configured", {
      status: 500,
      headers: CORS
    });
  }
  // 1) Friendly keys you expose in the app → concrete model id Runware expects.
  //    You can keep env vars, but we'll also allow literals.
  const AIR = {
    'runware-flux-schnell': Deno.env.get('RUNWARE_AIR_FLUX_SCHNELL') || 'runware:101@1',
    'runware-flux-krea': Deno.env.get('RUNWARE_AIR_FLUX_KREA') || 'runware:107@1',
    'runware-qwen-image': Deno.env.get('RUNWARE_AIR_QWEN_IMAGE') || 'runware:108@20',
    'google:4@1': Deno.env.get('AIR_NANO_BANANA') || 'google:4@1'
  };
  // Accept direct "runware:xxx@yyy" or "civitai:xxx@yyy" passthrough too.
  function resolveModelKey(requested) {
    const mapped = AIR[requested];
    if (mapped) return mapped;
    if (/^(runware|civitai|google):\d+@\d+$/i.test(requested)) {
      return requested; // pass-through
    }
    return null;
  }
  // Per-model pixel limits to keep requests within provider expectations.
  function maxPixelsFor(modelKey) {
    const resolved = resolveModelKey(modelKey) || modelKey;
    if (/^google:/i.test(resolved)) return 1024 * 1024; // Nano Banana prefers ≤1M px
    if (modelKey === 'runware-qwen-image' || resolved === 'runware:106@1') {
      return 2048 * 2048; // Qwen Image supports up to ~4M px
    }
    return 2048 * 1024; // FLUX family defaults to ~2M px
  }
  const defaultStepsMap = {
    'runware-flux-schnell': 4,
    'runware-flux-krea': 25,
    'runware-qwen-image': 8,
    'google:4@1': 20
  };
  function defaultStepsFor(modelKey) {
    return defaultStepsMap[modelKey] ?? 28;
  }
  // Model capabilities - which models support which features
  const MODEL_CAPABILITIES = {
    'runware-flux-schnell': {
      text2img: true,
      img2img: false
    },
    'runware-flux-krea': {
      text2img: true,
      img2img: false
    },
    'runware-qwen-image': {
      text2img: true,
      img2img: true
    },
    'google:4@1': {
      text2img: true,
      img2img: true
    }
  };
  const MODEL_PRICING = {
    'runware-flux-schnell': 10,
    'runware-flux-krea': 50,
    'runware-qwen-image': 50,
    'google:4@1': 200
  };
  function coinsForModel(modelKey, resolvedKey) {
    const friendly = MODEL_PRICING[modelKey];
    if (friendly !== undefined) {
      return friendly;
    }
    const target = resolvedKey || resolveModelKey(modelKey) || modelKey;
    if (typeof target !== 'string') {
      return MODEL_PRICING['runware-flux-schnell'];
    }
    const lower = target.toLowerCase();
    if (lower.startsWith('runware:101@')) return MODEL_PRICING['runware-flux-schnell'];
    if (lower.startsWith('runware:107@')) return MODEL_PRICING['runware-flux-krea'];
    if (lower.startsWith('runware:108@') || lower.startsWith('runware:106@')) return MODEL_PRICING['runware-qwen-image'];
    if (lower.startsWith('google:4@')) return MODEL_PRICING['google:4@1'];
    return MODEL_PRICING['runware-flux-schnell'];
  }
  // Get the best model for a specific mode
  function getBestModelForMode(mode, preferredModel) {
    if (preferredModel && /^(runware|civitai|google):\d+@\d+$/i.test(preferredModel)) {
      return preferredModel;
    }
    const img2imgCapableModels = Object.keys(MODEL_CAPABILITIES).filter((model)=>MODEL_CAPABILITIES[model]?.[mode]);
    // If preferred model supports the mode, use it
    if (preferredModel && img2imgCapableModels.includes(preferredModel)) {
      return preferredModel;
    }
    // Otherwise, use the first capable model (prefer FLUX models)
    const fluxModels = img2imgCapableModels.filter((m)=>m.includes('flux'));
    return fluxModels[0] || img2imgCapableModels[0] || "runware-flux-schnell";
  }
  let body = {};
  try {
    body = await req.json();
  } catch  {
    return new Response(JSON.stringify({ error: 'bad_request', message: 'Image generation failed' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
  const deviceId = String(body?.deviceId || req.headers.get('x-device-id') || req.headers.get('x-client-id') || "").trim();
  if (!deviceId) {
    return new Response(JSON.stringify({ error: 'bad_request', message: 'Image generation failed' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
  const jobIdRaw = String(body?.jobId || "").trim();
  if (!UUID_RE.test(jobIdRaw)) {
    return new Response(JSON.stringify({ error: 'bad_request', message: 'Image generation failed' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
  const jobUUID = jobIdRaw;
  const prompt = String(body?.prompt || "").trim();
  const requestedModel = String(body?.model || "runware-qwen-image").trim();
  const negativePrompt = typeof body?.negativePrompt === "string" ? body.negativePrompt.trim() : "";
  const mode = String(body?.mode || "text2img").trim();
  // Auto-select appropriate model based on mode
  const selectedModelKey = getBestModelForMode(mode, requestedModel);
  const overrideQwenImg2Img = selectedModelKey === 'runware-qwen-image' && mode === 'img2img';
  const modelKey = overrideQwenImg2Img ? 'runware:106@1' : selectedModelKey;
  const isFriendlyQwen = selectedModelKey === 'runware-qwen-image';
  // Use the resolved model + size validation
  const resolvedModelKey = resolveModelKey(modelKey);
  if (!resolvedModelKey) {
    return new Response(JSON.stringify({ error: 'invalid_model', message: 'Image generation failed' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
  const coinsEstimate = coinsForModel(selectedModelKey, resolvedModelKey);
  const sizeParam = String(body?.size || '1024x1024').trim();
  const m = sizeParam.match(/^(\d+)x(\d+)$/);
  if (!m) return new Response(JSON.stringify({ error: 'invalid_size', message: 'Image generation failed' }), {
    status: 400,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
  let width = parseInt(m[1], 10);
  let height = parseInt(m[2], 10);
  const isLandscape = width > height;
  const isPortrait = height > width;
  if (selectedModelKey === 'google:4@1') {
    if (isLandscape) {
      width = 1248;
      height = 832;
    } else if (isPortrait) {
      width = 768;
      height = 1344;
    } else {
      width = Math.max(64, Math.min(1024, width));
      height = Math.max(64, Math.min(1024, height));
    }
  } else {
    width = Math.max(64, Math.min(2048, width));
    height = Math.max(64, Math.min(2048, height));
    width = Math.round(width / 64) * 64;
    height = Math.round(height / 64) * 64;
  }
  const total = width * height;
  const maxPx = maxPixelsFor(modelKey);
  const isQwenVariant = isFriendlyQwen || resolvedModelKey === 'runware:106@1';
  if (total > maxPx) {
    const modelName = (()=>{
      if (isQwenVariant) return 'Qwen Image';
      if (selectedModelKey === 'google:4@1') return 'Nano Banana';
      if (selectedModelKey?.includes?.('flux') || modelKey.includes('flux')) return 'FLUX models';
      return 'Runware model';
    })();
    const examples = (()=>{
      if (isQwenVariant) return '2048x2048, 1536x1024, 1024x1536';
      if (selectedModelKey === 'google:4@1') return '1248x832, 768x1344, 1024x1024';
      if (selectedModelKey?.includes?.('flux') || modelKey.includes('flux')) return '1536x1024, 1024x1536, 1280x1280';
      return '1024x1024';
    })();
    return new Response(JSON.stringify({ error: 'size_exceeded', message: 'Image generation failed' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
  const requestedStepsRaw = Number(body?.steps);
  const requestedCfgRaw = Number(body?.CFGScale);
  // For advanced modes, prompt might be optional
  // Only require prompt for text2img mode
  // Steps/CFG defaults (leave CFG 9; tweak for canny if you like)
  const steps = Math.max(1, Math.min(100, Number.isFinite(requestedStepsRaw) ? requestedStepsRaw : defaultStepsFor(modelKey)));
  const cfg = Number.isFinite(requestedCfgRaw) ? requestedCfgRaw : 9;
  // Build tasks (keep ONLY text2img & img2img)
  if (mode === 'text2img' && !prompt) {
    return new Response(JSON.stringify({ error: 'bad_request', message: 'Image generation failed' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${RUNWARE_API_KEY}`,
    'X-API-Key': RUNWARE_API_KEY
  };
  const numberResults = Math.max(1, Math.min(Number(body?.n ?? 1), 4));
  const outputTypeValue = Array.isArray(body?.outputType) ? body.outputType : [
    body?.outputType ?? 'URL'
  ];
  const includeCostValue = body?.includeCost === undefined ? true : !!body.includeCost;
  const schedulerValue = typeof body?.scheduler === 'string' ? body.scheduler.trim() : '';
  const accelerationValue = typeof body?.acceleration === 'string' ? body.acceleration.trim() : '';
  let task = {};
  const refs = Array.isArray(body?.referenceImages) ? body.referenceImages.filter((ref)=>typeof ref === 'string' && ref.trim().length) : [];
  if (mode === 'img2img' || isFriendlyQwen && refs.length) {
    if (!refs.length) {
      return new Response(JSON.stringify({ error: 'bad_request', message: 'Image generation failed' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }
    const processedRefs = [];
    const toRunwareUrl = (uuid)=>`https://im.runware.ai/image/ii/${uuid}.jpg`;
    for (const src of refs){
      if (/^data:/i.test(src)) {
        const up = await uploadImageIfNeeded(src, headers, req.signal);
        if (up.error) return new Response(up.error, {
          status: 502,
          headers: CORS
        });
        const refUrl = up?.url || (up?.uuid ? toRunwareUrl(up.uuid) : null);
        if (refUrl && !processedRefs.includes(refUrl)) {
          processedRefs.push(refUrl);
        } else if (up?.uuid && !processedRefs.includes(up.uuid)) {
          processedRefs.push(up.uuid);
        }
      } else if (!processedRefs.includes(src)) {
        processedRefs.push(src);
      }
    }
    if (isFriendlyQwen || resolvedModelKey === 'runware:106@1') {
      const qwenQualityRaw = Number(body?.outputQuality);
      const qwenOutputQuality = Number.isFinite(qwenQualityRaw) ? qwenQualityRaw : undefined;
      const qwenCfg = Number.isFinite(requestedCfgRaw) ? requestedCfgRaw : resolvedModelKey === 'runware:106@1' ? 2.5 : 4;
      const qwenScheduler = schedulerValue || (resolvedModelKey === 'runware:106@1' ? 'Default' : 'FlowMatchEulerDiscreteScheduler');
      const qwenTask = {
        taskUUID: crypto.randomUUID(),
        taskType: 'imageInference',
        model: resolvedModelKey,
        positivePrompt: prompt || '__BLANK__',
        ...negativePrompt ? {
          negativePrompt
        } : {},
        numberResults,
        outputFormat: body?.outputFormat ?? 'JPEG',
        width,
        height,
        CFGScale: qwenCfg,
        scheduler: qwenScheduler,
        includeCost: includeCostValue,
        checkNSFW: body?.checkNSFW === undefined ? true : !!body.checkNSFW,
        outputType: outputTypeValue,
        referenceImages: processedRefs,
        ...qwenOutputQuality !== undefined ? {
          outputQuality: qwenOutputQuality
        } : {}
      };
      if (Number.isFinite(requestedStepsRaw)) {
        qwenTask.steps = requestedStepsRaw;
      } else if (resolvedModelKey === 'runware:106@1') {
        qwenTask.steps = 28;
      }
      if (accelerationValue) {
        qwenTask.acceleration = accelerationValue;
      }
      if (body?.advancedFeatures && typeof body.advancedFeatures === 'object') {
        qwenTask.advancedFeatures = body.advancedFeatures;
      }
      task = qwenTask;
    } else if (selectedModelKey === 'google:4@1') {
      const airQualityRaw = Number(body?.outputQuality);
      const airQuality = Number.isFinite(airQualityRaw) ? airQualityRaw : undefined;
      task = {
        taskUUID: crypto.randomUUID(),
        taskType: 'imageInference',
        model: resolvedModelKey,
        positivePrompt: prompt || '__BLANK__',
        numberResults,
        outputFormat: body?.outputFormat ?? 'JPEG',
        width,
        height,
        includeCost: includeCostValue,
        outputType: outputTypeValue,
        referenceImages: processedRefs,
        ...airQuality !== undefined ? {
          outputQuality: airQuality
        } : {}
      };
      if (body?.advancedFeatures && typeof body.advancedFeatures === 'object') {
        task.advancedFeatures = body.advancedFeatures;
      }
    } else {
      task = {
        taskUUID: crypto.randomUUID(),
        taskType: 'imageInference',
        model: resolvedModelKey,
        positivePrompt: prompt || '__BLANK__',
        ...negativePrompt ? {
          negativePrompt
        } : {},
        width,
        height,
        numberResults,
        steps,
        CFGScale: cfg,
        outputFormat: body?.outputFormat ?? 'JPG',
        includeCost: includeCostValue,
        outputType: outputTypeValue,
        referenceImages: processedRefs,
        // Enforce provider-side NSFW checks for FLUX/Krea
        checkNSFW: true
      };
      if (body?.advancedFeatures && typeof body.advancedFeatures === 'object') {
        task.advancedFeatures = body.advancedFeatures;
      }
    }
  } else {
    const baseTask = {
      taskUUID: crypto.randomUUID(),
      taskType: 'imageInference',
      model: resolvedModelKey,
      positivePrompt: prompt || '__BLANK__',
      ...negativePrompt ? {
        negativePrompt
      } : {},
      width,
      height,
      numberResults,
      outputQuality: body?.outputQuality ?? 95,
      includeCost: includeCostValue,
      outputType: outputTypeValue
    };
    if (body?.checkNSFW !== undefined) {
      baseTask.checkNSFW = !!body.checkNSFW;
    }
    if (schedulerValue) {
      baseTask.scheduler = schedulerValue;
    }
    if (accelerationValue) {
      baseTask.acceleration = accelerationValue;
    }
    task = {
      ...baseTask
    };
    if (selectedModelKey === 'google:4@1') {
      task.outputFormat = body?.outputFormat ?? 'WEBP';
    } else if (isFriendlyQwen) {
      if (Number.isFinite(requestedStepsRaw)) {
        task.steps = requestedStepsRaw;
      }
      task.CFGScale = Number.isFinite(requestedCfgRaw) ? requestedCfgRaw : 4;
      task.outputFormat = body?.outputFormat ?? 'JPEG';
      if (!schedulerValue) {
        task.scheduler = 'FlowMatchEulerDiscreteScheduler';
      }
      if (accelerationValue) {
        task.acceleration = accelerationValue;
      }
      if (body?.checkNSFW === undefined) {
        task.checkNSFW = true;
      }
    } else {
      task.steps = steps;
      task.CFGScale = cfg;
      task.outputFormat = body?.outputFormat ?? 'JPG';
      // Enforce provider-side NSFW checks for FLUX/Krea text2img
      if ((selectedModelKey?.includes('flux') || selectedModelKey?.includes('krea')) && !(task as any).checkNSFW) {
        (task as any).checkNSFW = true;
      }
    }
    if (body?.advancedFeatures && typeof body.advancedFeatures === 'object') {
      task.advancedFeatures = body.advancedFeatures;
    }
  }
  let spendReceipt = {
    balance: null,
    charged: 0
  };
  if (coinsEstimate > 0) {
    try {
      const { data: spendData, error: spendError } = await supabaseClient.rpc('spend_coins', {
        p_device_id: deviceId,
        p_amount: coinsEstimate,
        p_job_id: jobUUID,
        p_source: 'app:image-gen'
      });
      if (spendError) throw spendError;
      const rows = Array.isArray(spendData) ? spendData : [
        spendData
      ];
      spendReceipt = rows[0] || {
        balance: null,
        charged: 0
      };
    } catch (err) {
      const message = String(err?.message || err);
      const insufficient = /insufficient-?coins/i.test(message) || /Not enough coins/i.test(message);
      return new Response(insufficient ? 'Not enough coins. Please top up in the Coin Store.' : 'Unable to debit coins.', {
        status: insufficient ? 402 : 500,
        headers: CORS
      });
    }
  }
  const refundCoins = async ()=>{
    if (!spendReceipt?.charged) return;
    try {
      await supabaseClient.from('coins_ledger').insert({
        device_id: deviceId,
        delta: spendReceipt.charged,
        source: 'app:refund',
        product_id: `refund:${selectedModelKey}`,
        job_id: null
      });
    } catch (refundError) {
      // swallow
    }
  };
  const tasks = [
    task
  ];
  // Add retry logic for Runware API reliability
  let resp;
  let lastError;
  const maxRetries = 2;
  for(let attempt = 0; attempt <= maxRetries; attempt++){
    try {
      resp = await fetch("https://api.runware.ai/v1", {
        method: "POST",
        headers,
        body: JSON.stringify(tasks),
        signal: req.signal
      });
      if (resp.ok) {
        break; // Success, exit retry loop
      }
      const txt = await resp.text().catch(()=>"");
      lastError = {
        status: resp.status,
        statusText: resp.statusText,
        text: txt
      };
      // If it's a server error (5xx) and we have retries left, wait and retry
      if (resp.status >= 500 && attempt < maxRetries) {
        await new Promise((resolve)=>setTimeout(resolve, (attempt + 1) * 1000));
        continue;
      }
      // If it's a client error (4xx) or we're out of retries, refund and return error
      await refundCoins();
      return new Response(JSON.stringify({ error: 'generation_failed', message: 'Image generation failed' }), {
        status: resp.status,
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise((resolve)=>setTimeout(resolve, (attempt + 1) * 1000));
        continue;
      }
      await refundCoins();
      return new Response(JSON.stringify({ error: 'generation_failed', message: 'Image generation failed' }), {
        status: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }
  }
  if (!resp || !resp.ok) {
    await refundCoins();
    return new Response(JSON.stringify({ error: 'generation_failed', message: 'Image generation failed' }), {
      status: (lastError as any)?.status || 502,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
  // Expected shape:
  // { data: [{ taskType:"imageInference", imageUUID:"...", imageURL:"https://..." } ... ] }
  let json;
  try {
    json = await resp.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'generation_failed', message: 'Image generation failed' }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
  // Treat Google/Gemini provider filtering as restricted content (refund, no images)
  const providerErrors: any[] = Array.isArray((json as any)?.errors) ? (json as any).errors : [];
  const googleFiltered = selectedModelKey === 'google:4@1' && providerErrors.some((e: any) => {
    const msg = String(e?.message || e?.responseContent || '').toLowerCase();
    return e?.code === 'invalidProviderResponse' && (msg.includes('filtered out') || msg.includes('responsible ai'));
  });
  if (googleFiltered) {
    await refundCoins();
    return new Response(
      JSON.stringify({
        error: 'restricted_content',
        userMessage: 'Restricted content blocked by safety filters. No coins were charged.',
        refund: true,
      }),
      { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
  const data = Array.isArray(json?.data) ? json.data : [];
  // Detect provider NSFW flags (FLUX/Krea return NSFWContent boolean)
  const nsfwFlag = data.some((d: any) => d?.NSFWContent === true || d?.nsfw === true || d?.nsfw_flag === true || (d?.safety && (d.safety.nsfw === true || d.safety.isAdult === true)));
  if (nsfwFlag) {
    await refundCoins();
    return new Response(
      JSON.stringify({
        error: 'restricted_content',
        userMessage: 'Restricted content blocked by safety filters. No coins were charged.',
        refund: true,
      }),
      { status: 403, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
  const images = data.map((d, i)=>{
    const url = d?.imageURL || d?.imageUrl || ""; // primary path
    const b64 = d?.imageBase64 || d?.b64_json || ""; // fallback if base64 returned
    const finalUrl = url ? url : b64 ? `data:image/jpeg;base64,${b64}` : "";
    return finalUrl ? {
      id: crypto.randomUUID(),
      url: finalUrl,
      index: i
    } : null;
  }).filter(Boolean);
  if (!images.length) {
    return new Response(JSON.stringify({ error: 'generation_failed', message: 'Image generation failed' }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
  return new Response(JSON.stringify({
    provider: "runware",
    status: "done",
    prompt,
    model: selectedModelKey,
    mode: mode,
    size: `${width}x${height}`,
    images,
    pricing: {
      coins: coinsEstimate,
      charged: spendReceipt?.charged ?? 0,
      balance: spendReceipt?.balance ?? null
    },
    // Include model selection info for debugging
    modelSelection: {
      requested: requestedModel,
      selected: selectedModelKey,
      effective: modelKey,
      resolved: resolvedModelKey,
      changed: requestedModel !== selectedModelKey,
      reason: requestedModel !== selectedModelKey ? `Model ${requestedModel} does not support ${mode} mode` : null
    }
  }), {
    status: 200,
    headers: {
      ...CORS,
      "Content-Type": "application/json"
    }
  });
});

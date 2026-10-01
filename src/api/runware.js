import { IMAGE_STUDIO_ENABLED } from '../constants/featureFlags';
import { IMAGES_RUNWARE_URL, SUPABASE_ANON_KEY } from '../config/endpoints';

/**
 * createRunwareImages
 * Always 1 image, forced 512×512 server-side for now.
 * model: "runware-flux-schnell" | "runware-flux-krea" | "runware-qwen-image" | "google:4@1"
 */
export async function createRunwareImages({
  prompt,
  model = 'runware-flux-schnell',
  size = '512x512',           // ignored by server for now, kept for symmetry
  negativePrompt = '',
  steps,
  // Advanced mode parameters
  mode = 'text2img',
  seedImage,
  maskImage,
  strength = 0.85,
  outpaint,
  guideImage,
  baseModel,
  ipAdapterModel,
  CFGScale,
  outputType = 'URL',
  outputFormat = 'JPG',
  outputQuality = 95,
  scheduler,
  includeCost,
  checkNSFW,
  acceleration,
  advancedFeatures,
  referenceImages,
  deviceId,
  jobId,
}) {
  if (!IMAGE_STUDIO_ENABLED) {
    throw new Error('Image generation is currently unavailable.');
  }
  // For advanced modes, prompt might be optional
  if (!prompt || !prompt.trim()) {
    if (mode === 'text2img') {
      throw new Error('Prompt is required');
    }
    // For other modes, prompt can be empty or "__BLANK__"
  }

  // Build headers (always include anon JWT for verify_jwt)
  const headers = {
    'Content-Type': 'application/json',
  };
  if (deviceId) {
    headers['X-Device-Id'] = String(deviceId);
    headers['X-Client-Id'] = String(deviceId);
  }
  if (SUPABASE_ANON_KEY) {
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
    headers.apikey = SUPABASE_ANON_KEY;
  }

  const requestBody = { 
    prompt: prompt.trim() || '__BLANK__', 
    model, 
    size, 
    negativePrompt, 
    steps, 
    n: 1,
    // Advanced parameters
    mode,
    seedImage,
    maskImage,
    strength,
    outpaint,
    guideImage,
    baseModel,
    ipAdapterModel,
    CFGScale,
    outputType,
    outputFormat,
    outputQuality,
    scheduler,
    includeCost,
    checkNSFW,
    acceleration,
    advancedFeatures,
    referenceImages,
    deviceId,
    jobId,
  };

  const res = await fetch(IMAGES_RUNWARE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    // Try JSON first for structured errors, then fallback to text
    let body, txt;
    const ctype = res.headers.get('content-type') || '';
    if (ctype.includes('application/json')) {
      try { body = await res.json(); } catch { body = null; }
    }
    if (!body) {
      txt = await res.text().catch(() => 'Image generation failed');
    }
    if (res.status === 402) {
      const message = body?.message || txt || 'Not enough coins available for this request.';
      const err = new Error(message);
      err.code = 'insufficient_coins';
      throw err;
    }
    if (res.status === 403) {
      const message = body?.userMessage || body?.message || txt || 'Restricted content blocked by safety filters. No coins were charged.';
      const err = new Error(message);
      err.code = body?.error || 'restricted_content';
      throw err;
    }
    const generic = body?.message || txt || 'Image generation failed';
    const err = new Error(generic);
    err.code = 'generation_failed';
    throw err;
  }

  const result = await res.json();
  
  return result; // { provider, status, prompt, model, size, images:[{id,url,index}] }
}

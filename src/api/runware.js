import { IMAGES_RUNWARE_URL, SUPABASE_ANON_KEY } from '../config/endpoints';

/**
 * createRunwareImages
 * Always 1 image, forced 512×512 server-side for now.
 * model: "runware-flux-dev" | "runware-flux-schnell" | "runware-flux-canny" | "runware-sdxl-civitai"
 */
export async function createRunwareImages({
  prompt,
  model = 'runware-flux-dev',
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
}) {
  // Starting image generation:

  // For advanced modes, prompt might be optional
  if (!prompt || !prompt.trim()) {
    if (mode === 'text2img') {
      throw new Error('Prompt is required');
    }
    // For other modes, prompt can be empty or "__BLANK__"
  }

  // Build headers (add anon key only for local dev serve)
  const headers = {
    'Content-Type': 'application/json',
  };
  if (__DEV__ && SUPABASE_ANON_KEY) {
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
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
  };

  
  const res = await fetch(IMAGES_RUNWARE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const txt = await res.text().catch(()=> 'Image generation failed');
    throw new Error(txt || 'Image generation failed');
  }

  const result = await res.json();
  
  return result; // { provider, status, prompt, model, size, images:[{id,url,index}] }
}

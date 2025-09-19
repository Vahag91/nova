import { IMAGES_RUNWARE_URL, SUPABASE_ANON_KEY } from '../config/endpoints';

/**
 * createRunwareImages
 * Always 1 image, forced 512×512 server-side for now.
 * model: "runware-flux-dev" | "runware-flux-schnell" | "runware-qwen-image" | "runware-gemini-flash"
 */
export async function createRunwareImages({
  prompt,
  model = 'runware-flux-dev',
  size = '512x512',           // ignored by server for now, kept for symmetry
  negativePrompt = '',
  steps,
}) {
  if (!prompt || !prompt.trim()) throw new Error('Prompt is required');

  // Build headers (add anon key only for local dev serve)
  const headers = {
    'Content-Type': 'application/json',
  };
  if (__DEV__ && SUPABASE_ANON_KEY) {
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  const res = await fetch(IMAGES_RUNWARE_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt: prompt.trim(), model, size, negativePrompt, steps, n: 1 }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(()=> 'Image generation failed');
    throw new Error(txt || 'Image generation failed');
  }

  return res.json(); // { provider, status, prompt, model, size, images:[{id,url,index}] }
}

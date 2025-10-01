import { IMAGES_PROXY_URL, SUPABASE_ANON_KEY } from '../config/endpoints';

export async function createImages({ prompt, model = 'gpt-image-1', size = '1024x1024', n = 2 }) {
  
  // Validate input
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    console.error('❌ [API] Prompt validation failed:', { prompt, type: typeof prompt });
    throw new Error('Prompt is required');
  }

  // Build headers (add anon key only for local dev serve)
  const headers = {
    'Content-Type': 'application/json',
  };
  if (__DEV__ && SUPABASE_ANON_KEY) {
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  } else {
  }

  const requestBody = { 
    prompt: prompt.trim(), 
    model, 
    size, 
      n: Math.max(1, Math.min(n, 4)) // Ensure n is between 1 and 4
  };
  
  console.log('📤 [API] Making request to:', IMAGES_PROXY_URL);
  console.log('📤 [API] Request headers:', headers);
  console.log('📤 [API] Request body:', requestBody);

  const res = await fetch(IMAGES_PROXY_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });
  
  console.log('📥 [API] Response status:', res.status, res.statusText);
  console.log('📥 [API] Response headers:', Object.fromEntries(res.headers.entries()));
  
  if (!res.ok) {
    const txt = await res.text().catch(()=> 'Image generation failed');
    console.error('❌ [API] Request failed:', { status: res.status, statusText: res.statusText, body: txt });
    throw new Error(txt || 'Image generation failed');
  }
  
  const json = await res.json();
  return json; // { status, prompt, model, size, images: [{id,url,index}] }
}

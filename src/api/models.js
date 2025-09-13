import { MODELS_URL } from '../config/endpoints';

export async function fetchModels({ signal } = {}) {
  try {
    const res = await fetch(MODELS_URL, { method: 'GET', signal, headers: { 'Cache-Control': 'no-store' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    // Expecting { "<model-key>": { provider, kind, caps, display:{name,group}, ... } }
    return json;
  } catch (e) {
    return null; // app will fallback to DEFAULT_MODELS
  }
}


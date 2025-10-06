const DEFAULT_MODELS = {
  'gpt-5': { provider: 'openai', kind: 'chat', caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false }, display: { name: 'GPT-5', group: 'OpenAI' } },
  'gpt-5-chat-latest': { provider: 'openai', kind: 'chat', caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false }, display: { name: 'GPT-5 Chat', group: 'OpenAI' } },
  'gpt-5-mini': { provider: 'openai', kind: 'chat', caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false }, display: { name: 'GPT-5 mini', group: 'OpenAI' } },
  'gpt-5-nano': { provider: 'openai', kind: 'chat', caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false }, display: { name: 'GPT-5 nano', group: 'OpenAI' } },
  'o4-mini': { provider: 'openai', kind: 'chat', caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false }, display: { name: 'O4 mini', group: 'OpenAI' } },
  'gpt-4.1-mini': { provider: 'openai', kind: 'chat', caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false }, display: { name: 'GPT-4.1 mini', group: 'OpenAI' } },
  'gpt-4.1-nano': { provider: 'openai', kind: 'chat', caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false }, display: { name: 'GPT-4.1 nano', group: 'OpenAI' } },
  'claude-3-haiku': { provider: 'anthropic', kind: 'chat', caps: { visionInput: false, imageGen: false, audioIn: false, audioOut: false }, display: { name: 'Claude 3 Haiku', group: 'Anthropic' }, temperatureSupported: true },
  'claude-3.7-sonnet': { provider: 'anthropic', kind: 'chat', caps: { visionInput: true, imageGen: false, audioIn: false, audioOut: false }, display: { name: 'Claude 3.7 Sonnet', group: 'Anthropic' }, temperatureSupported: true },
  'gemini-2.5-pro': { provider: 'google', kind: 'chat', caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false }, display: { name: 'Gemini 2.5 Pro', group: 'Google' }, temperatureSupported: true },

  // --- Runware Image Models ---
  'runware-flux-dev': {
    provider: 'runware',
    kind: 'image',
    caps: { visionInput: false, imageGen: true, audioIn: false, audioOut: false },
    display: { name: 'FLUX.1 dev', group: 'Runware' },
    temperatureSupported: false,
    meta: { price: 0.0038, size: '1024x1024' }, // informational only
  },

  'runware-flux-schnell': {
    provider: 'runware',
    kind: 'image',
    caps: { visionInput: false, imageGen: true, audioIn: false, audioOut: false },
    display: { name: 'FLUX.1 schnell', group: 'Runware' },
    temperatureSupported: false,
    meta: { price: 0.0013, size: '1024x1024' },
  },

  // NEW: Canny variant for structure-locked img2img
  'runware-flux-canny': {
    provider: 'runware',
    kind: 'image',
    caps: { visionInput: false, imageGen: true, audioIn: false, audioOut: false },
    display: { name: 'FLUX.1 Canny', group: 'Runware' },
    temperatureSupported: false,
    meta: { size: '1024x1024' },
  },

  // NEW: SDXL from Civitai (img2img + t2i)
  'runware-sdxl-civitai': {
    provider: 'runware',
    kind: 'image',
    caps: { visionInput: false, imageGen: true, audioIn: false, audioOut: false },
    display: { name: 'SDXL (Civitai)', group: 'Runware' },
    temperatureSupported: false,
    meta: { size: '1024x1024' }, // SDXL sweet-spot is 1024²
  },
};
export default DEFAULT_MODELS;
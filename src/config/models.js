// src/config/models.js
// Single source of truth for the app's model registry.
// ⚠️ Keep keys in sync with your Supabase MODELS registry.

const DEFAULT_MODELS = {
  // ===== OpenAI =====
  'gpt-5':            { provider: 'openai', kind: 'chat', caps: { visionInput: true,  imageGen: false, audioIn: true,  audioOut: false }, display: { name: 'GPT-5',            group: 'OpenAI' }, temperatureSupported: true },
  'gpt-5-chat-latest':{ provider: 'openai', kind: 'chat', caps: { visionInput: true,  imageGen: false, audioIn: true,  audioOut: false }, display: { name: 'GPT-5 Chat',      group: 'OpenAI' }, temperatureSupported: true },
  'gpt-5-mini':       { provider: 'openai', kind: 'chat', caps: { visionInput: true,  imageGen: false, audioIn: true,  audioOut: false }, display: { name: 'GPT-5 Mini',     group: 'OpenAI' }, temperatureSupported: true },
  'gpt-5-nano':       { provider: 'openai', kind: 'chat', caps: { visionInput: true,  imageGen: false, audioIn: true,  audioOut: false }, display: { name: 'GPT-5 Nano',     group: 'OpenAI' }, temperatureSupported: true },
  'o4-mini':          { provider: 'openai', kind: 'chat', caps: { visionInput: true,  imageGen: false, audioIn: true,  audioOut: false }, display: { name: 'O4 Mini',        group: 'OpenAI' }, temperatureSupported: true },
  'gpt-4.1-mini':     { provider: 'openai', kind: 'chat', caps: { visionInput: true,  imageGen: false, audioIn: true,  audioOut: false }, display: { name: 'GPT-4.1 Mini',   group: 'OpenAI' }, temperatureSupported: true },
  'gpt-4.1-nano':     { provider: 'openai', kind: 'chat', caps: { visionInput: true,  imageGen: false, audioIn: true,  audioOut: false }, display: { name: 'GPT-4.1 Nano',   group: 'OpenAI' }, temperatureSupported: true },

  // ===== Anthropic (Claude) =====
  'claude-3-haiku-20240307': { provider: 'anthropic', kind: 'chat', caps: { visionInput: false, imageGen: false, audioIn: false, audioOut: false }, display: { name: 'Claude 3 Haiku',   group: 'Anthropic' }, temperatureSupported: true },
  'claude-3-5-haiku-latest': { provider: 'anthropic', kind: 'chat', caps: { visionInput: false, imageGen: false, audioIn: false, audioOut: false }, display: { name: 'Claude 3.5 Haiku', group: 'Anthropic' }, temperatureSupported: true },

  // ===== Google (Gemini) =====
  'gemini-2.0-flash':   { provider: 'google', kind: 'chat', caps: { visionInput: true,  imageGen: false, audioIn: true,  audioOut: false }, display: { name: 'Gemini 2.0 Flash',  group: 'Google' },   temperatureSupported: true },
  'gemini-2.5-flash': { provider: 'google', kind: 'chat', caps: { visionInput: true,  imageGen: false, audioIn: true,  audioOut: false }, display: { name: 'Gemini 2.5 Flash',group: 'Google' },   temperatureSupported: true },

  // ===== xAI (Grok) =====
  'grok-3-mini':           { provider: 'xai', kind: 'chat', caps: { visionInput: false, imageGen: false, audioIn: false, audioOut: false }, display: { name: 'Grok 3 Mini',           group: 'xAI' }, temperatureSupported: true },
  'grok-4-fast-reasoning': { provider: 'xai', kind: 'chat', caps: { visionInput: false, imageGen: false, audioIn: false, audioOut: false }, display: { name: 'Grok 4 Fast Reasoning', group: 'xAI' }, temperatureSupported: true },

  // ===== DeepSeek =====
  'deepseek-chat': {
    provider: 'deepseek',
    kind: 'chat',
    caps: { visionInput: false, imageGen: false, audioIn: false, audioOut: false },
    display: { name: 'DeepSeek Chat', group: 'DeepSeek' },
    temperatureSupported: true,
  },
  'deepseek-reasoner': {
    provider: 'deepseek',
    kind: 'chat',
    caps: { visionInput: false, imageGen: false, audioIn: false, audioOut: false },
    display: { name: 'DeepSeek Reasoner', group: 'DeepSeek' },
    temperatureSupported: true,
  },

  // ===== Runware (images) =====
  'runware-flux-dev':     { provider: 'runware', kind: 'image', caps: { visionInput: false, imageGen: true,  audioIn: false, audioOut: false }, display: { name: 'FLUX.1 dev',      group: 'Runware' }, temperatureSupported: false, meta: { size: '1024x1024' } },
  'runware-flux-schnell': { provider: 'runware', kind: 'image', caps: { visionInput: false, imageGen: true,  audioIn: false, audioOut: false }, display: { name: 'FLUX.1 schnell',  group: 'Runware' }, temperatureSupported: false, meta: { size: '1024x1024' } },
  'runware-flux-canny':   { provider: 'runware', kind: 'image', caps: { visionInput: false, imageGen: true,  audioIn: false, audioOut: false }, display: { name: 'FLUX.1 Canny',    group: 'Runware' }, temperatureSupported: false, meta: { size: '1024x1024' } },
  'runware-sdxl-civitai': { provider: 'runware', kind: 'image', caps: { visionInput: false, imageGen: true,  audioIn: false, audioOut: false }, display: { name: 'SDXL (Civitai)',  group: 'Runware' }, temperatureSupported: false, meta: { size: '1024x1024' } },
  'google:4@1':           { provider: 'air',     kind: 'image', caps: { visionInput: false, imageGen: true,  audioIn: false, audioOut: false }, display: { name: 'Nano Banana',     group: 'AIR' },      temperatureSupported: false, meta: { size: '1024x1024' } },
};

export default DEFAULT_MODELS;

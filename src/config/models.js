// src/config/models.js
// Single source of truth for the app's model registry.
// ⚠️ Keep keys in sync with your Supabase MODELS registry.

const DEFAULT_MODELS = {
  // ===== OpenAI =====
  'gpt-5.2': { provider: 'openai', kind: 'chat', caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false }, display: { name: 'GPT-5.2', group: 'OpenAI', labels: ['NEW'] }, temperatureSupported: true },
  'gpt-5.2-chat-latest': { provider: 'openai', kind: 'chat', caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false }, display: { name: 'GPT-5.2 Chat', group: 'OpenAI', labels: ['NEW'] }, temperatureSupported: true },
  'gpt-5-nano': { provider: 'openai', kind: 'chat', caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false }, display: { name: 'GPT-5 Nano', group: 'OpenAI', labels: [] }, temperatureSupported: true },
  // ===== Anthropic (Claude) =====
  'claude-3-5-haiku-20241022': { provider: 'anthropic', kind: 'chat', caps: { visionInput: false, imageGen: false, audioIn: false, audioOut: false }, display: { name: 'Claude Haiku 4.5', group: 'Anthropic' }, temperatureSupported: true },
  'claude-sonnet-4-20250514': { provider: 'anthropic', kind: 'chat', caps: { visionInput: false, imageGen: false, audioIn: false, audioOut: false }, display: { name: 'Claude Sonnet 4.5', group: 'Anthropic' }, temperatureSupported: true },
  // ===== Google (Gemini) =====
  'gemini-2.5-flash': { provider: 'google', kind: 'chat', caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false }, display: { name: 'Gemini 2.5 Flash', group: 'Google' }, temperatureSupported: true },
  'gemini-3-pro-preview': { provider: 'google', kind: 'chat', caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false }, display: { name: 'Gemini 3 Pro', group: 'Google', labels: ['NEW'] }, temperatureSupported: true },

  // ===== xAI (Grok) =====
  'grok-3-mini': { provider: 'xai', kind: 'chat', caps: { visionInput: false, imageGen: false, audioIn: false, audioOut: false }, display: { name: 'Grok 3 Mini', group: 'xAI', labels: [] }, temperatureSupported: true },
  'grok-4-fast-reasoning': { provider: 'xai', kind: 'chat', caps: { visionInput: false, imageGen: false, audioIn: false, audioOut: false }, display: { name: 'Grok 4 Fast Reasoning', group: 'xAI', labels: ['NEW'] }, temperatureSupported: true },

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
  'runware-flux-schnell': { provider: 'runware', kind: 'image', caps: { visionInput: false, imageGen: true, audioIn: false, audioOut: false }, display: { name: 'Flux Schnell', group: 'Runware' }, temperatureSupported: false, meta: { size: '1024x1024' } },
  'runware-flux-krea': { provider: 'runware', kind: 'image', caps: { visionInput: false, imageGen: true, audioIn: false, audioOut: false }, display: { name: 'Flux Krea', group: 'Runware' }, temperatureSupported: false, meta: { size: '1024x1024' } },
  'runware-qwen-image': { provider: 'runware', kind: 'image', caps: { visionInput: false, imageGen: true, audioIn: false, audioOut: false }, display: { name: 'Qwen Aura', group: 'Runware' }, temperatureSupported: false, meta: { size: '1024x1024' } },
  'google:4@1': { provider: 'air', kind: 'image', caps: { visionInput: false, imageGen: true, audioIn: false, audioOut: false }, display: { name: 'Nano Banana', group: 'AIR' }, temperatureSupported: false, meta: { size: '1024x1024' } },
};

export default DEFAULT_MODELS;

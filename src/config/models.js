// Shared model registries.
// Chat models may be refreshed from backend.
// Image models stay local to the app and should not be overridden by backend data.

export const DEFAULT_CHAT_MODEL = 'gpt-5.6-luna';

export const LEGACY_CHAT_MODEL_ALIASES = {
  'gpt-5.5': 'gpt-5.6-sol',
  'gpt-5.3chat-latest': 'gpt-5.6-terra',
  'gpt-5.2': 'gpt-5.6-sol',
  'gpt-5.2-chat-latest': 'gpt-5.6-terra',
  'gpt-5.4-nano': DEFAULT_CHAT_MODEL,
  'claude-3-haiku': 'claude-fable-5',
  'claude-3.7-sonnet': 'claude-sonnet-5',
  'claude-3-5-haiku-20241022': 'claude-fable-5',
  'claude-sonnet-4-20250514': 'claude-sonnet-5',
  'gemini-2.5-Flash': 'gemini-3.7-flash',
  'gemini-2.5-flash': 'gemini-3.7-flash',
  'gemini-2.0-flash': 'gemini-3.7-flash',
  'gemini-3-pro-preview': 'gemini-3.1-pro-preview',
  'grok-3-mini': 'grok-4.6',
  'grok-4': 'grok-4.6',
  'grok-4-fast-reasoning': 'grok-4.6',
  'deepseek-chat': 'deepseek-v4-flash',
  'deepseek-reasoner': 'deepseek-v4-pro',
};

export const DEFAULT_CHAT_MODELS = {
  'gpt-5.6-sol': {
    provider: 'openai',
    kind: 'chat',
    caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false },
    display: {
      name: 'GPT-5.6 Sol',
      group: 'OpenAI',
      labels: ['NEW', 'BEST'],
      description: 'Most powerful GPT-5.6 model',
    },
    temperatureSupported: true,
  },
  'gpt-5.6-terra': {
    provider: 'openai',
    kind: 'chat',
    caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false },
    display: {
      name: 'GPT-5.6 Terra',
      group: 'OpenAI',
      labels: ['NEW'],
      description: 'Balanced GPT-5.6 model',
    },
    temperatureSupported: true,
  },
  'gpt-5.6-luna': {
    provider: 'openai',
    kind: 'chat',
    caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false },
    display: {
      name: 'GPT-5.6 Luna',
      group: 'OpenAI',
      labels: ['NEW'],
      description: 'Fast model for everyday tasks',
    },
    temperatureSupported: true,
  },
  'claude-fable-5': {
    provider: 'anthropic',
    kind: 'chat',
    caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false },
    display: { name: 'Claude Fable 5', group: 'Anthropic', description: 'Fast and creative Anthropic AI' },
    temperatureSupported: true,
  },
  'claude-sonnet-5': {
    provider: 'anthropic',
    kind: 'chat',
    caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false },
    display: { name: 'Claude Sonnet 5', group: 'Anthropic', labels: ['NEW'], description: 'Advanced Anthropic model' },
    temperatureSupported: true,
  },
  'gemini-3.7-flash': {
    provider: 'google',
    kind: 'chat',
    caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false },
    display: { name: 'Gemini 3.7 Flash', group: 'Google', labels: ['NEW'], description: 'Fast Google AI model' },
    temperatureSupported: true,
  },
  'gemini-3.1-pro-preview': {
    provider: 'google',
    kind: 'chat',
    caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false },
    display: { name: 'Gemini 3.1 Pro', group: 'Google', labels: ['NEW'], description: "Google's advanced Pro model" },
    temperatureSupported: true,
  },
  'grok-4.6': {
    provider: 'xai',
    kind: 'chat',
    caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false },
    display: { name: 'Grok 4.6', group: 'xAI', labels: ['NEW'], description: "xAI's newest displayed model" },
    temperatureSupported: true,
  },
  'deepseek-v4-pro': {
    provider: 'deepseek',
    kind: 'chat',
    caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false },
    display: { name: 'DeepSeek V4 Pro', group: 'DeepSeek', labels: ['NEW'], description: 'Advanced DeepSeek model' },
    temperatureSupported: true,
  },
  'deepseek-v4-flash': {
    provider: 'deepseek',
    kind: 'chat',
    caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false },
    display: { name: 'DeepSeek V4 Flash', group: 'DeepSeek', description: 'Fast DeepSeek model' },
    temperatureSupported: true,
  },
};

export const DEFAULT_IMAGE_MODELS = {
  'runware-flux-schnell': {
    provider: 'runware',
    kind: 'image',
    caps: { visionInput: false, imageGen: true, audioIn: false, audioOut: false },
    display: { name: 'Flux Schnell', group: 'Runware' },
    temperatureSupported: false,
    meta: { size: '1024x1024' },
  },
  'runware-flux-krea': {
    provider: 'runware',
    kind: 'image',
    caps: { visionInput: false, imageGen: true, audioIn: false, audioOut: false },
    display: { name: 'Flux Krea', group: 'Runware' },
    temperatureSupported: false,
    meta: { size: '1024x1024' },
  },
  'runware-qwen-image': {
    provider: 'runware',
    kind: 'image',
    caps: { visionInput: false, imageGen: true, audioIn: false, audioOut: false },
    display: { name: 'Qwen Aura', group: 'Runware' },
    temperatureSupported: false,
    meta: { size: '1024x1024' },
  },
  'google:4@1': {
    provider: 'air',
    kind: 'image',
    caps: { visionInput: false, imageGen: true, audioIn: false, audioOut: false },
    display: { name: 'Nano Banana Pro', group: 'AIR' },
    temperatureSupported: false,
    meta: { size: '1024x1024' },
  },
};

export const DEFAULT_MODELS = {
  ...DEFAULT_CHAT_MODELS,
  ...DEFAULT_IMAGE_MODELS,
};

export function getImageModelsRegistry() {
  return DEFAULT_IMAGE_MODELS;
}

export function buildModelRegistry(incoming) {
  const isValidIncoming =
    incoming &&
    typeof incoming === 'object' &&
    !Array.isArray(incoming) &&
    Object.keys(incoming).length > 0;

  if (!isValidIncoming) {
    return DEFAULT_MODELS;
  }

  // The production models endpoint may still contain legacy display IDs.
  // Keep this app release on the v2 allowlist and merge only matching metadata.
  const remoteChatModels = Object.fromEntries(
    Object.entries(incoming)
      .filter(([key, model]) => (
        Object.prototype.hasOwnProperty.call(DEFAULT_CHAT_MODELS, key) &&
        model &&
        typeof model === 'object' &&
        (model.kind === 'chat' || model?.caps?.imageGen !== true)
      ))
      .map(([key, model]) => {
        const local = DEFAULT_CHAT_MODELS[key];
        return [key, {
          ...local,
          ...model,
          caps: { ...local.caps, ...(model.caps || {}) },
          display: { ...local.display, ...(model.display || {}) },
        }];
      }),
  );

  return {
    ...DEFAULT_CHAT_MODELS,
    ...remoteChatModels,
    ...DEFAULT_IMAGE_MODELS,
  };
}

export function normalizeChatModelKey(modelKey, fallback = DEFAULT_CHAT_MODEL) {
  const key = typeof modelKey === 'string' ? modelKey.trim() : '';
  if (Object.prototype.hasOwnProperty.call(DEFAULT_CHAT_MODELS, key)) {
    return key;
  }
  return LEGACY_CHAT_MODEL_ALIASES[key] || fallback;
}

export default DEFAULT_MODELS;

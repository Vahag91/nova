// Shared model registries.
// Chat models may be refreshed from backend.
// Image models stay local to the app and should not be overridden by backend data.

export const DEFAULT_CHAT_MODELS = {
  'gpt-5.2': {
    provider: 'openai',
    kind: 'chat',
    caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false },
    display: { name: 'GPT-5.2', group: 'OpenAI', labels: ['NEW'] },
    temperatureSupported: true,
  },
  'gpt-5.2-chat-latest': {
    provider: 'openai',
    kind: 'chat',
    caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false },
    display: { name: 'GPT-5.2 Chat', group: 'OpenAI', labels: ['NEW'] },
    temperatureSupported: true,
  },
  'gpt-5.4-nano': {
    provider: 'openai',
    kind: 'chat',
    caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false },
    display: { name: 'GPT-5.4 Nano', group: 'OpenAI', labels: [] },
    temperatureSupported: true,
  },
  'claude-3-5-haiku-20241022': {
    provider: 'anthropic',
    kind: 'chat',
    caps: { visionInput: false, imageGen: false, audioIn: false, audioOut: false },
    display: { name: 'Claude Haiku 4.5', group: 'Anthropic' },
    temperatureSupported: true,
  },
  'claude-sonnet-4-20250514': {
    provider: 'anthropic',
    kind: 'chat',
    caps: { visionInput: false, imageGen: false, audioIn: false, audioOut: false },
    display: { name: 'Claude Sonnet 4.5', group: 'Anthropic' },
    temperatureSupported: true,
  },
  'gemini-2.5-flash': {
    provider: 'google',
    kind: 'chat',
    caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false },
    display: { name: 'Gemini 2.5 Flash', group: 'Google' },
    temperatureSupported: true,
  },
  'gemini-3-pro-preview': {
    provider: 'google',
    kind: 'chat',
    caps: { visionInput: true, imageGen: false, audioIn: true, audioOut: false },
    display: { name: 'Gemini 3 Pro', group: 'Google', labels: ['NEW'] },
    temperatureSupported: true,
  },
  'grok-3-mini': {
    provider: 'xai',
    kind: 'chat',
    caps: { visionInput: false, imageGen: false, audioIn: false, audioOut: false },
    display: { name: 'Grok 3 Mini', group: 'xAI', labels: [] },
    temperatureSupported: true,
  },
  'grok-4-fast-reasoning': {
    provider: 'xai',
    kind: 'chat',
    caps: { visionInput: false, imageGen: false, audioIn: false, audioOut: false },
    display: { name: 'Grok 4 Fast Reasoning', group: 'xAI', labels: ['NEW'] },
    temperatureSupported: true,
  },
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

  const remoteChatModels = Object.fromEntries(
    Object.entries(incoming).filter(([, model]) => {
      if (!model || typeof model !== 'object') return false;
      return model.kind === 'chat' || model?.caps?.imageGen !== true;
    }),
  );

  return {
    ...remoteChatModels,
    ...DEFAULT_IMAGE_MODELS,
  };
}

export default DEFAULT_MODELS;

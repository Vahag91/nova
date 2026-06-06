import features from '../config/features';

const IMAGE_MODEL_PRICES = {
  'runware-flux-schnell': 10,
  'runware-flux-krea': 50,
  'runware-qwen-image': 50,
  'klingai:kling-image@o1': 50,
  'google:4@1': 100,
};

const RESOLVED_MODEL_FALLBACKS = [
  { test: /^runware:101@/i, key: 'runware-flux-schnell' },
  { test: /^runware:107@/i, key: 'runware-flux-krea' },
  { test: /^runware:108@/i, key: 'runware-qwen-image' },
  { test: /^runware:106@/i, key: 'runware-qwen-image' },
  { test: /^klingai:kling-image@o1$/i, key: 'klingai:kling-image@o1' },
  { test: /^google:4@/i, key: 'google:4@1' },
];

const DEFAULT_MODEL_KEY = 'runware-flux-schnell';

export function getImageModelPrice(modelKey) {
  if (features.zeroImageModelCosts) {
    return 0;
  }

  if (!modelKey || typeof modelKey !== 'string') {
    return IMAGE_MODEL_PRICES[DEFAULT_MODEL_KEY];
  }

  const key = modelKey.trim();
  if (Object.prototype.hasOwnProperty.call(IMAGE_MODEL_PRICES, key)) {
    return IMAGE_MODEL_PRICES[key];
  }

  const fallback = RESOLVED_MODEL_FALLBACKS.find(({ test }) => test.test(key));
  if (fallback) {
    return IMAGE_MODEL_PRICES[fallback.key];
  }

  return IMAGE_MODEL_PRICES[DEFAULT_MODEL_KEY];
}

export { IMAGE_MODEL_PRICES };

// Chat model pricing (coins per message)
// For now, all chat models are free (0 coins)
// This can be updated later if chat models require coins

const CHAT_MODEL_PRICES = {
  // Free models
  'gpt-5.6-luna': 0,
  // Premium models - could add pricing here later
  'gpt-5.6-sol': 0,
  'gpt-5.6-terra': 0,
  'claude-fable-5': 0,
  'claude-sonnet-5': 0,
  'gemini-3.7-flash': 0,
  'gemini-3.1-pro-preview': 0,
  'grok-4.6': 0,
  'deepseek-v4-pro': 0,
  'deepseek-v4-flash': 0,
};

const DEFAULT_CHAT_MODEL_COST = 0;

export function getChatModelPrice(modelKey) {
  if (!modelKey || typeof modelKey !== 'string') {
    return DEFAULT_CHAT_MODEL_COST;
  }

  const key = modelKey.trim();
  if (Object.prototype.hasOwnProperty.call(CHAT_MODEL_PRICES, key)) {
    return CHAT_MODEL_PRICES[key];
  }

  // Default to free for unknown models
  return DEFAULT_CHAT_MODEL_COST;
}

export { CHAT_MODEL_PRICES };


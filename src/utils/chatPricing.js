// Chat model pricing (coins per message)
// For now, all chat models are free (0 coins)
// This can be updated later if chat models require coins

const CHAT_MODEL_PRICES = {
  // Free models
  'gpt-5.4-nano': 0,
  // Premium models - could add pricing here later
  'gpt-5': 0,
  'gpt-5-chat-latest': 0,
  'gpt-5-mini': 0,
  'o4-mini': 0,
  'gpt-4.1-mini': 0,
  'claude-3-haiku': 0,
  'claude-3.7-sonnet': 0,
  'gemini-2.5-Flash': 0,
  'gemini-2.5-flash': 0,
  'gemini-2.0-flash': 0,
  'grok-4': 0,
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


// Premium configuration
// Defines which models and features require premium

// The ONLY free model - all others require premium
export const FREE_MODEL = 'gpt-5.4-nano';

// Check if a model requires premium
export function isPremiumModel(modelKey) {
  if (!modelKey) return false;
  return modelKey !== FREE_MODEL;
}

// Check if assistants require premium (all assistants require premium)
export function isAssistantsPremium() {
  return true; // All assistants require premium
}


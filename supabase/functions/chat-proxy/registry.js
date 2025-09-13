export const MODELS = {
  // --- OpenAI ---
  "gpt-4o-mini": {
    provider: "openai",
    kind: "chat",
    caps: { text: true, image: false, audio: false, video: false },
    context: 128000,
    price: { in: 0.15, out: 0.60 },
    display: { name: "GPT-4o mini", group: "OpenAI" },
  },
  "gpt-4o": {
    provider: "openai",
    kind: "chat",
    caps: { text: true, image: true, audio: true, video: false },
    context: 128000,
    price: { in: 5.0, out: 15.0 },
    display: { name: "GPT-4o", group: "OpenAI" },
  },

  // --- Anthropic (examples for later) ---
  "claude-3.7-sonnet": {
    provider: "anthropic",
    kind: "chat",
    caps: { text: true, image: true, audio: false, video: false },
    context: 200000,
    price: { in: 3.0, out: 15.0 },
    display: { name: "Claude 3.7 Sonnet", group: "Anthropic" },
  },
  "claude-3-haiku": {
    provider: "anthropic",
    kind: "chat",
    caps: { text: true, image: false, audio: false, video: false },
    context: 200000,
    price: { in: 0.25, out: 1.25 },
    display: { name: "Claude 3 Haiku", group: "Anthropic" },
  },

  // --- Google (example for later) ---
  "gemini-2.5-pro": {
    provider: "google",
    kind: "chat",
    caps: { text: true, image: true, audio: true, video: false },
    context: 1000000,
    price: { in: 0.5, out: 1.5 },
    display: { name: "Gemini 2.5 Pro", group: "Google" },
  },
};

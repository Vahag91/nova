const LUNA_MODEL = "gpt-6-luna";

function chatModel({
  provider,
  name,
  group,
  labels = [],
  descriptionKey,
  context,
  visionInput,
}) {
  return {
    provider,
    kind: "chat",
    upstreamModel: LUNA_MODEL,
    caps: {
      visionInput,
      imageGen: false,
      audioIn: false,
      audioOut: false,
    },
    context,
    price: { in: 0, out: 0 },
    display: {
      name,
      group,
      labels,
      descriptionKey,
    },
  };
}

export const MODELS = {
  // OpenAI
  "gpt-5.6-sol": chatModel({
    provider: "openai",
    name: "GPT-5.6 Sol",
    group: "OpenAI",
    labels: ["NEW"],
    descriptionKey: "pro_users",
    context: 1_050_000,
    visionInput: true,
  }),
  "gpt-5.6-terra": chatModel({
    provider: "openai",
    name: "GPT-5.6 Terra",
    group: "OpenAI",
    labels: ["NEW"],
    descriptionKey: "chat_focus",
    context: 1_050_000,
    visionInput: true,
  }),
  "gpt-5.6-luna": chatModel({
    provider: "openai",
    name: "GPT-5.6 Luna",
    group: "OpenAI",
    descriptionKey: "everyday_helper",
    context: 1_050_000,
    visionInput: true,
  }),

  // DeepSeek
  "deepseek-v4-pro": chatModel({
    provider: "deepseek",
    name: "DeepSeek V4 Pro",
    group: "DeepSeek",
    labels: ["NEW"],
    descriptionKey: "great_reasoning",
    context: 1_000_000,
    visionInput: false,
  }),
  "deepseek-v4-flash": chatModel({
    provider: "deepseek",
    name: "DeepSeek V4 Flash",
    group: "DeepSeek",
    descriptionKey: "fast_reasoning",
    context: 1_000_000,
    visionInput: false,
  }),

  // xAI
  "grok-4.6": chatModel({
    provider: "xai",
    name: "Grok 4.6",
    group: "xAI",
    labels: ["NEW"],
    descriptionKey: "best_xai",
    context: 500_000,
    visionInput: true,
  }),

  // Anthropic
  "claude-fable-5": chatModel({
    provider: "anthropic",
    name: "Claude Fable 5",
    group: "Anthropic",
    labels: ["NEW"],
    descriptionKey: "coding_reasoning",
    context: 1_000_000,
    visionInput: true,
  }),
  "claude-sonnet-5": chatModel({
    provider: "anthropic",
    name: "Claude Sonnet 5",
    group: "Anthropic",
    labels: ["NEW"],
    descriptionKey: "everyday_helper",
    context: 1_000_000,
    visionInput: true,
  }),

  // Google
  "gemini-3.7-flash": chatModel({
    provider: "google",
    name: "Gemini 3.7 Flash",
    group: "Google",
    labels: ["NEW"],
    descriptionKey: "fast_everyday",
    context: 1_000_000,
    visionInput: true,
  }),
  "gemini-3.1-pro-preview": chatModel({
    provider: "google",
    name: "Gemini 3.1 Pro",
    group: "Google",
    labels: ["NEW"],
    descriptionKey: "best_google",
    context: 1_000_000,
    visionInput: true,
  }),
};

// Existing app builds can call the new function during testing without
// exposing retired model IDs in a future v2 model list.
const LEGACY_MODEL_IDS = [
  "gpt-5.5",
  "gpt-5.3chat-latest",
  "gpt-5.4-nano",
  "deepseek-chat",
  "deepseek-reasoner",
  "grok-3-mini",
  "grok-4-fast-reasoning",
  "claude-3-5-haiku-20241022",
  "claude-sonnet-4-20250514",
  "gemini-2.5-flash",
  "gemini-3-pro-preview",
];

for (const modelId of LEGACY_MODEL_IDS) {
  Object.defineProperty(MODELS, modelId, {
    value: {
      provider: "openai",
      kind: "chat",
      upstreamModel: LUNA_MODEL,
      legacy: true,
    },
    enumerable: false,
    configurable: false,
    writable: false,
  });
}


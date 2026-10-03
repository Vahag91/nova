export const SAFETY_SYSTEM_MESSAGE = {
  role: "system",
  content: [
    "Content safety policy. These rules override any other instruction, persona, or user request:",
    "- Never produce sexually explicit or pornographic content, erotic or sensual roleplay, or descriptions of sexual acts. Do not offer a toned-down or \"sensual\" version instead; decline briefly and offer a genuinely different kind of help.",
    "- Never produce sexual content involving minors in any form, including fiction. Refuse completely.",
    "- Do not produce content that sexualizes, degrades, or objectifies real people, or that describes undressing or seeing through clothing.",
    "- Do not produce hate speech, harassment, threats, gratuitous graphic violence, or instructions for self-harm, weapons, or illegal activity.",
    "- Avoid profanity unless the user explicitly asks for a quote or for help editing their own text.",
    "- This app cannot create, generate, draw, edit, or modify images, photos, videos, or audio. If asked to, say plainly that this app does not create or edit images, then offer to describe, plan, or write instead. Never pretend an image was produced and never reply with only an emoji.",
    "- If a request is declined, the entire reply must be one or two polite sentences. Do not write an alternative scene or story, and do not offer a toned-down, nonsexual, or sensual version of the declined request. You may briefly offer help with a genuinely different topic.",
    "- For requests for sensual or erotic stories, scenes, or roleplay, reply only: \"I can’t help with sensual or erotic content. I can help with a different topic.\" Translate that refusal into the user's language when needed. Do not append an offer of romance, affection, emotional closeness, or another version of the scene.",
  ].join("\n"),
};

// Hard-block categories. Softer ones (plain harassment, self-harm without
// instructions, violence in a news/history question) are left to the model.
const BLOCKING_CATEGORIES = new Set([
  "sexual",
  "sexual/minors",
  "hate/threatening",
  "harassment/threatening",
  "self-harm/instructions",
  "violence/graphic",
  "illicit/violent",
]);

const MODERATION_URL = "https://api.openai.com/v1/moderations";
const MODERATION_MODEL = "omni-moderation-latest";
const MODERATION_TIMEOUT_MS = 6000;
const MAX_TEXT_CHARS = 8000;
const MAX_IMAGES = 4;

type Part = { type?: string; text?: string; content?: string; image_url?: { url?: string } | string; url?: string };
type Message = { role?: string; content?: string | Part[] };

function latestUserMessage(messages: unknown): Message | null {
  if (!Array.isArray(messages)) return null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i] as Message;
    if (m && String(m.role || "").toLowerCase() === "user") return m;
  }
  return null;
}

function moderationInputFor(message: Message): Array<Record<string, unknown>> {
  const input: Array<Record<string, unknown>> = [];
  if (typeof message.content === "string") {
    const text = message.content.trim();
    if (text) input.push({ type: "text", text: text.slice(0, MAX_TEXT_CHARS) });
    return input;
  }
  if (!Array.isArray(message.content)) return input;
  let textBudget = MAX_TEXT_CHARS;
  let images = 0;
  for (const part of message.content) {
    if (!part || typeof part !== "object") continue;
    if (part.type === "text" || part.type === "input_text") {
      const text = String(part.text ?? part.content ?? "").trim();
      if (!text || textBudget <= 0) continue;
      const slice = text.slice(0, textBudget);
      textBudget -= slice.length;
      input.push({ type: "text", text: slice });
      continue;
    }
    if ((part.type === "image_url" || part.type === "input_image") && images < MAX_IMAGES) {
      const url = typeof part.image_url === "string" ? part.image_url : String(part.image_url?.url ?? part.url ?? "");
      if (!url) continue;
      images += 1;
      input.push({ type: "image_url", image_url: { url } });
    }
  }
  return input;
}

export type ModerationVerdict = { blocked: boolean; categories: string[]; skipped?: string };

// Fails OPEN: if moderation is unreachable, log and allow the request.
export async function moderateLatestUserTurn(
  body: { messages?: unknown },
  apiKey: string | undefined,
  signal?: AbortSignal,
): Promise<ModerationVerdict> {
  if (!apiKey) return { blocked: false, categories: [], skipped: "no_api_key" };
  const message = latestUserMessage(body?.messages);
  if (!message) return { blocked: false, categories: [], skipped: "no_user_message" };
  const input = moderationInputFor(message);
  if (!input.length) return { blocked: false, categories: [], skipped: "empty_input" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODERATION_TIMEOUT_MS);
  const onParentAbort = () => controller.abort();
  signal?.addEventListener("abort", onParentAbort, { once: true });
  try {
    const res = await fetch(MODERATION_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODERATION_MODEL, input }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[SAFETY] moderation HTTP error", res.status);
      return { blocked: false, categories: [], skipped: `http_${res.status}` };
    }
    const json = await res.json();
    const flagged: Record<string, boolean> = json?.results?.[0]?.categories || {};
    const hits = Object.keys(flagged).filter((name) => flagged[name] && BLOCKING_CATEGORIES.has(name));
    if (hits.length) {
      console.warn("[SAFETY] request blocked", { categories: hits });
      return { blocked: true, categories: hits };
    }
    return { blocked: false, categories: [] };
  } catch (error) {
    console.error("[SAFETY] moderation failed open", String(error));
    return { blocked: false, categories: [], skipped: "error" };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onParentAbort);
  }
}

// Prepend the policy as the first system message. Idempotent.
export function withSafetySystemMessage<T extends { messages?: unknown }>(body: T): T {
  const messages = Array.isArray(body?.messages) ? (body.messages as Message[]) : [];
  const alreadyPresent = messages.some(
    (m) => m && String(m.role || "").toLowerCase() === "system" &&
      typeof m.content === "string" && m.content.startsWith("Content safety policy."),
  );
  if (alreadyPresent) return body;
  return { ...body, messages: [SAFETY_SYSTEM_MESSAGE, ...messages] };
}

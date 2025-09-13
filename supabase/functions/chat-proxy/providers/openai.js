export async function openaiChatStream({ body, signal, apiKey }) {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: body.model,
      stream: true,
      temperature: body.temperature ?? 0.7,
      messages: (body.messages ?? []).map(m => ({ role: m.role, content: m.content })),
    }),
    signal,
  });
}

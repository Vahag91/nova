import { Buffer } from "node:buffer";
import {
  analysisInstructions,
  fail,
  normalizeResult,
  RESULT_SCHEMA,
} from "./contracts.js";

export async function analyze(
  source: any,
  documents: any[],
  file: File | null,
  signal: AbortSignal,
) {
  const audiovisual = source.type === "youtube" || source.type === "upload";
  const textKey = Deno.env.get("OPENAI_API_KEY");
  const videoKey = Deno.env.get("GEMINI_API_KEY") ||
    Deno.env.get("GOOGLE_API_KEY");
  if (audiovisual ? !videoKey : !textKey) {
    throw fail(audiovisual ? "VIDEO_NOT_CONFIGURED" : "NOT_CONFIGURED", 503);
  }
  const instruction = analysisInstructions(source);
  let request: any;
  let url: string;
  let headers: any;
  if (!audiovisual) {
    const inputs = source.type === "transcript"
      ? [{ sourceIndex: 0, name: "Transcript", text: source.transcript }]
      : documents.map((doc, index) => ({
        sourceIndex: index,
        name: doc.name,
        text: doc.extracted_text,
      }));
    url = "https://api.openai.com/v1/responses";
    headers = {
      Authorization: `Bearer ${textKey}`,
      "Content-Type": "application/json",
    };
    const configuredModel = Deno.env.get("SOURCE_TEXT_MODEL");
    request = {
      model: !configuredModel || configuredModel === "gpt-5.6-luna"
        ? "gpt-6-luna"
        : configuredModel,
      store: false,
      instructions: instruction,
      input: [{
        role: "user",
        content: [{ type: "input_text", text: JSON.stringify(inputs) }],
      }],
      max_output_tokens: 7000,
      text: {
        format: {
          type: "json_schema",
          name: "source_brief",
          strict: true,
          schema: RESULT_SCHEMA,
        },
      },
    };
  } else {
    // Clip at ten minutes explicitly, and report partial coverage to the user.
    const video = source.type === "youtube"
      ? { fileData: { fileUri: source.url } }
      : {
        inlineData: {
          mimeType: file!.type,
          data: Buffer.from(await file!.arrayBuffer()).toString("base64"),
        },
      };
    url = `https://generativelanguage.googleapis.com/v1beta/models/${
      Deno.env.get("SOURCE_ANALYSIS_MODEL") || "gemini-3.7-flash"
    }:generateContent`;
    headers = {
      "x-goog-api-key": videoKey,
      "Content-Type": "application/json",
    };
    request = {
      store: false,
      systemInstruction: { parts: [{ text: instruction }] },
      contents: [{
        role: "user",
        parts: [{ ...video, videoMetadata: { endOffset: "600s", fps: 1 } }, {
          text: source.question || "Summarize this video, including the speech and visible scenes.",
        }],
      }],
      generationConfig: {
        mediaResolution: "MEDIA_RESOLUTION_LOW",
        maxOutputTokens: 7000,
        responseMimeType: "application/json",
        responseJsonSchema: RESULT_SCHEMA,
      },
    };
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
    signal,
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    // Provider diagnostics contain no request body; redact credentials and URLs defensively.
    const diagnostic = String(failure?.error?.message || "").split(
      textKey || "__no_text_key__",
    ).join("[redacted]").split(videoKey || "__no_video_key__").join(
      "[redacted]",
    ).replace(/https?:\/\/\S+/g, "[url]").slice(0, 350);
    console.warn(
      "[source-analyze] provider status",
      response.status,
      diagnostic,
    );
    // A context overflow is a size problem the user can act on, not an
    // inaccessible source.
    const overflow = !audiovisual && response.status === 400 && (
      failure?.error?.code === "context_length_exceeded" ||
      /context (window|length)|too (long|large)|maximum (context|input)|exceeds? the/i
        .test(String(failure?.error?.message || ""))
    );
    if (overflow) throw fail("SOURCES_TOO_LARGE", 413);
    throw fail(
      response.status === 429
        ? "SERVICE_BUSY"
        : response.status >= 500
        ? "PROVIDER_UNAVAILABLE"
        : "SOURCE_UNAVAILABLE",
      response.status === 429 ? 429 : 502,
    );
  }
  const payload = await response.json();
  if (!audiovisual) {
    console.info("[source-analyze] text usage", JSON.stringify({
      model: payload.model,
      status: payload.status,
      inputTokens: payload.usage?.input_tokens,
      outputTokens: payload.usage?.output_tokens,
    }));
  }
  if (!audiovisual && payload.status !== "completed") {
    throw fail("INVALID_RESULT", 502);
  }
  if (audiovisual && payload.candidates?.[0]?.finishReason !== "STOP") {
    throw fail("INVALID_RESULT", 502);
  }
  const output = audiovisual
    ? payload.candidates[0].content?.parts?.filter((p) => !p.thought).map((p) => p.text || "").join("")
    : (payload.output || []).flatMap((item) => item.content || []).filter((p) =>
      p.type === "output_text"
    ).map((p) => p.text).join("");
  let raw;
  try {
    raw = JSON.parse(output);
  } catch {
    throw fail("INVALID_RESULT", 502);
  }
  const result = normalizeResult(raw, source, documents);
  if (audiovisual) {
    result.sections = result.sections.map((section) => ({
      ...section,
      startSeconds: section.startSeconds > 600 ? null : section.startSeconds,
    }));
    result.coverage = { ...result.coverage, kind: "audiovisual", maxVideoSeconds: 600 };
    console.info("[source-analyze] video usage", JSON.stringify({model:payload.modelVersion,inputTokens:payload.usageMetadata?.promptTokenCount,outputTokens:payload.usageMetadata?.candidatesTokenCount,thinkingTokens:payload.usageMetadata?.thoughtsTokenCount}));
  }
  return result;
}

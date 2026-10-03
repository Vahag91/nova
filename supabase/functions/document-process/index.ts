import { DocumentError, extractDocument, MAX_FILE_BYTES } from "./extract.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-id, x-app-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function fail(code, message, status = 400) {
  return jsonResponse({ error: message, message, code }, status);
}

function safeName(value) {
  const withoutControlCharacters = Array.from(String(value || "document"))
    .map((character) => (character.charCodeAt(0) < 32 ? "_" : character))
    .join("");
  const cleaned = withoutControlCharacters
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "document";
  if (cleaned.length <= 120) return cleaned;
  const suffix = cleaned.match(/(\.[a-z0-9]{1,10})$/i)?.[1] || "";
  return `${cleaned.slice(0, 120 - suffix.length)}${suffix}`;
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function insertDocument(row) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase document storage is not configured.");
  }
  const response = await fetch(`${supabaseUrl}/rest/v1/chat_documents`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    console.error("[DOCUMENT_PROCESS] insert failed", {
      status: response.status,
    });
    throw new Error("The processed document could not be saved.");
  }
  const result = await response.json().catch(() => []);
  return Array.isArray(result) ? result[0] : result;
}

export async function handler(req: Request, insert = insertDocument) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return fail("METHOD_NOT_ALLOWED", "Only POST is allowed.", 405);
  }
  // Hash the raw value exactly as the two downstream consumers do.
  const clientId = req.headers.get("x-client-id") || "";
  if (
    clientId.length < 8 || clientId.length > 200 || clientId !== clientId.trim()
  ) {
    return fail("CLIENT_ID_REQUIRED", "A valid client ID is required.", 400);
  }
  const length = Number(req.headers.get("content-length"));
  if (length > MAX_FILE_BYTES + 1024 * 1024) {
    return fail("FILE_TOO_LARGE", "Documents must be 10 MB or smaller.", 413);
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("INVALID_FORM_DATA", "The upload body is invalid.", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return fail("FILE_REQUIRED", "A document file is required.", 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    return fail("FILE_TOO_LARGE", "Documents must be 10 MB or smaller.", 413);
  }
  try {
    const extracted = await extractDocument(
      new Uint8Array(await file.arrayBuffer()),
      file.name,
    );
    const { text, mimeType, ...coverage } = extracted;
    let decodedName = file.name;
    // Android can percent-encode multipart filenames. Decode once only.
    try {
      decodedName = decodeURIComponent(decodedName);
    } catch { /* literal name */ }
    const name = safeName(decodedName);
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
    await insert({
      id,
      client_hash: await sha256Hex(clientId),
      name,
      mime_type: mimeType,
      size_bytes: file.size,
      extracted_text: text,
      extracted_chars: text.length,
      expires_at: expiresAt,
    });
    return jsonResponse({
      attachment: {
        id,
        name,
        mimeType,
        size: file.size,
        extractedChars: text.length,
        expiresAt,
        ...coverage,
      },
    });
  } catch (error) {
    // Never log raw parser messages: they can contain document content.
    const known = error instanceof DocumentError;
    const code = known ? error.code : "DOCUMENT_PROCESSING_FAILED";
    console.error("[DOCUMENT_PROCESS] failed", { code });
    return fail(
      code,
      known
        ? error.message
        : "The document could not be processed. Try another file.",
      known ? error.status : 422,
    );
  }
}
if (import.meta.main) Deno.serve((req) => handler(req));

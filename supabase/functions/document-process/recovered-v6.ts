/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
import { extractText, getDocumentProxy } from "npm:unpdf@1.8.1";
import * as mammothModule from "npm:mammoth@1.12.1";
import { Buffer } from "node:buffer";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 200_000;
const MAX_PDF_PAGES = 100;
const MAX_DOCX_ENTRIES = 2_000;
const MAX_DOCX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
const DOCUMENT_TTL_DAYS = 7;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-id, x-app-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  csv: "text/csv",
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

function extensionOf(name) {
  return (
    String(name || "")
      .trim()
      .toLowerCase()
      .match(/\.([a-z0-9]+)$/)?.[1] || ""
  );
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

function cleanExtractedText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function startsWithBytes(bytes, expected) {
  return expected.every((value, index) => bytes[index] === value);
}

function findZipEndOfCentralDirectory(bytes) {
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 &&
      bytes[offset + 3] === 0x06
    )
      return offset;
  }
  return -1;
}

function validateDocxArchive(bytes) {
  if (!startsWithBytes(bytes, [0x50, 0x4b])) {
    throw new Error("The DOCX file is not a valid ZIP document.");
  }

  const eocdOffset = findZipEndOfCentralDirectory(bytes);
  if (eocdOffset < 0) throw new Error("The DOCX archive is incomplete.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralOffset = view.getUint32(eocdOffset + 16, true);
  if (entryCount <= 0 || entryCount > MAX_DOCX_ENTRIES) {
    throw new Error("The DOCX archive contains too many entries.");
  }

  let offset = centralOffset;
  let totalUncompressed = 0;
  let hasMainDocument = false;
  const decoder = new TextDecoder("utf-8", { fatal: false });
  for (let index = 0; index < entryCount; index += 1) {
    if (
      offset + 46 > bytes.length ||
      view.getUint32(offset, true) !== 0x02014b50
    ) {
      throw new Error("The DOCX central directory is invalid.");
    }
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new Error("ZIP64 DOCX files are not supported.");
    }
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_DOCX_UNCOMPRESSED_BYTES) {
      throw new Error("The expanded DOCX file is too large.");
    }
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > bytes.length)
      throw new Error("The DOCX entry name is invalid.");
    const entryName = decoder.decode(bytes.slice(nameStart, nameEnd));
    if (entryName === "word/document.xml") hasMainDocument = true;
    offset = nameEnd + extraLength + commentLength;
  }
  if (!hasMainDocument)
    throw new Error("The file is not a valid Word document.");
}

async function withTimeout(promise, milliseconds) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("Document processing timed out.")),
      milliseconds
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function extractPdf(bytes) {
  if (!startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    throw new Error("The selected file is not a valid PDF.");
  }
  const pdf = await getDocumentProxy(bytes, {
    isEvalSupported: false,
    maxImageSize: 16_777_216,
  });
  try {
    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new Error(`PDF files can contain at most ${MAX_PDF_PAGES} pages.`);
    }
    const result = await withTimeout(
      extractText(pdf, { mergePages: true }),
      25_000
    );
    return Array.isArray(result?.text)
      ? result.text.join("\n\n")
      : result?.text;
  } finally {
    await pdf.destroy?.().catch?.(() => {});
  }
}

async function extractDocx(arrayBuffer, bytes) {
  validateDocxArchive(bytes);
  const mammoth = mammothModule.default || mammothModule;
  const result = await withTimeout(
    mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) }),
    25_000
  );
  return result?.value;
}

async function extractDocumentText(extension, arrayBuffer, bytes) {
  if (extension === "pdf") return extractPdf(bytes);
  if (extension === "docx") return extractDocx(arrayBuffer, bytes);
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST")
    return fail("METHOD_NOT_ALLOWED", "Only POST is allowed.", 405);

  const clientId = String(req.headers.get("x-client-id") || "").trim();
  if (clientId.length < 8 || clientId.length > 200) {
    return fail("CLIENT_ID_REQUIRED", "A valid client ID is required.", 400);
  }

  let formData;
  try {
    formData = await req.formData();
  } catch {
    return fail("INVALID_FORM_DATA", "The upload body is invalid.", 400);
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return fail("FILE_REQUIRED", "A document file is required.", 400);
  }
  if (file.size <= 0)
    return fail("EMPTY_FILE", "The selected document is empty.", 400);
  if (file.size > MAX_FILE_BYTES) {
    return fail("FILE_TOO_LARGE", "Documents must be 10 MB or smaller.", 413);
  }

  const name = safeName(file.name);
  const extension = extensionOf(name);
  const mimeType = MIME_BY_EXTENSION[extension];
  if (!mimeType) {
    return fail("UNSUPPORTED_FILE", "Use a PDF, DOCX, TXT or CSV file.", 415);
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const extracted = cleanExtractedText(
      await extractDocumentText(extension, arrayBuffer, bytes)
    );
    if (!extracted) {
      return fail(
        "NO_READABLE_TEXT",
        "No readable text was found. Scanned PDFs require OCR and are not supported yet.",
        422
      );
    }

    const storedText = extracted.slice(0, MAX_EXTRACTED_CHARS);
    const id = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + DOCUMENT_TTL_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    await insertDocument({
      id,
      client_hash: await sha256Hex(clientId),
      name,
      mime_type: mimeType,
      size_bytes: file.size,
      extracted_text: storedText,
      extracted_chars: storedText.length,
      expires_at: expiresAt,
    });

    return jsonResponse({
      attachment: {
        id,
        name,
        mimeType,
        size: file.size,
        extractedChars: storedText.length,
        truncated: storedText.length < extracted.length,
        expiresAt,
      },
    });
  } catch (error) {
    console.error("[DOCUMENT_PROCESS] failed", {
      extension,
      message: String(error?.message || error).slice(0, 180),
    });
    return fail(
      "DOCUMENT_PROCESSING_FAILED",
      error?.message || "The document could not be processed.",
      422
    );
  }
});

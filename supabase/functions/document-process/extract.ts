import { getDocumentProxy } from "unpdf";
import { PDFDocument } from "pdf-lib";
import { Unzip, UnzipInflate } from "fflate";
import { SaxesParser } from "saxes";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_EXTRACTED_CHARS = 200000;
export const MAX_PDF_PAGES = 100;
const MAX_EXPANDED_BYTES = 50 * 1024 * 1024;
const MIME = {
  pdf: "application/pdf",
  docx:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  csv: "text/csv",
};
export class DocumentError extends Error {
  constructor(public code: string, message: string, public status = 422) {
    super(message);
  }
}
const unsupported = () =>
  new DocumentError(
    "UNSUPPORTED_DOCUMENT",
    "Use a readable PDF, DOCX, TXT or CSV file.",
  );
const clean = (text: string) =>
  text.replace(/\r\n?/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
const starts = (bytes: Uint8Array, values: number[]) =>
  values.every((v, i) => bytes[i] === v);

export function decodeText(bytes: Uint8Array): string {
  let text: string;
  if (starts(bytes, [0xff, 0xfe]) || starts(bytes, [0xfe, 0xff])) {
    if (bytes.length % 2) throw unsupported();
    try {
      text = new TextDecoder(bytes[0] === 0xff ? "utf-16le" : "utf-16be", {
        fatal: true,
      }).decode(bytes.subarray(2));
    } catch {
      throw unsupported();
    }
  } else {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      text = new TextDecoder("windows-1252").decode(bytes);
    }
  }
  // Do not silently turn arbitrary binary data into apparent source text.
  if (/[\u0000-\u0008\u000b\u000e-\u001f\u007f-\u009f\ufffd]/u.test(text)) {
    throw unsupported();
  }
  return text.replace(/^\ufeff/, "");
}

function zipParts(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === bytes.length
    ) {
      end = i;
      break;
    }
  }
  if (
    end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)
  ) throw unsupported();
  const count = view.getUint16(end + 10, true);
  if (!count || count > 2000 || count !== view.getUint16(end + 8, true)) {
    throw unsupported();
  }
  let offset = view.getUint32(end + 16, true), expanded = 0;
  const expected = new Map<string, number>();
  for (let n = 0; n < count; n++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) {
      throw unsupported();
    }
    const size = view.getUint32(offset + 24, true);
    expanded += size;
    if (
      expanded > MAX_EXPANDED_BYTES || (view.getUint16(offset + 8, true) & 1)
    ) throw unsupported();
    const nameEnd = offset + 46 + view.getUint16(offset + 28, true);
    if (nameEnd > end) throw unsupported();
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, nameEnd));
    if (expected.has(name)) throw unsupported();
    expected.set(name, size);
    offset = nameEnd + view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
  }
  if (offset !== end || !expected.has("word/document.xml")) throw unsupported();
  const parts = new Map<string, Uint8Array>();
  let total = 0, failure: Error | null = null;
  const unzip = new Unzip((file) => {
    if (!expected.has(file.name)) {
      failure = unsupported();
      file.terminate();
      return;
    }
    // Only textual Word parts are inflated. Images/macros are never executed/read.
    if (
      !/^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(
        file.name,
      )
    ) return;
    const chunks: Uint8Array[] = [];
    let length = 0;
    file.ondata = (error, chunk, final) => {
      if (failure) return;
      if (error) {
        failure = unsupported();
        return;
      }
      length += chunk.length;
      total += chunk.length;
      if (length > expected.get(file.name)! || total > MAX_EXPANDED_BYTES) {
        failure = unsupported();
        file.terminate();
        return;
      }
      chunks.push(chunk);
      if (final) {
        if (length !== expected.get(file.name)) {
          failure = unsupported();
          return;
        }
        const data = new Uint8Array(length);
        let pos = 0;
        for (const piece of chunks) {
          data.set(piece, pos);
          pos += piece.length;
        }
        parts.set(file.name, data);
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  try {
    // Bounded compressed chunks also bound allocations before expansion checks.
    for (let i = 0; i < bytes.length; i += 1024) {
      unzip.push(bytes.subarray(i, i + 1024), i + 1024 >= bytes.length);
      if (failure) throw failure;
    }
  } catch {
    throw unsupported();
  }
  if (!parts.has("word/document.xml")) throw unsupported();
  return parts;
}

function wordText(xml: string): string {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw unsupported();
  const parser = new SaxesParser({ xmlns: true });
  const output: string[] = [];
  let inText = false, deleted = 0;
  const word = (tag: any) =>
    /\/wordprocessingml\/2006\/main$|\/wordprocessingml\/main$/.test(tag.uri);
  parser.on("opentag", (tag) => {
    if (!word(tag)) return;
    if (tag.local === "del") deleted++;
    if (deleted) return;
    if (tag.local === "t") inText = true;
    if (tag.local === "tab") output.push("\t");
    if (["br", "cr"].includes(tag.local)) output.push("\n");
  });
  parser.on("text", (value) => {
    if (inText && !deleted) output.push(value);
  });
  parser.on("closetag", (tag) => {
    if (!word(tag)) return;
    if (tag.local === "del") {
      deleted--;
      return;
    }
    if (deleted) return;
    if (tag.local === "t") inText = false;
    if (tag.local === "p" || tag.local === "tr") output.push("\n");
    if (tag.local === "tc") {
      while (output.at(-1) === "\n") output.pop();
      output.push("\t");
    }
  });
  try {
    parser.write(xml).close();
  } catch {
    throw unsupported();
  }
  return clean(output.join(""));
}

function extractDocx(bytes: Uint8Array): string {
  const parts = zipParts(bytes);
  const names = [...parts.keys()].sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true })
  );
  const ordered = [
    "word/document.xml",
    ...names.filter((n) => n !== "word/document.xml"),
  ];
  return ordered.map((name) => {
    const text = wordText(decodeText(parts.get(name)!));
    const label = name.match(/word\/(header|footer|footnotes|endnotes)/)?.[1];
    return text && label ? `[${label}]\n${text}` : text;
  }).filter(Boolean).join("\n\n");
}

// CSV parser keeps quoted delimiters and embedded newlines; no formula evaluation.
function parseRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false, ended = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        ended = true;
      } else cell += c;
    } else if (c === '"' && cell === "" && !ended) quoted = true;
    else if (c === delimiter || c === "\n" || c === "\r") {
      row.push(cell);
      cell = "";
      ended = false;
      if (c !== delimiter) {
        if (c === "\r" && text[i + 1] === "\n") i++;
        rows.push(row);
        row = [];
      }
    } else {
      if ((ended && c.trim()) || c === '"') throw unsupported();
      cell += c;
    }
  }
  if (quoted) throw unsupported();
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
function extractCsv(text: string): string {
  let best: string[][] | null = null, score = -1;
  for (const separator of [",", ";", "\t", "|"]) {
    try {
      const rows = parseRows(text, separator);
      const counts = rows.slice(0, 30).filter((r) => r.some((c) => c.trim()))
        .map((r) => r.length);
      const candidate = counts.filter((n) => n > 1).length * 10 -
        new Set(counts).size;
      if (candidate > score) {
        best = rows;
        score = candidate;
      }
    } catch { /* Try the next delimiter. */ }
  }
  if (!best) throw unsupported();
  if (!best.some((row) => row.some((cell) => cell.trim()))) return "";
  return best.map((row) => row.map((cell) => JSON.stringify(cell)).join(" | "))
    .join("\n");
}

async function extractPdf(bytes: Uint8Array) {
  let document;
  try {
    document = await PDFDocument.load(bytes, {
      updateMetadata: false,
      throwOnInvalidObject: true,
    });
  } catch (error) {
    if (
      /encrypt/i.test(error?.name || "") ||
      /encrypted/i.test(error?.message || "")
    ) {
      throw new DocumentError(
        "ENCRYPTED_DOCUMENT",
        "This PDF is password-protected. Upload an unlocked copy.",
      );
    }
    throw unsupported();
  }
  const pageCount = document.getPageCount();
  if (pageCount > MAX_PDF_PAGES) {
    throw new DocumentError(
      "TOO_MANY_PAGES",
      "Split this PDF into files of up to 100 pages.",
    );
  }
  if (!pageCount) {
    throw new DocumentError(
      "NO_READABLE_TEXT",
      "This PDF contains no readable pages.",
    );
  }
  // PDF.js drops glyphs outside the effective page box. Expand an in-memory
  // copy only; never modify the uploaded file. Explicit clipping and malformed
  // font mappings remain documented limitations, not guessed missing text.
  for (const page of document.getPages()) {
    page.setMediaBox(-1000000, -1000000, 2000000, 2000000);
    page.setCropBox(-1000000, -1000000, 2000000, 2000000);
  }
  const expanded = await document.save({ useObjectStreams: false });
  // unpdf's bundled declarations omit these supported PDF.js runtime options.
  const options = {
    isEvalSupported: false,
    useSystemFonts: true,
    verbosity: 0,
    stopAtErrors: true,
  };
  const pdf = await getDocumentProxy(expanded, options);
  const timeout = setTimeout(() => {
    pdf.loadingTask.destroy().catch(() => {});
  }, 25000);
  const pages: string[] = [];
  let empty = 0;
  try {
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // Preserve content-stream reading order and line boundaries. Geometric
      // column guessing can silently reorder tables, so it is not used here.
      let text = "";
      for (const item of content.items) {
        if ("str" in item) {
          text += item.str + (item.hasEOL ? "\n" : " ");
        }
      }
      text = clean(text);
      if (!text) empty++;
      pages.push(text);
      page.cleanup();
    }
  } finally {
    clearTimeout(timeout);
    await pdf.loadingTask.destroy();
  }
  return {
    text: pages.join("\n\n"),
    pageCount,
    extractedPages: pageCount - empty,
    partialText: empty > 0,
  };
}

export async function extractDocument(bytes: Uint8Array, filename: string) {
  if (bytes.length > MAX_FILE_BYTES) {
    throw new DocumentError(
      "FILE_TOO_LARGE",
      "Documents must be 10 MB or smaller.",
      413,
    );
  }
  if (!bytes.length) {
    throw new DocumentError(
      "EMPTY_FILE",
      "The selected document is empty.",
      400,
    );
  }
  let extension = filename.toLowerCase().match(/\.([a-z]+)$/)?.[1];
  let value: {
    text: string;
    pageCount?: number;
    extractedPages?: number;
    partialText?: boolean;
  };
  if (starts(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    extension = "pdf";
    value = await extractPdf(bytes);
  } else if (starts(bytes, [0x50, 0x4b])) {
    extension = "docx";
    value = { text: extractDocx(bytes) };
  } else {
    if (!["txt", "csv"].includes(extension || "")) throw unsupported();
    const decoded = decodeText(bytes);
    value = { text: extension === "csv" ? extractCsv(decoded) : decoded };
  }
  const text = clean(value.text);
  if (!text) {
    throw new DocumentError(
      "NO_READABLE_TEXT",
      "No readable text was found. Scanned PDFs need OCR; upload a text-based copy.",
    );
  }
  // Never split a UTF-16 surrogate pair at the storage boundary.
  let end = Math.min(text.length, MAX_EXTRACTED_CHARS);
  if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
  return {
    ...value,
    text: text.slice(0, end),
    mimeType: MIME[extension!],
    truncated: end < text.length,
    partialText: value.partialText === true,
  };
}

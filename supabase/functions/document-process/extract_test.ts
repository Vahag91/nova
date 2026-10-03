import {
  extractDocument,
  MAX_EXTRACTED_CHARS,
  MAX_FILE_BYTES,
} from "./extract.ts";
import { handler } from "./index.ts";
import { strToU8, zipSync } from "fflate";
import { PDFDocument, StandardFonts } from "pdf-lib";

Deno.test("100-page boundary accepted and long PDF text discloses the character cut", async () => {
  const source = await PDFDocument.load(await fixture("150-pages.pdf"));
  const hundred = await PDFDocument.create();
  for (
    const page of await hundred.copyPages(
      source,
      Array.from({ length: 100 }, (_, i) => i),
    )
  ) hundred.addPage(page);
  const accepted = await extractDocument(await hundred.save(), "hundred.pdf");
  assert(
    accepted.pageCount === 100 && accepted.extractedPages === 100 &&
      !accepted.truncated,
  );
  const long = await PDFDocument.create(), page = long.addPage([612, 792]);
  const font = await long.embedFont(StandardFonts.Helvetica);
  page.drawText("A".repeat(200010), { x: 40, y: 700, size: 1, font });
  const cut = await extractDocument(await long.save(), "long.pdf");
  assert(cut.truncated && cut.text.length === MAX_EXTRACTED_CHARS);
});

Deno.test("Malformed UTF-16/CSV and empty CSV are rejected clearly", async () => {
  await rejects(
    extractDocument(new Uint8Array([255, 254, 0, 216]), "broken.txt"),
    "UNSUPPORTED_DOCUMENT",
  );
  await rejects(
    extractDocument(strToU8('Name,Note\nCedar,"unfinished'), "broken.csv"),
    "UNSUPPORTED_DOCUMENT",
  );
  await rejects(
    extractDocument(strToU8('"",""'), "empty.csv"),
    "NO_READABLE_TEXT",
  );
});
const assert = (value: unknown, message = "Assertion failed") => {
  if (!value) throw new Error(message);
};
const fixture = (name: string) =>
  Deno.readFile(new URL(`./fixtures/${name}`, import.meta.url));
async function rejects(work: Promise<unknown>, code: string, status = 422) {
  try {
    await work;
  } catch (e) {
    assert(
      e.code === code && e.status === status,
      `Expected ${code}/${status}, got ${e.code}/${e.status}`,
    );
    return;
  }
  throw new Error(`Expected ${code}`);
}
Deno.test("PDF: content beyond MediaBox/CropBox is retained", async () => {
  for (
    const [file, tail] of [["outside-media.pdf", "OUTSIDE_MEDIA_TAIL"], [
      "outside-crop.pdf",
      "OUTSIDE CROP",
    ]]
  ) {
    const result = await extractDocument(await fixture(file), file);
    assert(result.text.includes(tail), result.text);
    assert(
      result.pageCount === 1 && result.extractedPages === 1 &&
        !result.partialText && !result.truncated,
    );
  }
});
Deno.test("PDF: columns, table cells, rotation, hyphenation, ligatures and Unicode", async () => {
  const layout = await extractDocument(
    await fixture("layout.pdf"),
    "layout.pdf",
  );
  for (
    const s of [
      "COLUMN LEFT ONE",
      "COLUMN LEFT TWO",
      "COLUMN RIGHT ONE",
      "COLUMN RIGHT TWO",
      "Cedar",
      "8200",
      "Garden",
      "640",
      "hyphen-",
      "ation stays explicit",
    ]
  ) assert(layout.text.includes(s), s);
  assert(
    layout.text.indexOf("LEFT TWO") < layout.text.indexOf("RIGHT ONE"),
    "Preserves authored column order",
  );
  const rotated = await extractDocument(
    await fixture("rotated.pdf"),
    "rotated.pdf",
  );
  assert(rotated.text.includes("ROTATED PAGE 37"));
  const unicode = await extractDocument(
    await fixture("unicode.pdf"),
    "unicode.pdf",
  );
  assert(unicode.text.includes("中文測試"), unicode.text);
  assert(
    unicode.text.includes("שלום") || unicode.text.includes("םולש"),
    unicode.text,
  );
  assert(
    unicode.text.includes("file") && unicode.text.includes("flow"),
    unicode.text,
  );
});
Deno.test("PDF: encrypted, 150 pages, blank and mixed text/image pages", async () => {
  await rejects(
    extractDocument(await fixture("encrypted.pdf"), "encrypted.pdf"),
    "ENCRYPTED_DOCUMENT",
  );
  await rejects(
    extractDocument(await fixture("150-pages.pdf"), "150-pages.pdf"),
    "TOO_MANY_PAGES",
  );
  await rejects(
    extractDocument(await fixture("blank.pdf"), "blank.pdf"),
    "NO_READABLE_TEXT",
  );
  const partial = await extractDocument(
    await fixture("partial.pdf"),
    "partial.pdf",
  );
  assert(
    partial.pageCount === 2 && partial.extractedPages === 1 &&
      partial.partialText && !partial.truncated,
  );
});
Deno.test("Sniffs mislabelled PDF and DOCX, rejects binary and non-Word ZIP", async () => {
  assert(
    (await extractDocument(await fixture("layout.pdf"), "looks-like.txt"))
      .mimeType === "application/pdf",
  );
  assert(
    (await extractDocument(await fixture("structure.docx"), "looks-like.csv"))
      .mimeType.includes("wordprocessingml"),
  );
  await rejects(
    extractDocument(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1]),
      "image.txt",
    ),
    "UNSUPPORTED_DOCUMENT",
  );
  await rejects(
    extractDocument(strToU8("not a PDF"), "fake.pdf"),
    "UNSUPPORTED_DOCUMENT",
  );
  await rejects(
    extractDocument(zipSync({ "random.txt": strToU8("hello") }), "fake.docx"),
    "UNSUPPORTED_DOCUMENT",
  );
});
Deno.test("Text: BOMs, UTF-16 LE/BE, Latin-1 fallback and truncation boundary", async () => {
  const expected = "Café 中文";
  const utf8 = new Uint8Array([239, 187, 191, ...strToU8(expected)]);
  assert((await extractDocument(utf8, "a.txt")).text === expected);
  for (const little of [true, false]) {
    const bytes = new Uint8Array(2 + expected.length * 2),
      view = new DataView(bytes.buffer);
    view.setUint16(0, 0xfeff, little);
    for (let i = 0; i < expected.length; i++) {
      view.setUint16(2 + i * 2, expected.charCodeAt(i), little);
    }
    assert((await extractDocument(bytes, "a.txt")).text === expected);
  }
  assert(
    (await extractDocument(new Uint8Array([67, 97, 102, 233]), "a.txt"))
      .text === "Café",
  );
  assert(
    !(await extractDocument(strToU8("x".repeat(MAX_EXTRACTED_CHARS)), "a.txt"))
      .truncated,
  );
  const cut = await extractDocument(
    strToU8("x".repeat(MAX_EXTRACTED_CHARS - 1) + "😀END"),
    "a.txt",
  );
  assert(cut.truncated && cut.text.length === MAX_EXTRACTED_CHARS - 1);
});
Deno.test("DOCX: paragraphs, rows, text boxes, headers/footers, footnotes/endnotes", async () => {
  const doc = await extractDocument(
    await fixture("structure.docx"),
    "structure.docx",
  );
  for (
    const s of [
      "Main 37 volunteers",
      "Cedar\t8200",
      "TEXT BOX FACT",
      "HEADER FACT",
      "FOOTER FACT",
      "FOOTNOTE FACT",
      "ENDNOTE FACT",
    ]
  ) assert(doc.text.includes(s), doc.text);
  await rejects(
    extractDocument(
      zipSync({
        "word/document.xml": strToU8(
          '<!DOCTYPE x [<!ENTITY a "bad">]><x>&a;</x>',
        ),
      }),
      "x.docx",
    ),
    "UNSUPPORTED_DOCUMENT",
  );
});
Deno.test("CSV: comma/semicolon/tab delimiters, quoted fields, escaped quotes and multiline cells", async () => {
  for (const d of [",", ";", "\t"]) {
    const input =
      `Name${d}Note\r\nCedar${d}"a${d}b and ""quote""\nsecond line"`;
    const csv = await extractDocument(strToU8(input), "rows.csv");
    assert(csv.text.includes('"Cedar" | '), csv.text);
    assert(
      csv.text.includes(
        `a${d === "\t" ? "\\t" : d}b and \\"quote\\"\\nsecond line`,
      ),
      csv.text,
    );
  }
});
Deno.test("10 MB exactly accepted/truncated; one byte over rejected", async () => {
  const bytes = new Uint8Array(MAX_FILE_BYTES).fill(65);
  const result = await extractDocument(bytes, "max.txt");
  assert(result.truncated && result.text.length === MAX_EXTRACTED_CHARS);
  await rejects(
    extractDocument(new Uint8Array(MAX_FILE_BYTES + 1), "over.txt"),
    "FILE_TOO_LARGE",
    413,
  );
  // A padded valid PDF tests the same file-byte boundary through the PDF parser.
  const pdf = await fixture("layout.pdf"),
    padded = new Uint8Array(MAX_FILE_BYTES).fill(32);
  padded.set(pdf);
  assert((await extractDocument(padded, "max.pdf")).text.includes("8200"));
});
Deno.test("HTTP contract: raw-device hash, seven-day expiry, names, coverage and safe errors", async () => {
  const device = "fixture-device-123456";
  let inserted: any;
  const upload = async (bytes: Uint8Array, name: string) => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)]), name);
    return await handler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "x-client-id": device },
        body: form,
      }),
      async (row) => {
        inserted = row;
        return row;
      },
    );
  };
  const before = Date.now(),
    response = await upload(await fixture("partial.pdf"), "My%20Report.pdf");
  const attachment = (await response.json()).attachment;
  const hash = [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(device)),
    ),
  ].map((v) => v.toString(16).padStart(2, "0")).join("");
  assert(response.status === 200 && attachment.name === "My Report.pdf");
  assert(
    inserted.client_hash === hash &&
      inserted.extracted_chars === inserted.extracted_text.length,
  );
  assert(
    Date.parse(attachment.expiresAt) >= before + 7 * 86400000 &&
      Date.parse(attachment.expiresAt) <= Date.now() + 7 * 86400000,
  );
  assert(
    attachment.partialText && attachment.pageCount === 2 &&
      attachment.extractedPages === 1,
  );
  for (
    const [file, code] of [["encrypted.pdf", "ENCRYPTED_DOCUMENT"], [
      "150-pages.pdf",
      "TOO_MANY_PAGES",
    ]]
  ) {
    const r = await upload(await fixture(file), file);
    assert(r.status === 422 && (await r.json()).code === code);
  }
});

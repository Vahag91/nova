# Document extraction

Recovered production v6 through the Supabase Management API on 2026-10-03. No earlier source was found in this checkout or its Git history. `recovered-v6.ts` is the unchanged recovery snapshot; it is not a deployment entrypoint. See `recovery.json` for provenance. Current implementation: `index.ts` and `extract.ts`, dependencies pinned in `deno.json` and `deno.lock`.

## Deployment boundary

Following the owner's explicit approval on 2026-10-03, production `document-process` v7 is deployed and ACTIVE. Its executable source matches tested `document-process-canary` v2; deployed bundle SHA-256 is `3e89aecb0b4364ce33c928cfe361a37203bc3c4601fbe9066db7b5f9a8485e32`. Both configurations require JWT verification. Production smoke checks passed for partial-page coverage, encrypted/150-page errors, PDF/DOCX/CSV extraction, combined summary and ownership. Evidence: `tmp/document-extraction-qa/production-smoke.log` and `production-workspace.log`. No migration, quota, entitlement, pricing or chat-endpoint changes are part of this work. Client metadata changes still require an app release.

## Contract and extraction policy

- Multipart `file`, existing client headers; existing attachment fields retained. Additional fields: `pageCount`, `extractedPages`, `partialText` for PDFs (other formats return `partialText: false`). `extractedPages` means pages containing extractable text, **not** a consecutive prefix. The app says “Text found on 2 of 3 pages”, not “first 2 pages”.
- Maximum file size: 10 MiB inclusive. PDF files over 100 pages are rejected with `422 TOO_MANY_PAGES`; they are never silently reduced to 100 pages. Text is capped at 200,000 UTF-16 code units without splitting a surrogate pair; `truncated` reports an actual character cut. No intentional per-line/per-page character cut exists.
- PDF: `unpdf@1.8.1` (bundled PDF.js), with `pdf-lib@1.17.1` to expand only an in-memory copy's MediaBox/CropBox. The expansion recovers the tested text beyond visible page edges. Uploaded bytes are never overwritten. All encrypted PDFs, including encryption without a required opening password, are rejected as `ENCRYPTED_DOCUMENT`.
- File content takes precedence over MIME/extension for PDF and DOCX. A DOCX must be a bounded ZIP with `word/document.xml`; unsupported archives and binary control data return `UNSUPPORTED_DOCUMENT`. Plain text requires `.txt`/`.csv`, UTF-8 (including BOM), BOM-labelled UTF-16 LE/BE, or Windows-1252 fallback (covers ordinary Latin-1 accented text). Ambiguous unlabelled encodings cannot be identified reliably; BOM-less UTF-16 is not promised.
- DOCX XML is parsed with `saxes`; ZIP extraction uses `fflate`, with entry-count/expanded-size checks, incremental inflation, and DTD/entity rejection. Paragraphs, table cells, text boxes, headers, footers, footnotes and endnotes are included. Supporting parts appear after the body, with labels. Deleted revision text is omitted. No macros, fields, external relationships or formulas are executed.
- CSV detects comma, semicolon, tab or pipe separators, handles quoted separators, escaped quotes and multiline cells, and emits quoted cells separated by ` | ` with one logical record per line. Embedded cell newlines are represented as literal `\n` to keep row structure. Ambiguous one-column files have no reliable delimiter; malformed quoting is rejected.
- Stored rows retain the existing schema and raw-device SHA-256 ownership. The seven-day expiry and existing hourly cleanup remain unchanged. Page metadata travels in the upload response, local attachments and pending/saved workspace records; it is **not** a new database column and is unavailable when reconstructing solely from a remote document ID.
- Error logs contain only safe error codes or HTTP statuses, never parser messages or document text. PDF.js verbosity is disabled. Original filenames are percent-decoded once then sanitized; the app preserves its picker label.

## Fidelity limits

This is text extraction, not OCR or page understanding. `partialText` flags PDFs with some textless pages (including genuinely blank pages); textless PDFs fail explicitly. Images, charts, handwriting, DOCX embedded objects/altChunk content and equation semantics are not reconstructed. A page with both text and images can still report extractable text without understanding the images.

PDF content-stream order is retained. The authored two-column fixture passes, but arbitrary geometric column/table reconstruction is not guaranteed: row-interleaved or unordered PDF streams can mix columns. Table values are retained, not a guaranteed table schema. Rotated-page text and embedded Unicode maps pass the fixtures; missing/broken font maps or externally required CMaps can still prevent faithful decoding. RTL glyphs are retained in the fixture, but logical/display order and complex-script shaping are not universally guaranteed. Ligatures are normalized by PDF.js; line-end hyphens remain explicit to avoid inventing joins. Explicit clipping paths and extreme coordinates beyond the expanded ±1,000,000 area remain limitations. Recovery of text outside visible page bounds can expose source text absent from a rendered page; it is not proof that all extracted text was visibly displayed.

The 10 MiB padded PDF and 100-page synthetic tests pass, but they do not establish performance for every heavily compressed or complex document within those limits. Edge CPU/memory limits still apply.

## Verification

From the repository root:

```powershell
npx --yes deno test --allow-read --allow-env --config supabase/functions/document-process/deno.json supabase/functions/document-process/extract_test.ts
node supabase/functions/document-process/verify-canary.cjs
$env:DOCUMENT_ENDPOINT='document-process-canary'
$env:SOURCE_ENDPOINT='source-analyze-canary'
node tmp/verify-source-workspace.cjs --documents
node node_modules/jest/bin/jest.js --runInBand
```

Fixtures are synthetic and committed alongside `fixtures/generate.py`. Regeneration uses reportlab/pypdf and the Windows Arial/Malgun fonts for embedded Unicode subsets; ordinary tests use the existing fixture bytes and need no Python/fonts. Layout, Unicode and intentionally clipped fixtures were rendered and inspected. The long-line/out-of-bounds fixtures intentionally look clipped; extraction must retain their tails.

Live checks use the same Supabase project/database, not an isolated staging database. They insert synthetic documents with seven-day expiry and the workspace check consumes an analysis attempt. IDs/results are saved under `tmp/document-extraction-qa`; no customer documents are read. Verify production approval before changing the endpoint target.

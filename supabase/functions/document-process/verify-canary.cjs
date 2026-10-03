/* eslint-env node, es2020 */
/* global fetch, Blob, FormData, AbortSignal */
// Run from repository root. Exercises extraction only; no production deployments.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const config = fs.readFileSync('src/config/endpoints.js', 'utf8');
const base = config.match(/SUPABASE_BASE\s*=\s*"([^"]+)"/)[1];
const key = config.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/)[1];
const endpoint = process.env.DOCUMENT_ENDPOINT || 'document-process-canary';
const device = crypto.randomUUID();
const headers = { apikey: key, Authorization: `Bearer ${key}`, 'x-client-id': device, 'x-app-version': 'extraction-canary-qa' };
const folder = 'supabase/functions/document-process/fixtures/';
const results = [];
async function upload(name, bytes, expectedStatus = 200, code) {
  const form = new FormData(); form.append('file', new Blob([bytes], { type: 'application/octet-stream' }), name);
  const response = await fetch(`${base}/functions/v1/${endpoint}`, { method: 'POST', headers, body: form, signal: AbortSignal.timeout(60000) });
  const body = await response.json();
  console.log(JSON.stringify({ name, status: response.status, ...body }));
  assert.equal(response.status, expectedStatus, JSON.stringify(body));
  if (code) assert.equal(body.code, code);
  results.push({ name, ...body });
  return body.attachment;
}
(async () => {
  for (const name of ['layout.pdf', 'outside-media.pdf', 'outside-crop.pdf', 'rotated.pdf', 'unicode.pdf', 'structure.docx']) {
    const a = await upload(name, fs.readFileSync(folder + name));
    if (name.endsWith('.pdf')) assert.equal(a.extractedPages, 1);
    assert.equal(a.truncated, false);
  }
  const partial = await upload('partial.pdf', fs.readFileSync(folder + 'partial.pdf'));
  assert.equal(partial.pageCount, 2); assert.equal(partial.extractedPages, 1); assert.equal(partial.partialText, true);
  const hundred = await upload('100-pages.pdf', fs.readFileSync(folder + '100-pages.pdf'));
  assert.equal(hundred.pageCount, 100); assert.equal(hundred.extractedPages, 100);
  const longPdf = await upload('long-text.pdf', fs.readFileSync(folder + 'long-text.pdf'));
  assert.ok(longPdf.extractedChars > 200000 && longPdf.extractedChars <= 500000);
  await upload('broken.txt', Buffer.from([255, 254, 0, 216]), 422, 'UNSUPPORTED_DOCUMENT');
  await upload('broken.csv', Buffer.from('Name,Note\nCedar,"unfinished'), 422, 'UNSUPPORTED_DOCUMENT');
  await upload('rows.csv', Buffer.from('Name;Note\nCedar;"two;parts and ""quote""\nsecond line"'));
  const mislabel = await upload('not-really.txt', fs.readFileSync(folder + 'layout.pdf')); assert.equal(mislabel.mimeType, 'application/pdf');
  const encoded = await upload('Readable%20name.txt', Buffer.from('37 volunteers')); assert.equal(encoded.name, 'Readable name.txt');
  await upload('encrypted.pdf', fs.readFileSync(folder + 'encrypted.pdf'), 422, 'ENCRYPTED_DOCUMENT');
  await upload('150-pages.pdf', fs.readFileSync(folder + '150-pages.pdf'));
  await upload('blank.pdf', fs.readFileSync(folder + 'blank.pdf'), 422, 'NO_READABLE_TEXT');
  await upload('fake.txt', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1]), 422, 'UNSUPPORTED_DOCUMENT');
  const maximum = await upload('maximum.txt', Buffer.alloc(25 * 1024 * 1024, 65));
  assert.equal(maximum.truncated, true); assert.equal(maximum.extractedChars, 500000);
  await upload('over.txt', Buffer.alloc(25 * 1024 * 1024 + 1, 65), 413, 'FILE_TOO_LARGE');
  const pdf = Buffer.alloc(25 * 1024 * 1024, 32); fs.readFileSync(folder + 'layout.pdf').copy(pdf);
  await upload('maximum.pdf', pdf);
  fs.mkdirSync('tmp/document-extraction-qa', { recursive: true });
  fs.writeFileSync('tmp/document-extraction-qa/canary-results.json', JSON.stringify({ endpoint, device, results }, null, 2));
  console.log('PASS: canary extraction contracts, errors, metadata, 25 MB boundaries');
})().catch(error => { console.error('FAIL', error.message); process.exitCode = 1; });

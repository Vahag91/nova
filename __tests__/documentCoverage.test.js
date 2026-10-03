import { documentCoverage, documentCoverageNotes, documentUploadError } from '../src/lib/documentCoverage';
import { toPersistedAttachment } from '../src/lib/documentAttachments';
import { validateWorkspaceRecord } from '../src/lib/workspaceContract';
import { processDocument } from '../src/api/processDocument';

const copy = (key, fallback, values = {}) => fallback.replace(/{{(\w+)}}/g, (_, name) => values[name]);
const source = {
  id: '11111111-1111-4111-8111-111111111111', kind: 'document', name: 'Scan and text.pdf',
  mimeType: 'application/pdf', size: 1024, extractedChars: 42,
  pageCount: 3, extractedPages: 2, partialText: true, truncated: true,
  expiresAt: '2099-01-01T00:00:00.000Z',
};
test('coverage survives upload normalization, attachment persistence and workspace disk validation', async () => {
  const original = global.XMLHttpRequest;
  class FakeXHR {
    constructor() { this.upload = {}; }
    open() {}
    setRequestHeader() {}
    send() {
      this.status = 200;
      this.responseText = JSON.stringify({ attachment: { ...source, name: 'encoded%20name.pdf' } });
      this.onload();
    }
  }
  global.XMLHttpRequest = FakeXHR;
  try {
    const processed = await processDocument({ file: { name: source.name, uri: 'file:///fixture.pdf', mimeType: source.mimeType, size: 1024 }, deviceId: 'fixture-device' }).promise;
    const attachment = toPersistedAttachment({ ...source, ...processed });
    const record = validateWorkspaceRecord({ id: 'job', type: 'document', createdAt: 1, sourceLabel: source.name, documents: [attachment], result: { title: 'Brief', overview: 'Overview', keyPoints: ['Point'] } });
    expect(record.documents[0]).toMatchObject(source);
    expect(documentCoverageNotes(record.documents[0], copy)).toEqual([
      'Text found on 2 of 3 pages.',
      'Some pages have no extractable text. Images and scans are not read.',
      'Only the beginning of this document was extracted. The summary may miss later content.',
    ]);
  } finally { global.XMLHttpRequest = original; }
});

test('older records remain valid; invalid page counts cannot create false coverage claims', () => {
  expect(documentCoverage({})).toEqual({});
  for (const extractedPages of [-1, 4, 1.5, '2']) {
    expect(documentCoverage({ pageCount: 3, extractedPages })).toEqual({});
  }
  expect(documentCoverage({ pageCount: 3, extractedPages: 1, partialText: false }).partialText).toBe(true);
});

test('chat errors are mapped by code and never prefer unsafe provider wording', () => {
  const t = (key, options) => options.defaultValue;
  expect(documentUploadError({ code: 'ENCRYPTED_DOCUMENT', message: 'raw parser content' }, t)).toContain('password-protected');
  expect(documentUploadError({ code: 'UNSUPPORTED_DOCUMENT' }, t)).toContain('unsupported');
  expect(documentUploadError({ code: 'TOO_MANY_PAGES' }, t)).toContain('300 pages');
});

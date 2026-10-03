import {
  isAttachmentReady,
  toPersistedAttachment,
  validatePickedDocument,
} from '../src/lib/documentAttachments';
import {
  FREE_MESSAGE_CHAR_LIMIT,
  MAX_DOCUMENT_SIZE_BYTES,
  PREMIUM_MESSAGE_CHAR_LIMIT,
  getChatTokenBudget,
  getMessageCharLimit,
} from '../src/config/chatLimits';

describe('document attachments', () => {
  test('accepts supported document types and normalizes their metadata', () => {
    const result = validatePickedDocument({
      name: 'Quarterly results.PDF',
      type: 'application/pdf',
      size: 1024,
      uri: 'content://quarterly-results',
    });

    expect(result).toEqual({
      ok: true,
      value: {
        name: 'Quarterly results.PDF',
        mimeType: 'application/pdf',
        size: 1024,
        uri: 'content://quarterly-results',
      },
    });
  });

  test.each([
    [{ name: 'malware.exe', type: 'application/octet-stream', size: 10 }, 'unsupported_type'],
    [{ name: 'empty.txt', type: 'text/plain', size: 0 }, 'empty_file'],
    [{ name: 'large.pdf', type: 'application/pdf', size: MAX_DOCUMENT_SIZE_BYTES + 1 }, 'file_too_large'],
  ])('rejects an invalid document', (file, code) => {
    expect(validatePickedDocument(file)).toMatchObject({ ok: false, code });
  });

  test('limits each message to three documents', () => {
    const existing = Array.from({ length: 3 }, (_, index) => ({
      id: `document-${index}`,
      kind: 'document',
    }));
    expect(validatePickedDocument({
      name: 'fourth.txt',
      type: 'text/plain',
      size: 10,
    }, existing)).toMatchObject({ ok: false, code: 'too_many_files' });
  });

  test('persists only safe remote metadata', () => {
    const persisted = toPersistedAttachment({
      id: 'local-id',
      remoteId: 'remote-id',
      kind: 'document',
      name: 'notes.txt',
      mimeType: 'text/plain',
      size: 20,
      extractedChars: 18,
      status: 'ready',
      uri: 'file:///private/cache/notes.txt',
      base64: 'not-safe-to-store',
    });

    expect(persisted).toEqual({
      id: 'remote-id',
      kind: 'document',
      name: 'notes.txt',
      mimeType: 'text/plain',
      size: 20,
      status: 'ready',
      source: 'file',
      extractedChars: 18,
    });
    expect(isAttachmentReady(persisted)).toBe(true);
  });

  test('allows a locally selected document to be sent, but blocks active uploads', () => {
    expect(isAttachmentReady({ kind: 'document', status: 'selected' })).toBe(true);
    expect(isAttachmentReady({ kind: 'document', status: 'uploading' })).toBe(false);
    expect(isAttachmentReady({ kind: 'document', status: 'error' })).toBe(false);
  });
});

describe('premium chat limits', () => {
  test('gives paid users a larger direct message limit', () => {
    expect(getMessageCharLimit(false)).toBe(FREE_MESSAGE_CHAR_LIMIT);
    expect(getMessageCharLimit(true)).toBe(PREMIUM_MESSAGE_CHAR_LIMIT);
    expect(PREMIUM_MESSAGE_CHAR_LIMIT).toBeGreaterThan(FREE_MESSAGE_CHAR_LIMIT);
  });

  test('keeps request context below a safe share of model context', () => {
    expect(getChatTokenBudget(true, 20_000)).toBe(6_000);
    expect(getChatTokenBudget(true, 200_000)).toBe(20_000);
    expect(getChatTokenBudget(false, 200_000)).toBe(6_000);
  });
});

test.each(['xlsx','pptx','odt','md','tsv','json'])('new %s documents are accepted in the shared chat/workspace picker', extension=>{
 expect(validatePickedDocument({name:'report.'+extension,type:'application/octet-stream',size:800,uri:'content://report'})).toMatchObject({ok:true,value:{name:'report.'+extension}});
});
test.each(['xls','ppt','exe','zip'])('unsupported %s extensions remain rejected', extension=>{expect(validatePickedDocument({name:'report.'+extension,type:'application/octet-stream',size:800})).toMatchObject({ok:false,code:'unsupported_type'});});

test('25 MB document boundary accepts files above the former cap and rejects one byte over',()=>{
 const file={name:'report.pdf',type:'application/pdf',uri:'content://report',size:25*1024*1024};
 expect(MAX_DOCUMENT_SIZE_BYTES).toBe(25*1024*1024);expect(validatePickedDocument(file).ok).toBe(true);
 expect(validatePickedDocument({...file,size:file.size+1})).toMatchObject({ok:false,code:'file_too_large'});
});

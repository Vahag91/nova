const fs = require('fs');
const path = require('path');

const read = relativePath => fs.readFileSync(
  path.join(__dirname, '..', relativePath),
  'utf8',
);

describe('document upload integration contract', () => {
  test('uploads documents separately and sends remote IDs to chat', () => {
    const chat = read('src/screens/Chat.js');
    const streamChat = read('src/api/streamChat.js');
    const processDocument = read('src/api/processDocument.js');

    expect(chat).toContain('keepLocalCopy');
    expect(chat).toContain('processDocument({');
    expect(chat).toContain('.map(toPersistedAttachment)');
    expect(streamChat).toContain("attachment?.kind === 'document' && attachment?.id");
    expect(processDocument).toContain("form.append('file'");
  });

  test('attaches selected files locally and waits for Send before uploading', () => {
    const chat = read('src/screens/Chat.js');
    const pickerStart = chat.indexOf('const onOpenFilePress');
    const pasteStart = chat.indexOf('const createPastedTextAttachment');
    const pickerBody = chat.slice(pickerStart, pasteStart);
    const sendStart = chat.indexOf('async function onSend');
    const sendBody = chat.slice(sendStart);

    expect(pickerBody).toContain("status: 'selected'");
    expect(pickerBody).not.toContain('uploadDocumentAttachment(');
    expect(sendBody).toContain('await uploadDocumentAttachment(attachment)');
  });

  test('shows the sent message and document activity before upload finishes', () => {
    const chat = read('src/screens/Chat.js');
    const sendBody = chat.slice(chat.indexOf('async function onSend'));
    const addMessagesAt = sendBody.indexOf('addMessage(activeThread.id, u)');
    const analyzingStatusAt = sendBody.indexOf("t('chat.activity.analyzingDocuments'");
    const uploadAt = sendBody.indexOf('await uploadDocumentAttachment(attachment)');

    expect(addMessagesAt).toBeGreaterThan(-1);
    expect(analyzingStatusAt).toBeGreaterThan(-1);
    expect(uploadAt).toBeGreaterThan(-1);
    expect(addMessagesAt).toBeLessThan(uploadAt);
    expect(analyzingStatusAt).toBeLessThan(uploadAt);
    expect(sendBody.slice(addMessagesAt, uploadAt)).toContain('setStreaming(true)');
    expect(sendBody).toContain('updateMessage(activeThread.id, u.id, { attachments: persistedDocuments })');
  });

  test('keeps only successful cache copies from the Android file picker', () => {
    const chat = read('src/screens/Chat.js');
    const pickerStart = chat.indexOf('const onOpenFilePress');
    const pasteStart = chat.indexOf('const createPastedTextAttachment');
    const pickerBody = chat.slice(pickerStart, pasteStart);

    expect(pickerBody).toContain("destination: 'cachesDirectory'");
    expect(pickerBody).toContain("copyResult?.status !== 'success'");
    expect(pickerBody).toContain('copyResult.localUri');
    expect(pickerBody.indexOf('await keepLocalCopy(')).toBeLessThan(
      pickerBody.indexOf('setAttachments('),
    );
  });

  test('never persists local document bytes in message history', () => {
    const helpers = read('src/lib/documentAttachments.js');
    const toPersistedBody = helpers.slice(
      helpers.indexOf('export function toPersistedAttachment'),
      helpers.indexOf('export function formatFileSize'),
    );

    expect(toPersistedBody).not.toContain('uri:');
    expect(toPersistedBody).not.toContain('base64:');
    expect(toPersistedBody).toContain('attachment.remoteId || attachment.id');
  });
});

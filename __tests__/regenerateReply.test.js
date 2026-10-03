import { regenerationPayload, regenerateReply } from '../src/lib/regenerateReply';

const thread = {
  id: 'thread', system: 'You are a planning assistant.', summary: 'FUTURE_SUMMARY',
  messages: [
    { id: 'u1', role: 'user', content: 'Original question' },
    { id: 'a1', role: 'assistant', content: 'OLD_ANSWER' },
    { id: 'u2', role: 'user', content: 'FUTURE_QUESTION' },
    { id: 'a2', role: 'assistant', content: 'FUTURE_ANSWER' },
  ],
};
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function setup(overrides = {}) {
  const options = { thread, messageId: 'a1', model: 'chosen-model',
    ensureDeviceId: jest.fn().mockResolvedValue('device'), streamChat: jest.fn(),
    onToken: jest.fn(), onCommit: jest.fn(), onError: jest.fn(), onFinish: jest.fn(), ...overrides };
  return { options, operation: regenerateReply(options) };
}
test('earlier reply excludes original answer, future turns and future summary without mutating thread', () => {
  const snapshot = JSON.stringify(thread);
  const payload = JSON.stringify(regenerationPayload(thread, 'a1', 6000));
  expect(payload).toContain('Original question');
  expect(payload).toContain('planning assistant');
  expect(payload).not.toMatch(/OLD_ANSWER|FUTURE_/);
  expect(JSON.stringify(thread)).toBe(snapshot);
});
test('keeps original images, document IDs and workspace context', () => {
  const source = { ...thread, meta: { workspaceContext: 'source facts' }, messages: [
    { ...thread.messages[0], mm: [{ type: 'text', text: 'What is this?' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }], attachments: [{ id: 'doc-id', kind: 'document' }] },
    thread.messages[1],
  ] };
  const payload = JSON.stringify(regenerationPayload(source, 'a1', 6000));
  expect(payload).toContain('data:image/png;base64,abc');
  expect(payload).toContain('doc-id');
  expect(payload).toContain('source facts');
});
test('commits only the complete answer once, using chosen model and web option', async () => {
  const { options } = setup({ allowWebSearch: true }); await flush();
  const callbacks = options.streamChat.mock.calls[0][0];
  expect(callbacks).toMatchObject({ model: 'chosen-model', allowWebSearch: true, deviceId: 'device' });
  callbacks.onToken('New '); expect(options.onCommit).not.toHaveBeenCalled();
  callbacks.onToken('answer'); callbacks.onDone(); callbacks.onDone(); callbacks.onToken('late');
  expect(options.onCommit).toHaveBeenCalledTimes(1);
  expect(options.onCommit).toHaveBeenCalledWith('New answer');
  expect(options.onFinish).toHaveBeenCalledTimes(1);
});
test.each(['cancel', 'error', 'empty'])('%s preserves original and ignores late callbacks', async kind => {
  const { options, operation } = setup(); await flush();
  const callbacks = options.streamChat.mock.calls[0][0];
  if (kind !== 'empty') callbacks.onToken('partial');
  if (kind === 'cancel') operation.abort();
  else if (kind === 'error') callbacks.onError(new Error('offline'));
  else callbacks.onDone();
  callbacks.onToken('late'); callbacks.onDone();
  expect(options.onCommit).not.toHaveBeenCalled();
  expect(options.onFinish).toHaveBeenCalledTimes(1);
  expect(thread.messages[1].content).toBe('OLD_ANSWER');
});
test('cancellation during device lookup never sends request', async () => {
  let resolve;
  const { options, operation } = setup({ ensureDeviceId: () => new Promise(r => { resolve = r; }) });
  await Promise.resolve(); operation.abort(); resolve('device'); await flush();
  expect(options.streamChat).not.toHaveBeenCalled();
});
test('invalid target and failed setup finish cleanly', async () => {
  const { options } = setup({ messageId: 'missing' }); await flush();
  expect(options.onError).toHaveBeenCalled();
  expect(options.onFinish).toHaveBeenCalledTimes(1);
  expect(options.streamChat).not.toHaveBeenCalled();
});

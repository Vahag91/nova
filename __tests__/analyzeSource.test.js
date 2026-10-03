import { analyzeSource } from '../src/api/analyzeSource';

let requests;
beforeEach(() => {
  requests = [];
  global.XMLHttpRequest = class {
    constructor() { this.upload = {}; requests.push(this); }
    open() {}
    setRequestHeader() {}
    send() { this.sent = true; }
    abort() { this.onabort?.(); }
  };
});
test('pre-cancelled analysis never sends data', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(analyzeSource({ source: {}, deviceId: 'test', signal: controller.signal })).rejects.toMatchObject({ code: 'ABORTED' });
  expect(requests[0].sent).not.toBe(true);
});
test('cancellation after sending settles once and rejects', async () => {
  const controller = new AbortController();
  const promise = analyzeSource({ source: { type: 'transcript' }, deviceId: 'test', signal: controller.signal });
  controller.abort();
  await expect(promise).rejects.toMatchObject({ code: 'ABORTED' });
});
test('server errors remain actionable', async () => {
  const promise = analyzeSource({ source: {}, deviceId: 'test' });
  Object.assign(requests[0], { status: 410, responseText: JSON.stringify({ code: 'DOCUMENT_EXPIRED' }) });
  requests[0].onload();
  await expect(promise).rejects.toMatchObject({ code: 'DOCUMENT_EXPIRED', status: 410 });
});
test('malformed success responses do not become saved briefs', async () => {
  const promise = analyzeSource({ source: {}, deviceId: 'test' });
  Object.assign(requests[0], { status: 200, responseText: '{"result":{}}' }); requests[0].onload();
  await expect(promise).rejects.toMatchObject({ code: 'INVALID_RESULT' });
});

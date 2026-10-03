jest.mock('../src/lib/storage', () => ({ Storage: {
  loadThreadIndex: jest.fn().mockResolvedValue([]),
  loadThreadState: jest.fn().mockResolvedValue({ threadIndex: [], threadsById: {} }),
  loadThreadBodies: jest.fn().mockResolvedValue({ threadIndex: [], threadsById: {}, loadSucceeded: true }),
  saveThread: jest.fn().mockResolvedValue(),
} }));
jest.mock('../src/state/useSettingsStore', () => ({ useSettingsStore: { getState: () => ({ model: 'test-model' }) } }));
import { openWorkspaceChat, WORKSPACE_CHAT_SYSTEM, documentQuestionSource } from '../src/lib/workspaceChat';
import { workspaceChatContext } from '../src/lib/workspace';
import { useThreadsStore } from '../src/state/useThreadsStore';
import { throttledSave } from '../src/lib/throttledSave';
import { Storage } from '../src/lib/storage';
import { createWorkspaceDemo } from '../src/lib/workspaceDemo';
import { buildPayload } from '../src/lib/payloadBuilder';

beforeEach(() => {
  jest.clearAllMocks();
  useThreadsStore.setState({ threadsById: {}, threadIndex: [], activeThreadId: null, hydrated: true, threadBodiesHydrated: true, threadBodiesLoadFailed: false, privateActive: false });
  Storage.saveThread.mockResolvedValue();
});
afterEach(() => throttledSave._clearQueue());

test('real thread store keeps the brief, reuses its conversation and awaits persistence', async () => {
  const record = createWorkspaceDemo('transcript'); const navigation = { navigate: jest.fn() };
  await openWorkspaceChat(record, navigation);
  const state = useThreadsStore.getState(); const thread = state.threadsById[state.activeThreadId];
  expect(thread.messages).toHaveLength(2);
  expect(thread.messages[1].content).toContain(record.result.overview);
  expect(Storage.saveThread).toHaveBeenCalledWith(expect.objectContaining({ id: thread.id, meta: expect.objectContaining({ workspaceId: record.id }) }), { throwOnError: true });
  await openWorkspaceChat(record, navigation);
  expect(Object.keys(useThreadsStore.getState().threadsById)).toHaveLength(1);
  expect(navigation.navigate).toHaveBeenCalledWith('Chat');
});

test('failed chat save stays on the workspace and retry reuses the same thread', async () => {
  const record = createWorkspaceDemo('document'); const navigation = { navigate: jest.fn() };
  let fail = true;
  Storage.saveThread.mockImplementation(async (_thread, options) => {
    if (options?.throwOnError && fail) { fail = false; throw new Error('Disk full'); }
  });
  await expect(openWorkspaceChat(record, navigation)).rejects.toThrow('Disk full');
  expect(navigation.navigate).not.toHaveBeenCalled();
  await openWorkspaceChat(record, navigation);
  expect(Object.keys(useThreadsStore.getState().threadsById)).toHaveLength(1);
  expect(navigation.navigate).toHaveBeenCalledTimes(1);
});

test('expired workspace documents disappear from history and current request without mutating saved data', () => {
  const document = { id: 'expired', kind: 'document', expiresAt: '2001-01-01T00:00:00Z' };
  const thread = { meta: { workspaceContext: 'Saved facts', workspaceDocuments: [document] }, messages: [{ role: 'user', content: 'Source', attachments: [document] }] };
  const payload = buildPayload({ thread, newMsg: { role: 'user', content: 'What next?' } });
  expect(JSON.stringify(payload)).not.toContain('expired');
  expect(thread.messages[0].attachments).toEqual([document]);
});

test('a private chat asks before a brief ends it, and stays private when declined', async () => {
  const record = createWorkspaceDemo('document'); const navigation = { navigate: jest.fn() };
  useThreadsStore.setState({ privateActive: true });
  const confirmLeavePrivate = jest.fn().mockResolvedValue(false);
  expect(await openWorkspaceChat(record, navigation, { confirmLeavePrivate })).toBe(false);
  expect(confirmLeavePrivate).toHaveBeenCalledTimes(1);
  expect(useThreadsStore.getState().privateActive).toBe(true);
  expect(Object.keys(useThreadsStore.getState().threadsById)).toHaveLength(0);
  expect(navigation.navigate).not.toHaveBeenCalled();
  confirmLeavePrivate.mockResolvedValue(true);
  expect(await openWorkspaceChat(record, navigation, { confirmLeavePrivate })).toBe(true);
  expect(useThreadsStore.getState().privateActive).toBe(false);
  expect(navigation.navigate).toHaveBeenCalledWith('Chat');
});

test('follow-up prompt and reference disclose shortened document text instead of inviting guesses', () => {
  expect(WORKSPACE_CHAT_SYSTEM).toContain('truncated=true');
  expect(workspaceChatContext(createWorkspaceDemo('document'))).toContain('truncated=true');
  useThreadsStore.setState({ privateActive: false });
});

test('document coverage note states the exact chat cut so later sections are declared unavailable', () => {
  const { documentCoverageNote } = require('../src/lib/workspace');
  const record = { type: 'document', documents: [{ id: 'd1', kind: 'document', name: 'maple-report.txt', extractedChars: 70190 }], result: createWorkspaceDemo('document').result };
  const note = documentCoverageNote(record);
  expect(note).toContain('maple-report.txt: 70,190 characters extracted');
  expect(note).toContain('first 48,000 characters');
  expect(note).toContain('NOT available');
  expect(workspaceChatContext(record)).toContain('NOT available');
  const small = documentCoverageNote({ ...record, documents: [{ ...record.documents[0], extractedChars: 300 }] });
  expect(small).toContain('300 characters extracted');
  expect(small).not.toContain('NOT available');
  expect(documentCoverageNote({ type: 'youtube', documents: [] })).toBe('');
});

test('document questions use owned source IDs, not the saved summary or the 48k chat excerpt',()=>{
 const thread={meta:{workspaceType:'document',workspaceDocuments:[{id:'source-id',expiresAt:'2099-01-01'}]},messages:[{role:'assistant',content:'Saved summary'}]};
 expect(documentQuestionSource(thread,'What does the final section say?')).toMatchObject({type:'document',mode:'question',documentIds:['source-id'],question:'What does the final section say?'});
 expect(documentQuestionSource({meta:{workspaceType:'transcript'}},'What?')).toBeNull();
 expect(()=>documentQuestionSource({...thread,meta:{...thread.meta,workspaceDocuments:[{id:'source-id',expiresAt:'2000-01-01'}]}},'Who?')).toThrow();
 expect(()=>documentQuestionSource(thread,'x'.repeat(4001))).toThrow();
});

import { supportsSourceWorkspace } from '../src/lib/sourceWorkspaceAvailability';
describe('source workspace release gate', () => {
  const originalDev = global.__DEV__;
  afterEach(() => { global.__DEV__ = originalDev; jest.resetModules(); });

  test('is disabled in production builds while the backend is on hold', () => {
    global.__DEV__ = false;
    jest.resetModules();
    expect(require('../src/constants/featureFlags').SOURCE_WORKSPACE_ENABLED).toBe(false);
  });

  test('is available for local development review', () => {
    global.__DEV__ = true;
    jest.resetModules();
    expect(require('../src/constants/featureFlags').SOURCE_WORKSPACE_ENABLED).toBe(true);
  });
});

test('backend activation requires compatible jobs and gates each source independently', () => {
  const ready = { contractVersion: 2, available: true, sources: { document: true, youtube: false, upload: true, transcript: true } };
  expect(supportsSourceWorkspace(ready)).toBe(true);
  expect(supportsSourceWorkspace(ready, 'youtube')).toBe(false);
  expect(supportsSourceWorkspace(ready, 'video')).toBe(true);
  expect(supportsSourceWorkspace({...ready,sources:{document:true}}, 'video')).toBe(false);
  for (const value of [null, {}, { ...ready, available: false }, { ...ready, contractVersion: 1 }, { ...ready, sources: {} }]) {
    expect(supportsSourceWorkspace(value)).toBe(false);
  }
});

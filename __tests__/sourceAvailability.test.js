import React from 'react';
import renderer, { act } from 'react-test-renderer';
jest.mock('../src/constants/featureFlags', () => ({ SOURCE_WORKSPACE_ENABLED: false }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue() }));
import { useSourceWorkspaceAvailability } from '../src/state/useSourceWorkspaceAvailability';
import AsyncStorage from '@react-native-async-storage/async-storage';
let enabled;
function Probe() { enabled = useSourceWorkspaceAvailability(); return null; }
test('release remains hidden before backend readiness, enables on compatible response and preserves offline access', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const originalFetch = global.fetch;
  let clock = 100000;
  const now = jest.spyOn(Date, 'now').mockImplementation(() => clock);
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
  let root;
  const mount = async () => { clock += 31000; await act(async () => { root = renderer.create(<Probe />); }); };
  const unmount = async () => { await act(async () => root.unmount()); };
  try {
    await mount(); expect(enabled).toBe(false); await unmount();
    const ready = { contractVersion: 2, available: true, sources: { document: true, youtube: false, upload: true, transcript: true } };
    global.fetch.mockResolvedValue({ ok: true, json: async () => ready });
    await mount(); expect(enabled).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('source_workspace_capabilities_v2', JSON.stringify(ready));
    await unmount();
    global.fetch.mockRejectedValue(new Error('Offline'));
    await mount(); expect(enabled).toBe(true); await unmount();
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ...ready, available: false }) });
    await mount(); expect(enabled).toBe(false); await unmount();
  } finally { global.fetch = originalFetch; now.mockRestore(); }
});

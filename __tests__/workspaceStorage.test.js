jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), setItem: jest.fn(),
}));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWorkspaceStore } from '../src/state/useWorkspaceStore';
import { createWorkspaceDemo } from '../src/lib/workspaceDemo';
const record = id => ({ ...createWorkspaceDemo('document'), id });

beforeEach(() => {
  jest.clearAllMocks();
  useWorkspaceStore.setState({ records: [], hydrated: false, error: null });
  AsyncStorage.getItem.mockResolvedValue(null);
  AsyncStorage.setItem.mockResolvedValue();
});

test('simultaneous saves preserve both results', async () => {
  await Promise.all([
    useWorkspaceStore.getState().save(record('first')),
    useWorkspaceStore.getState().save(record('second')),
  ]);
  expect(useWorkspaceStore.getState().records.map(r => r.id)).toEqual(['second', 'first']);
  expect(JSON.parse(AsyncStorage.setItem.mock.calls[1][1])).toHaveLength(2);
});
test('a failed load never overwrites existing saved data', async () => {
  AsyncStorage.getItem.mockRejectedValue(new Error('Disk read failed'));
  await expect(useWorkspaceStore.getState().save(record('new'))).rejects.toThrow();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(useWorkspaceStore.getState().error).toBe('load');
});
test('failed save leaves the previous library intact and can be retried', async () => {
  await useWorkspaceStore.getState().hydrate();
  AsyncStorage.setItem.mockRejectedValueOnce(new Error('Full storage'));
  await expect(useWorkspaceStore.getState().save(record('new'))).rejects.toThrow();
  expect(useWorkspaceStore.getState().records).toEqual([]);
  await useWorkspaceStore.getState().save(record('new'));
  expect(useWorkspaceStore.getState().records).toHaveLength(1);
});

test('malformed saved records surface a recoverable load error without overwriting data', async () => {
  AsyncStorage.getItem.mockResolvedValue(JSON.stringify([{ id: 'broken', result: { keyPoints: [{}] } }]));
  await expect(useWorkspaceStore.getState().hydrate()).rejects.toThrow();
  expect(useWorkspaceStore.getState().hydrated).toBe(false);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test('saved records strip local file paths and reload the complete brief', async () => {
  const original = { ...record('safe'), file: { uri: 'file:///private/source.mp4' } };
  await useWorkspaceStore.getState().save(original);
  const stored = AsyncStorage.setItem.mock.calls[0][1];
  expect(stored).not.toContain('file:///');
  useWorkspaceStore.setState({ hydrated: false, records: [] });
  AsyncStorage.getItem.mockResolvedValue(stored);
  await useWorkspaceStore.getState().hydrate();
  expect(useWorkspaceStore.getState().records[0].result).toEqual(original.result);
});

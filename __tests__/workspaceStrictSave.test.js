jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), multiSet: jest.fn(), removeItem: jest.fn(),
}));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Storage } from '../src/lib/storage';
const thread = { id: 'workspace', title: 'Brief', messages: [{ role: 'user', content: 'Source' }] };
beforeEach(() => {
  jest.clearAllMocks();
  AsyncStorage.getItem.mockResolvedValue('[]');
  AsyncStorage.multiSet.mockResolvedValue();
  AsyncStorage.removeItem.mockResolvedValue();
});
test('strict workspace save cannot overwrite an unreadable chat index', async () => {
  AsyncStorage.getItem.mockRejectedValue(new Error('Read failed'));
  await expect(Storage.saveThread(thread, { throwOnError: true })).rejects.toThrow('Read failed');
  expect(AsyncStorage.multiSet).not.toHaveBeenCalled();
});
test('strict save reports write errors while legacy save behavior remains unchanged', async () => {
  AsyncStorage.multiSet.mockRejectedValue(new Error('Write failed'));
  await expect(Storage.saveThread(thread, { throwOnError: true })).rejects.toThrow('Write failed');
  await expect(Storage.saveThread(thread)).resolves.toBeUndefined();
});

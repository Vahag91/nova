import * as Keychain from 'react-native-keychain';
import { v4 as uuid } from 'uuid';

const service = 'com.aicloudsolutions.cloud.workspace.v1';
let pending;
// Keep the capability out of AsyncStorage, logs and saved briefs. Never silently
// replace an unreadable key: doing so would orphan accepted server jobs.
export function ensureWorkspaceKey() {
  if (!pending)
    pending = (async () => {
      const saved = await Keychain.getGenericPassword({ service });
      if (saved) {
        if (!/^[0-9a-f]{64}$/i.test(saved.password))
          throw new Error('Invalid workspace identity');
        return saved.password;
      }
      const secret = (uuid() + uuid()).replace(/-/g, '');
      const written = await Keychain.setGenericPassword('workspace', secret, {
        service,
      });
      if (!written) throw new Error('Could not save workspace identity');
      return secret;
    })().catch(error => {
      pending = null;
      throw error;
    });
  return pending;
}

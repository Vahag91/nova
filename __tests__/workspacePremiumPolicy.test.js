import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('../src/constants/featureFlags', () => ({
  ...jest.requireActual('../src/constants/featureFlags'),
  SOURCE_WORKSPACE_REQUIRES_PREMIUM: true,
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: callback => require('react').useEffect(callback, [callback]),
  useIsFocused: () => true,
}));
jest.mock('react-native-linear-gradient', () => require('react-native').View);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAwareScrollView: require('react-native').ScrollView,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key, options) => options?.defaultValue }),
}));
jest.mock('../src/i18n/useWorkspaceTranslation', () => ({
  useWorkspaceTranslation: () => ({ c: (_key, fallback) => fallback, i18n: { language: 'en' } }),
}));
jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(), keepLocalCopy: jest.fn(), types: {}, errorCodes: {}, isErrorWithCode: () => false,
}));
jest.mock('react-native-fs', () => ({ stat: jest.fn(), unlink: jest.fn().mockResolvedValue() }));
jest.mock('../src/lib/deviceId', () => ({
  ensureDeviceId: jest.fn().mockResolvedValue('123e4567-e89b-42d3-a456-426614174000'),
}));
jest.mock('../src/lib/workspaceIdentity', () => ({
  ensureWorkspaceKey: jest.fn().mockResolvedValue('a'.repeat(64)),
}));
jest.mock('../src/state/useSourceWorkspaceAvailability', () => ({
  useSourceCapabilities: () => ({
    contractVersion: 2, available: true,
    sources: { document: true, transcript: true, upload: true, youtube: true },
  }),
}));
jest.mock('../src/context/SubscriptionContext', () => ({
  SubscriptionAccessContext: require('react').createContext(null),
}));
jest.mock('../src/components/SvgIcon', () => () => null);
jest.mock('../src/lib/workspaceChat', () => ({ openWorkspaceChat: jest.fn().mockResolvedValue(true) }));

import SourceWorkspace from '../src/screens/SourceWorkspace';
import { SubscriptionAccessContext } from '../src/context/SubscriptionContext';
import { useWorkspaceStore } from '../src/state/useWorkspaceStore';
import { useWorkspaceJobs } from '../src/state/useWorkspaceJobs';

let requests, screen;
beforeEach(() => {
  requests = [];
  global.IS_REACT_ACT_ENVIRONMENT = true;
  useWorkspaceStore.setState({ records: [], hydrated: false, error: null });
  useWorkspaceJobs.setState({ jobs: [], hydrated: false, error: false });
  global.XMLHttpRequest = class {
    constructor() { this.upload = {}; this.headers = {}; requests.push(this); }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(key, value) { this.headers[key] = value; }
    send(body) { this.body = body; }
    abort() { this.onabort?.(); }
  };
});
afterEach(async () => {
  if (screen) await act(async () => screen.unmount());
  screen = null;
});
const tap = async id => act(async () => {
  await screen.root.findAllByProps({ testID: id }).find(n => typeof n.props.onPress === 'function').props.onPress();
});
// Network-bound handlers are fired without awaiting; the transport mock never settles.
const fire = async id => act(async () => {
  screen.root.findAllByProps({ testID: id }).find(n => typeof n.props.onPress === 'function').props.onPress();
});
async function prepare(subscription) {
  const navigation = { navigate: jest.fn() };
  await act(async () => {
    screen = renderer.create(
      <SubscriptionAccessContext.Provider value={subscription}>
        <SourceWorkspace navigation={navigation} route={{ name: 'VideoSummaries' }} />
      </SubscriptionAccessContext.Provider>,
    );
  });
  await tap('workspace-mode-transcript');
  await act(async () => {
    screen.root.findAllByProps({ testID: 'workspace-transcript' })
      .find(n => typeof n.props.onChangeText === 'function')
      .props.onChangeText('The Cedar pilot enrolled 37 volunteers and has two unresolved battery issues.');
  });
  return navigation;
}

test('the policy switch ships on: workspaces require Premium like chat file upload', () => {
  expect(jest.requireActual('../src/constants/featureFlags').SOURCE_WORKSPACE_REQUIRES_PREMIUM).toBe(true);
});

test('with the switch on, a free user is sent to the existing paywall before any analysis request', async () => {
  const navigation = await prepare({ isPremium: false, paymentsEnabled: false });
  await tap('workspace-analyze');
  expect(navigation.navigate).toHaveBeenCalledWith('PaywallScreen', { returnTo: 'VideoSummaries' });
  expect(requests).toHaveLength(0);
  expect(useWorkspaceJobs.getState().jobs).toHaveLength(0);
});

test('with the switch on, a Premium user proceeds normally', async () => {
  const navigation = await prepare({ isPremium: true });
  await fire('workspace-analyze');
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(requests).toHaveLength(1);
  expect(requests[0].method).toBe('POST');
});

test('the follow-up chat action is behind the same gate', () => {
  const source = require('fs').readFileSync(require('path').join(__dirname, '..', 'src/screens/SourceWorkspace.jsx'), 'utf8');
  const body = source.slice(source.indexOf('async function continueChat()'), source.indexOf('async function previewSample()'));
  expect(body).toContain('await requirePremium()');
  expect(body).toContain('confirmLeavePrivate');
});

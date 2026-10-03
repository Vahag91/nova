import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Share } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
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
  useWorkspaceTranslation: () => ({
    c: (_key, fallback) => fallback,
    i18n: { language: 'en' },
  }),
}));
jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  keepLocalCopy: jest.fn(),
  types: {},
  errorCodes: {},
  isErrorWithCode: () => false,
}));
jest.mock('react-native-fs', () => ({
  stat: jest.fn().mockResolvedValue({ size: 281 }),
  unlink: jest.fn().mockResolvedValue(),
}));
jest.mock('../src/lib/deviceId', () => ({
  ensureDeviceId: jest
    .fn()
    .mockResolvedValue('123e4567-e89b-42d3-a456-426614174000'),
}));
jest.mock('../src/lib/workspaceIdentity', () => ({
  ensureWorkspaceKey: jest.fn().mockResolvedValue('a'.repeat(64)),
}));
jest.mock('../src/state/useSourceWorkspaceAvailability', () => ({
  useSourceCapabilities: () => ({
    contractVersion: 2,
    available: true,
    sources: { document: true, transcript: true, upload: true, youtube: true },
  }),
}));
jest.mock('../src/context/SubscriptionContext', () => ({
  // Entitled by default here; the free path is covered in workspacePremiumPolicy.test.js.
  SubscriptionAccessContext: require('react').createContext({ isPremium: true }),
}));
jest.mock('../src/components/SvgIcon', () => () => null);
jest.mock('../src/lib/workspaceChat', () => ({
  openWorkspaceChat: jest.fn().mockResolvedValue(),
}));

import SourceWorkspace from '../src/screens/SourceWorkspace';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pick, keepLocalCopy } from '@react-native-documents/picker';
import { useWorkspaceStore } from '../src/state/useWorkspaceStore';
import { useWorkspaceJobs } from '../src/state/useWorkspaceJobs';
import { openWorkspaceChat } from '../src/lib/workspaceChat';
import { createWorkspaceDemo } from '../src/lib/workspaceDemo';

let requests, screen;
const navigation = { navigate: jest.fn() };
const result = createWorkspaceDemo('document').result;
beforeEach(() => {
  jest.clearAllMocks();
  requests = [];
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.FormData = require('react-native/Libraries/Network/FormData').default;
  AsyncStorage.getItem.mockResolvedValue(null);
  AsyncStorage.setItem.mockResolvedValue();
  useWorkspaceStore.setState({ records: [], hydrated: false, error: null });
  useWorkspaceJobs.setState({ jobs: [], hydrated: false, error: false });
  global.XMLHttpRequest = class {
    constructor() {
      this.upload = {};
      this.headers = {};
      requests.push(this);
    }
    open(method, url) {
      this.url = url;
      this.method = method;
    }
    setRequestHeader(key, value) {
      this.headers[key] = value;
    }
    send(body) {
      this.body = body;
    }
    abort() {
      this.onabort?.();
    }
  };
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
});
afterEach(async () => {
  if (screen) await act(async () => screen.unmount());
  screen = null;
  jest.restoreAllMocks();
});
async function mount(name = 'Documents', params) {
  await act(async () => {
    screen = renderer.create(
      <SourceWorkspace navigation={navigation} route={{ name, params }} />,
    );
  });
}
async function press(id) {
  await act(async () => {
    await screen.root
      .findAllByProps({ testID: id })
      .find(node => typeof node.props.onPress === 'function')
      .props.onPress();
  });
}
async function respond(request, status, body) {
  await act(async () => {
    Object.assign(request, { status, responseText: JSON.stringify(body) });
    request.onload();
  });
}
const text = () => JSON.stringify(screen.toJSON());
// Fire a network-bound handler without awaiting it; respond at the transport boundary.
const fire = async id => {
  await act(async () => {
    screen.root
      .findAllByProps({ testID: id })
      .find(n => typeof n.props.onPress === 'function')
      .props.onPress();
  });
};
const start = async () => {
  await act(async () => {
    screen.root
      .findAllByProps({ testID: 'workspace-analyze' })
      .find(n => typeof n.props.onPress === 'function')
      .props.onPress();
  });
};
const change = async (id, value) => {
  await act(async () => {
    screen.root
      .findAllByProps({ testID: id })
      .find(n => typeof n.props.onChangeText === 'function')
      .props.onChangeText(value);
  });
};

test('document import → upload → analysis → saved brief → share → chat → reopen preserves readable source names', async () => {
  pick.mockResolvedValue([
    {
      uri: 'content://test/report',
      name: 'Report notes.txt',
      type: 'text/plain',
      size: 281,
    },
  ]);
  keepLocalCopy.mockResolvedValue([
    { status: 'success', localUri: 'file:///cache/report.txt' },
  ]);
  await mount();
  expect(
    screen.root.findAllByProps({ testID: 'workspace-analyze' })[0].props
      .disabled,
  ).toBe(true);
  await press('workspace-pick');
  expect(text()).toContain('Report notes.txt');
  expect(
    screen.root.findAllByProps({ testID: 'workspace-analyze' })[0].props
      .disabled,
  ).toBe(false);
  // Do not await a network-bound handler; respond at the transport boundary.
  await act(async () => {
    screen.root
      .findAllByProps({ testID: 'workspace-analyze' })
      .find(n => typeof n.props.onPress === 'function')
      .props.onPress();
  });
  expect(requests[0].url).toContain('/document-process');
  await respond(requests[0], 200, {
    attachment: {
      id: '123e4567-e89b-42d3-a456-426614174001',
      name: 'Report%20notes.txt',
      mimeType: 'text/plain',
      size: 281,
      extractedChars: 281,
      expiresAt: '2099-01-01T00:00:00Z',
    },
  });
  expect(requests[1].url).toContain('/source-analyze');
  expect(JSON.parse(requests[1].body).documentIds).toEqual([
    '123e4567-e89b-42d3-a456-426614174001',
  ]);
  await respond(requests[1], 200, {
    result: {
      ...result,
      evidence: result.evidence.map(evidence => ({
        ...evidence,
        sourceIndex: 0,
        sourceName: 'Report%20notes.txt',
      })),
    },
  });
  expect(text()).toContain(result.title);
  const record = useWorkspaceStore.getState().records[0];
  expect(record.sourceLabel).toBe('Report notes.txt');
  expect(record.documents[0].name).toBe('Report notes.txt');
  expect(record.result.evidence[0].sourceName).toBe('Report notes.txt');
  expect(text()).not.toContain('%20');
  expect(record.documents[0].expiresAt).toBe('2099-01-01T00:00:00Z');
  expect(AsyncStorage.setItem.mock.calls[0][1]).not.toContain('file:///');
  await press('workspace-share');
  expect(Share.share).toHaveBeenCalledWith(
    expect.objectContaining({
      message: expect.stringContaining(result.overview),
    }),
  );
  await press('workspace-chat');
  expect(openWorkspaceChat).toHaveBeenCalledWith(
    expect.objectContaining({ id: record.id, result: record.result }),
    navigation,
    expect.objectContaining({ confirmLeavePrivate: expect.any(Function) }),
  );
  await press('workspace-new');
  await press(`workspace-record-${record.id}`);
  expect(text()).toContain(result.overview);
});

test.each([
  'text/comma-separated-values',
  'application/vnd.ms-excel',
  'application/octet-stream',
])(
  'Android CSV import accepts provider MIME %s and uploads canonical text/csv',
  async mime => {
    pick.mockResolvedValue([
      {
        uri: 'content://downloads/cedar.csv',
        name: 'cedar.csv',
        type: mime,
        size: 65,
      },
    ]);
    keepLocalCopy.mockResolvedValue([
      { status: 'success', localUri: 'file:///cache/cedar.csv' },
    ]);
    await mount();
    await press('workspace-pick');
    expect(pick.mock.calls[0][0].type).toContain(mime);
    expect(text()).toContain('cedar.csv');
    await act(async () => {
      screen.root
        .findAllByProps({ testID: 'workspace-analyze' })
        .find(n => typeof n.props.onPress === 'function')
        .props.onPress();
    });
    expect(requests[0].url).toContain('/document-process');
    expect(
      requests[0].body.getParts().find(part => part.fieldName === 'file').type,
    ).toBe('text/csv');
    await respond(requests[0], 400, { code: 'NO_READABLE_TEXT' });
  },
);

test('analysis failure retries an uploaded document without uploading it twice', async () => {
  await mount('Documents', {
    seedId: 'seed',
    seedDocuments: [
      {
        id: '123e4567-e89b-42d3-a456-426614174001',
        kind: 'document',
        status: 'ready',
        name: 'Report.txt',
        mimeType: 'text/plain',
      },
    ],
  });
  await act(async () => {
    screen.root
      .findAllByProps({ testID: 'workspace-analyze' })
      .find(n => typeof n.props.onPress === 'function')
      .props.onPress();
  });
  await respond(requests[0], 429, { code: 'RATE_LIMITED' });
  expect(text()).toContain('today’s analysis limit');
  await act(async () => {
    screen.root
      .findAllByProps({ testID: 'workspace-analyze' })
      .find(n => typeof n.props.onPress === 'function')
      .props.onPress();
  });
  await respond(requests[1], 200, { result });
  expect(requests.every(r => r.url.includes('/source-analyze'))).toBe(true);
  expect(useWorkspaceStore.getState().records).toHaveLength(1);
});

test('sample preview renders and persists with no network request', async () => {
  await mount('VideoSummaries');
  await press('workspace-demo');
  expect(text()).toContain('LOCAL DEMO');
  expect(requests).toHaveLength(0);
  expect(useWorkspaceStore.getState().records[0].demo).toBe(true);
});

test.each(['youtube', 'transcript', 'upload'])(
  '%s transport → chapters → persistence',
  async type => {
    await mount('VideoSummaries');
    await press(`workspace-mode-${type}`);
    if (type === 'youtube')
      await change('workspace-url', 'https://youtu.be/abcdefghijk');
    if (type === 'transcript')
      await change(
        'workspace-transcript',
        '00:00 The team plans a community garden. 00:45 Alex will prepare the list.',
      );
    if (type === 'upload') {
      pick.mockResolvedValue([
        {
          uri: 'content://test/video',
          name: 'Sample.mp4',
          type: 'video/mp4',
          size: 281,
        },
      ]);
      keepLocalCopy.mockResolvedValue([
        { status: 'success', localUri: 'file:///cache/sample.mp4' },
      ]);
      await press('workspace-pick');
    }
    await start();
    expect(requests).toHaveLength(1);
    if (type !== 'upload') expect(JSON.parse(requests[0].body).type).toBe(type);
    else
      expect(
        requests[0].body.getParts().find(part => part.fieldName === 'file').uri,
      ).toBe('file:///cache/sample.mp4');
    const videoResult = createWorkspaceDemo(type).result;
    await respond(requests[0], 200, { result: videoResult });
    await press('workspace-result-details');
    expect(text()).toContain('00:45');
    await press('workspace-result-sources');
    expect(text()).toContain('kept on the analysis server for up to 7 days');
    expect(text()).toContain('No verified text excerpts');
    expect(useWorkspaceStore.getState().records[0].type).toBe(type);
  },
);

test('failed save keeps the visible result and retry saves without another analysis', async () => {
  await mount('VideoSummaries');
  await press('workspace-mode-transcript');
  await change(
    'workspace-transcript',
    'The team plans a garden and Alex will prepare a list by Friday.',
  );
  AsyncStorage.setItem.mockImplementation(async key => {
    if (key === 'source_workspace_v1') throw new Error('Disk full');
  });
  await start();
  await respond(requests[0], 200, { result });
  expect(text()).toContain('This brief could not be saved');
  expect(text()).toContain(result.overview);
  AsyncStorage.setItem.mockResolvedValue();
  await press('workspace-retry-save');
  expect(useWorkspaceStore.getState().records).toHaveLength(1);
  expect(requests).toHaveLength(1);
});

test('cancelled analysis returns to input and cannot save a late response', async () => {
  await mount('VideoSummaries');
  await press('workspace-mode-youtube');
  await change('workspace-url', 'https://youtu.be/abcdefghijk');
  await start();
  await press('workspace-cancel');
  await respond(requests[0], 200, { result });
  expect(useWorkspaceStore.getState().records).toHaveLength(0);
  expect(text()).toContain('YouTube video link');
});

test('wrong-shaped provider output is rejected rather than crashing the result screen', async () => {
  await mount('VideoSummaries');
  await press('workspace-mode-youtube');
  await change('workspace-url', 'https://youtu.be/abcdefghijk');
  await start();
  await respond(requests[0], 200, {
    result: { ...result, sections: [{ title: {}, body: 'broken' }] },
  });
  expect(text()).toContain('The analysis was incomplete');
  expect(useWorkspaceStore.getState().records).toHaveLength(0);
});

test('accepted job survives unmount and disk rehydration, then retrieves result without another POST', async () => {
  await mount('VideoSummaries');
  await press('workspace-mode-transcript');
  await change(
    'workspace-transcript',
    'The Cedar pilot enrolled 37 volunteers and has two unresolved battery issues.',
  );
  await start();
  const id = requests[0].headers['x-request-id'];
  expect(requests[0].headers['x-workspace-key']).toBe('a'.repeat(64));
  await respond(requests[0], 202, { job: { id, status: 'processing' } });
  expect(useWorkspaceJobs.getState().jobs[0].id).toBe(id);
  await press('workspace-cancel');
  const saved = JSON.stringify(useWorkspaceJobs.getState().jobs);
  await act(async () => screen.unmount());
  screen = null;
  useWorkspaceJobs.setState({ jobs: [], hydrated: false });
  AsyncStorage.getItem.mockImplementation(async key =>
    key === 'source_workspace_pending_v2' ? saved : null,
  );
  await mount('VideoSummaries');
  expect(text()).toContain('Check progress');
  await act(async () => {
    screen.root
      .findAllByProps({ testID: `workspace-resume-${id}` })
      .find(n => typeof n.props.onPress === 'function')
      .props.onPress();
  });
  expect(requests[1].method).toBe('GET');
  expect(requests[1].url).toContain(id);
  await respond(requests[1], 200, { job: { id, status: 'completed', result } });
  expect(useWorkspaceStore.getState().records[0].id).toBe(id);
  expect(useWorkspaceJobs.getState().jobs).toHaveLength(0);
  expect(requests.filter(r => r.method === 'POST')).toHaveLength(1);
});

test('pending metadata must be saved before a paid analysis is submitted', async () => {
  await mount('VideoSummaries');
  await press('workspace-mode-transcript');
  await change(
    'workspace-transcript',
    'The Cedar pilot enrolled 37 volunteers and has two unresolved battery issues.',
  );
  AsyncStorage.setItem.mockRejectedValue(new Error('Disk full'));
  await start();
  expect(requests).toHaveLength(0);
  expect(useWorkspaceJobs.getState().jobs).toHaveLength(0);
  expect(text()).toContain('could not be analyzed');
});

test('unavailable provider rejects before acceptance and does not leave an unresolvable pending job', async () => {
  await mount('VideoSummaries');
  await press('workspace-mode-transcript');
  await change(
    'workspace-transcript',
    'The Cedar pilot enrolled 37 volunteers and has two unresolved battery issues.',
  );
  await start();
  await respond(requests[0], 503, { code: 'NOT_CONFIGURED' });
  expect(useWorkspaceJobs.getState().jobs).toHaveLength(0);
  expect(text()).toContain('not available yet');
  await start();
  expect(requests).toHaveLength(2);
  await respond(requests[1], 200, { result });
  expect(useWorkspaceStore.getState().records).toHaveLength(1);
});

test('cancelling a pending analysis the server never received clears it immediately', async () => {
  await mount('VideoSummaries');
  await press('workspace-mode-transcript');
  await change(
    'workspace-transcript',
    'The Cedar pilot enrolled 37 volunteers and has two unresolved battery issues.',
  );
  await start();
  const id = requests[0].headers['x-request-id'];
  // The request is abandoned before any acknowledgement arrives.
  await press('workspace-cancel');
  expect(useWorkspaceJobs.getState().jobs[0].id).toBe(id);
  expect(text()).toContain('Cancel analysis');
  await fire(`workspace-cancel-${id}`);
  expect(requests[1].method).toBe('DELETE');
  await respond(requests[1], 404, { code: 'JOB_NOT_FOUND' });
  expect(useWorkspaceJobs.getState().jobs).toHaveLength(0);
  expect(text()).not.toContain('was not found');
  expect(requests.filter(r => r.method === 'POST')).toHaveLength(1);
});

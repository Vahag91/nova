function makeThread(id, content = 'hello') {
  return {
    id,
    title: id,
    model: 'gpt-5.4-nano',
    createdAt: 1,
    updatedAt: 1,
    messages: content
      ? [{ id: `${id}-m`, role: 'user', content, createdAt: 1 }]
      : [],
  };
}

function makeIndex(id, hasMessages = true) {
  return {
    id,
    title: id,
    preview: hasMessages ? 'hello' : '',
    hasMessages,
    createdAt: 1,
    updatedAt: 1,
  };
}

function loadThreadsStore(storageOverrides = {}) {
  jest.resetModules();
  const Storage = {
    loadThreadIndex: jest.fn().mockResolvedValue([]),
    loadThreadState: jest.fn().mockResolvedValue({
      threadIndex: [],
      threadsById: {},
    }),
    loadThreadBodies: jest.fn().mockResolvedValue({
      threadIndex: [],
      threadsById: {},
      loadSucceeded: true,
    }),
    saveThread: jest.fn().mockResolvedValue(undefined),
    saveThreadState: jest.fn().mockResolvedValue(undefined),
    deleteThread: jest.fn().mockResolvedValue([]),
    ...storageOverrides,
  };

  jest.doMock('../src/lib/storage', () => ({ Storage }));
  jest.doMock('../src/lib/throttledSave', () => ({
    throttledSave: {
      queueSave: jest.fn(),
      immediateSave: jest.fn(),
    },
  }));
  jest.doMock('../src/state/types', () => ({
    newThread: jest.fn(({ title, model, system }) => ({
      id: 'generated-thread',
      title,
      model,
      system,
      createdAt: 1,
      updatedAt: 1,
      messages: [],
    })),
  }));

  const { useThreadsStore } = require('../src/state/useThreadsStore');
  return { Storage, useThreadsStore };
}

function loadImagesStore(storageOverrides = {}, apiOverrides = {}) {
  jest.resetModules();
  const Storage = {
    loadImages: jest.fn().mockResolvedValue([]),
    saveImages: jest.fn().mockResolvedValue(undefined),
    ...storageOverrides,
  };
  const createRunwareImages = jest.fn().mockResolvedValue({
    images: [],
    size: '1024x1024',
  });
  Object.assign(createRunwareImages, apiOverrides);

  jest.doMock('../src/lib/storage', () => ({ Storage }));
  jest.doMock('../src/api/runware', () => ({ createRunwareImages }));
  jest.doMock('../src/lib/imageDownloader', () => ({
    toLocalPath: jest.fn(async value => value),
    deleteLocalFile: jest.fn(),
  }));
  jest.doMock('../src/lib/imageUtils', () => ({
    normalizeImageUri: jest.fn(value => value),
    cacheToFile: jest.fn(async value => value),
    cleanupCorruptedCache: jest.fn().mockResolvedValue(0),
  }));
  jest.doMock('../src/lib/deviceId', () => ({
    ensureDeviceId: jest.fn().mockResolvedValue('device-id'),
  }));
  jest.doMock('../src/lib/perfTrace', () => ({
    perfStart: jest.fn(),
    perfEnd: jest.fn(),
  }));
  jest.doMock('uuid', () => ({ v4: jest.fn(() => 'spend-id') }));
  jest.doMock('react-native-fs', () => ({
    __esModule: true,
    default: {
      exists: jest.fn().mockResolvedValue(true),
      stat: jest.fn().mockResolvedValue({ size: 1 }),
    },
  }));

  const { useImagesStore } = require('../src/state/useImagesStore');
  return { Storage, createRunwareImages, useImagesStore };
}

describe('startup state race protection', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  test('migrates legacy history before making an empty index writable', async () => {
    const oldThread = makeThread('legacy');
    const oldIndex = makeIndex('legacy');
    const loadThreadState = jest.fn().mockResolvedValue({
      threadIndex: [oldIndex],
      threadsById: { legacy: oldThread },
    });
    const { Storage, useThreadsStore } = loadThreadsStore({ loadThreadState });

    await useThreadsStore.getState().hydrate();

    expect(Storage.loadThreadState).toHaveBeenCalledTimes(1);
    expect(useThreadsStore.getState()).toMatchObject({
      hydrated: true,
      threadBodiesHydrated: true,
      threadIndex: [oldIndex],
      threadsById: { legacy: oldThread },
    });
  });

  test('keeps the current empty chat while deferred old bodies load', async () => {
    const oldThread = makeThread('old');
    const oldIndex = makeIndex('old');
    const localThread = makeThread('local', '');
    const localIndex = makeIndex('local', false);
    const { useThreadsStore } = loadThreadsStore({
      loadThreadIndex: jest.fn().mockResolvedValue([oldIndex]),
      loadThreadBodies: jest.fn().mockResolvedValue({
        threadIndex: [oldIndex],
        threadsById: { old: oldThread },
        loadSucceeded: true,
      }),
    });

    await useThreadsStore.getState().hydrate();
    useThreadsStore.setState({
      threadIndex: [localIndex, oldIndex],
      threadsById: { local: localThread },
      activeThreadId: 'local',
    });
    await useThreadsStore.getState().hydrateThreadBodies();

    const state = useThreadsStore.getState();
    expect(state.activeThreadId).toBe('local');
    expect(state.threadsById.local).toBe(localThread);
    expect(state.threadsById.old).toEqual(oldThread);
  });

  test('does not resurrect a thread deleted during a deferred body read', async () => {
    const oldThread = makeThread('old');
    const oldIndex = makeIndex('old');
    let resolveBodies;
    const loadThreadBodies = jest.fn(
      () => new Promise(resolve => { resolveBodies = resolve; }),
    );
    const { useThreadsStore } = loadThreadsStore({
      loadThreadIndex: jest.fn().mockResolvedValue([oldIndex]),
      loadThreadBodies,
    });

    await useThreadsStore.getState().hydrate();
    const hydration = useThreadsStore.getState().hydrateThreadBodies();
    await Promise.resolve();
    await Promise.resolve();
    expect(loadThreadBodies).toHaveBeenCalledTimes(1);

    useThreadsStore.getState().deleteThread('old');
    resolveBodies({
      threadIndex: [oldIndex],
      threadsById: { old: oldThread },
      loadSucceeded: true,
    });
    await hydration;

    expect(useThreadsStore.getState().threadIndex).toEqual([]);
    expect(useThreadsStore.getState().threadsById.old).toBeUndefined();
  });

  test('keeps metadata and exposes retry after two body read failures', async () => {
    const oldIndex = makeIndex('old');
    const loadThreadBodies = jest.fn().mockResolvedValue({
      threadIndex: [],
      threadsById: {},
      loadSucceeded: false,
    });
    const { useThreadsStore } = loadThreadsStore({
      loadThreadIndex: jest.fn().mockResolvedValue([oldIndex]),
      loadThreadBodies,
    });

    await useThreadsStore.getState().hydrate();
    await useThreadsStore.getState().hydrateThreadBodies();

    const state = useThreadsStore.getState();
    expect(loadThreadBodies).toHaveBeenCalledTimes(2);
    expect(state.threadIndex).toEqual([oldIndex]);
    expect(state.threadBodiesHydrated).toBe(false);
    expect(state.threadBodiesLoadFailed).toBe(true);
  });

  test('waits for gallery hydration before saving a newly charged image job', async () => {
    const existingJob = {
      id: 'existing',
      prompt: 'old image',
      model: 'runware-flux-schnell',
      size: '1024x1024',
      status: 'done',
      images: [],
      createdAt: 1,
      updatedAt: 1,
    };
    let resolveImages;
    const loadImages = jest.fn(
      () => new Promise(resolve => { resolveImages = resolve; }),
    );
    const { Storage, createRunwareImages, useImagesStore } = loadImagesStore({
      loadImages,
    });

    const generation = useImagesStore.getState().createJob({ prompt: 'new image' });
    await Promise.resolve();
    await Promise.resolve();
    expect(createRunwareImages).not.toHaveBeenCalled();

    resolveImages([existingJob]);
    await generation;

    const jobs = useImagesStore.getState().jobs;
    expect(jobs.some(job => job.id === 'existing')).toBe(true);
    expect(jobs).toHaveLength(2);
    expect(Storage.saveImages).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'existing' })]),
    );
  });
});

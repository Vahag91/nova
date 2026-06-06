import {
  STARTUP_TASK_TIMEOUT_MS,
  StartupTimeoutError,
  runStartupTask,
} from '../src/lib/startupTimeout';

describe('startup task timeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('continues with fallback after a startup task exceeds three seconds', async () => {
    const onError = jest.fn();
    const pending = runStartupTask(() => new Promise(() => {}), {
      label: 'checkFirstLaunch',
      onError,
    });

    jest.advanceTimersByTime(STARTUP_TASK_TIMEOUT_MS);

    await expect(pending).resolves.toBeUndefined();
    expect(STARTUP_TASK_TIMEOUT_MS).toBe(3000);
    expect(onError).toHaveBeenCalledWith(
      expect.any(StartupTimeoutError),
      expect.objectContaining({ context: 'checkFirstLaunch', timedOut: true }),
    );
  });

  test('returns completed startup task results before the timeout', async () => {
    const pending = runStartupTask(() => Promise.resolve('ready'), {
      label: 'localState',
    });

    await expect(pending).resolves.toBe('ready');
  });

  test('continues when startup error reporting also fails', async () => {
    const pending = runStartupTask(
      () => Promise.reject(new Error('initialization failed')),
      {
        label: 'initializeSdk',
        onError: () => {
          throw new Error('logger failed');
        },
      },
    );

    await expect(pending).resolves.toBeUndefined();
  });
});

export const STARTUP_TASK_TIMEOUT_MS = 3000;

export class StartupTimeoutError extends Error {
  constructor(label, timeoutMs) {
    super(`${label} timed out after ${timeoutMs} ms`);
    this.name = 'StartupTimeoutError';
    this.code = 'STARTUP_TIMEOUT';
    this.task = label;
    this.timeoutMs = timeoutMs;
  }
}

export function withStartupTimeout(
  task,
  { label = 'startupTask', timeoutMs = STARTUP_TASK_TIMEOUT_MS } = {},
) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new StartupTimeoutError(label, timeoutMs));
    }, timeoutMs);

    Promise.resolve()
      .then(() => task())
      .then(
        value => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        },
        error => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(error);
        },
      );
  });
}

export async function runStartupTask(
  task,
  { label = 'startupTask', timeoutMs = STARTUP_TASK_TIMEOUT_MS, onError } = {},
) {
  try {
    return await withStartupTimeout(task, { label, timeoutMs });
  } catch (error) {
    if (onError) {
      try {
        onError(error, {
          context: label,
          timedOut: error instanceof StartupTimeoutError,
        });
      } catch {
        // Error reporting must not prevent startup from continuing.
      }
    }
    return undefined;
  }
}

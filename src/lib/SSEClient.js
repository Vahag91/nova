// Lightweight SSE client for React Native (XHR progressive parsing)
// Features: retries, backoff, heartbeat, abort.
// Usage: see "streamChat" wrapper below.

export class SSEClient {
  constructor(url, {
    method = 'POST',
    headers = {},
    body = null,
    parseLine = defaultParseLine,
    onEvent,        // (evt) full parsed event object
    onOpen,         // () stream started
    onError,        // (err) network or protocol error
    onClose,        // ({ reason, code }) final close after abort/complete
    retryDelays = [1000, 2000, 4000, 8000, 16000], // ms
    heartbeatInterval = 15000, // ms; if no new bytes, reconnect
    timeoutMs = 60000,         // overall request timeout (ms)
    inactivityTimeoutMs = 30000, // ms; abort if no data for this long
    log = false,
  } = {}) {
    this.url = url;
    this.opts = { method, headers, body, parseLine, onEvent, onOpen, onError, onClose, retryDelays, heartbeatInterval, timeoutMs, inactivityTimeoutMs, log };
    this._xhr = null;
    this._aborted = false;
    this._retryIndex = 0;
    this._cursor = 0;
    this._lastProgressAt = 0;
    this._heartbeatTimer = null;
    this._timeoutTimer = null;
    this._inactivityTimer = null;
  }

  start() {
    this._aborted = false;
    this._retryIndex = 0;
    this._connect();
    return this;
  }

  abort(reason = 'client_abort') {
    this._aborted = true;
    try { this._xhr && this._xhr.abort(); } catch {}
    this._clearTimers();
    this.opts.onClose?.({ reason, code: 'ABORT' });
  }

  _connect() {
    if (this._aborted) return;
    const xhr = new XMLHttpRequest();
    this._xhr = xhr;
    this._cursor = 0;
    this._lastProgressAt = Date.now();

    xhr.open(this.opts.method, this.url);
    // required headers
    xhr.setRequestHeader('Content-Type', 'application/json');
    Object.entries(this.opts.headers || {}).forEach(([k, v]) => {
      try { xhr.setRequestHeader(k, v); } catch {}
    });

    const onProgress = () => {
      const text = xhr.responseText ?? '';
      if (text.length <= this._cursor) return;

      const newChunk = text.slice(this._cursor);
      this._cursor = text.length;
      this._lastProgressAt = Date.now();
      this._resetInactivityTimer();

      const lines = newChunk.replace(/\r/g, '').split('\n');
      for (let line of lines) {
        line = line.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const evt = this.opts.parseLine(payload);
          if (evt) this.opts.onEvent?.(evt);
        } catch (e) {
          this._log('parse error', e);
        }
      }
    };

    xhr.onprogress = onProgress;

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 2) { // HEADERS_RECEIVED
        this._log('open');
        this.opts.onOpen?.();
        this._armHeartbeat();
        this._armTimeout();
        this._resetInactivityTimer();
      }
      if (xhr.readyState === 4) { // DONE
        // flush any remaining bytes
        try { onProgress(); } catch {}
        const ok = xhr.status >= 200 && xhr.status < 300;
        this._clearTimers();

        if (this._aborted) return; // already handled

        if (ok) {
          this.opts.onClose?.({ reason: 'complete', code: xhr.status });
        } else {
          const err = { code: xhr.status, message: xhr.responseText || 'HTTP error' };
          this.opts.onError?.(err);
          this._scheduleRetry();
        }
      }
    };

    xhr.onerror = () => {
      this._clearTimers();
      if (this._aborted) return;
      this.opts.onError?.({ code: 'NETWORK', message: 'Network error' });
      this._scheduleRetry();
    };

    xhr.ontimeout = () => {
      this._clearTimers();
      if (this._aborted) return;
      this.opts.onError?.({ code: 'TIMEOUT', message: 'Request timed out' });
      this._scheduleRetry();
    };

    if (this.opts.timeoutMs) xhr.timeout = this.opts.timeoutMs;

    const body = typeof this.opts.body === 'string'
      ? this.opts.body
      : (this.opts.body ? JSON.stringify(this.opts.body) : null);

    xhr.send(body);
  }

  _scheduleRetry() {
    if (this._aborted) return;
    const delay = this.opts.retryDelays[Math.min(this._retryIndex, this.opts.retryDelays.length - 1)];
    this._retryIndex++;
    this._log('retry in', delay, 'ms');
    setTimeout(() => this._connect(), delay);
  }

  _armHeartbeat() {
    if (!this.opts.heartbeatInterval) return;
    this._heartbeatTimer = setInterval(() => {
      const idle = Date.now() - this._lastProgressAt;
      if (idle > this.opts.heartbeatInterval * 2) {
        this._log('heartbeat missed, reconnecting');
        try { this._xhr && this._xhr.abort(); } catch {}
        this._scheduleRetry();
      }
    }, this.opts.heartbeatInterval);
  }

  _armTimeout() {
    if (!this.opts.timeoutMs) return;
    this._timeoutTimer = setTimeout(() => {
      this._log('global timeout, abort');
      try { this._xhr && this._xhr.abort(); } catch {}
      this.opts.onError?.({ code: 'GLOBAL_TIMEOUT', message: 'Global timeout' });
      this._scheduleRetry();
    }, this.opts.timeoutMs * 1.5); // slightly beyond xhr timeout
  }

  _resetInactivityTimer() {
    if (this._inactivityTimer) clearTimeout(this._inactivityTimer);
    if (!this.opts.inactivityTimeoutMs) return;
    
    this._inactivityTimer = setTimeout(() => {
      this._log('inactivity timeout, aborting');
      try { this._xhr && this._xhr.abort(); } catch {}
      this.opts.onError?.({ code: 'INACTIVITY_TIMEOUT', message: 'No data received (timeout).' });
    }, this.opts.inactivityTimeoutMs);
  }

  _clearTimers() {
    if (this._heartbeatTimer) clearInterval(this._heartbeatTimer);
    if (this._timeoutTimer) clearTimeout(this._timeoutTimer);
    if (this._inactivityTimer) clearTimeout(this._inactivityTimer);
    this._heartbeatTimer = null;
    this._timeoutTimer = null;
    this._inactivityTimer = null;
  }

  _log(...args) {
    if (this.opts.log) console.log('[SSEClient]', ...args);
  }
}

// default line parser: payload is JSON string -> object
function defaultParseLine(payload) {
  return JSON.parse(payload);
}

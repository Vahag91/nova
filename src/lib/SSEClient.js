// Lightweight SSE client for React Native (XHR progressive parsing)
// - Understands SSE blocks with optional `event:` header
// - Works with OpenAI Responses SSE as well as your proxy's normalized JSON-per-line
// - Retries, heartbeats, inactivity & global timeouts

export class SSEClient {
  constructor(url, {
    method = 'POST',
    headers = {},
    body = null,
    parseLine = defaultParseLine,  // (jsonPayload[, evtName]) -> object
    onEvent,        // (evt) full parsed event object
    onOpen,         // () stream started
    onError,        // (err) network or protocol error
    onClose,        // ({ reason, code }) final close after abort/complete
    retryDelays = [1000, 2000, 4000, 8000, 16000], // ms
    retryPolicy = 'always',     // 'none' | 'network-only' | 'always'
    heartbeatInterval = 15000,  // ms; if no new bytes, reconnect
    timeoutMs = 60000,          // overall request timeout (ms)
    inactivityTimeoutMs = 30000,// ms; abort if no data for this long
    log = false,
  } = {}) {
    this.url = url;
    this.opts = { method, headers, body, parseLine, onEvent, onOpen, onError, onClose, retryDelays, retryPolicy, heartbeatInterval, timeoutMs, inactivityTimeoutMs, log };
    this._xhr = null;
    this._aborted = false;
    this._finished = false;      // ✅ NEW: prevents duplicate terminal callbacks
    this._retryIndex = 0;
    this._connId = 0;            // connection ID for debugging
    this._sawDoneEvent = false;  // ✅ NEW: tracks if provider sent 'done'

    this._buf = '';             // raw text buffer (SSE framing)
    this._lastProgressAt = 0;

    this._heartbeatTimer = null;
    this._timeoutTimer = null;
    this._inactivityTimer = null;
  }

  start() {
    this._aborted = false;
    this._finished = false;      // ✅ Reset on new start
    this._sawDoneEvent = false;  // ✅ Reset done flag
    this._retryIndex = 0;
    this._connect();
    return this;
  }

  abort(reason = 'client_abort') {
    this._log('client aborted');  // ✅ ADD LOG
    this._aborted = true;
    try { this._xhr && this._xhr.abort(); } catch {}
    this._terminate('client_abort', 'ABORT', false);
  }

  // ✅ NEW: Central termination handler - ensures cleanup happens exactly once
  _terminate(reason, code, shouldCallError = false) {
    if (this._finished) return;  // Already terminated, prevent duplicates
    this._finished = true;
    this._clearTimers();
    
    this._log('terminate:', reason, code);  // ✅ ADD LOG
    
    if (shouldCallError) {
      this.opts.onError?.({ code, message: this._getErrorMessage(reason, code) });
    }
    
    this.opts.onClose?.({ reason, code, sawDoneEvent: this._sawDoneEvent });
  }

  _getErrorMessage(reason, code) {
    switch (reason) {
      case 'http_error': return `HTTP error ${code}`;
      case 'network_error': return 'Network connection failed';
      case 'timeout': return 'Request timed out';
      case 'global_timeout': return 'Global timeout exceeded';
      case 'inactivity_timeout': return 'No data received (inactivity timeout)';
      case 'heartbeat_failed': return 'Heartbeat check failed';
      default: return 'Stream error';
    }
  }

  _connect() {
    if (this._aborted) return;
    this._connId++;                 // ✅ increment connection ID
    const xhr = new XMLHttpRequest();
    this._xhr = xhr;
    this._buf = '';
    this._workBuf = '';              // ✅ reset parse buffer
    this._lastProgressAt = Date.now();

    xhr.open(this.opts.method, this.url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    Object.entries(this.opts.headers || {}).forEach(([k, v]) => {
      try { xhr.setRequestHeader(k, v); } catch {}
    });

    xhr.onprogress = () => this._onProgress(xhr);

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 2) { // HEADERS_RECEIVED
        this._log('open');
        this.opts.onOpen?.();
        this._armHeartbeat();
        this._armTimeout();
        this._resetInactivityTimer();
      }
      if (xhr.readyState === 4) { // DONE
        // flush remaining
        try { this._onProgress(xhr, true); } catch {}
        const ok = xhr.status >= 200 && xhr.status < 300;
        this._xhr = null;  // Release XHR reference

        if (this._aborted || this._finished) return;  // ✅ Already handled

        if (ok) {
          // ✅ Success path - clean completion
          this._terminate('complete', xhr.status, false);
        } else {
          // ✅ HTTP error - call error + close, then maybe retry
          this._terminate('http_error', xhr.status, true);
          this._scheduleRetry('http_error');
        }
      }
    };

    xhr.onerror = () => {
      if (this._aborted || this._finished) return;  // ✅ Already handled
      this._xhr = null;
      // ✅ Network error - call error + close, then maybe retry
      this._terminate('network_error', 'NETWORK', true);
      this._scheduleRetry('network_error');
    };

    xhr.ontimeout = () => {
      if (this._aborted || this._finished) return;  // ✅ Already handled
      this._xhr = null;
      // ✅ Timeout - call error + close, then maybe retry
      this._terminate('timeout', 'TIMEOUT', true);
      this._scheduleRetry('timeout');
    };

    if (this.opts.timeoutMs) xhr.timeout = this.opts.timeoutMs;

    const body = typeof this.opts.body === 'string'
      ? this.opts.body
      : (this.opts.body ? JSON.stringify(this.opts.body) : null);

    xhr.send(body);
  }

  _onProgress(xhr, finalFlush = false) {
    const text = xhr.responseText ?? '';
    if (!text) return;

    // Append and process in SSE frames
    const fresh = text.slice(this._buf.length);
    if (!fresh && !finalFlush) return;

    this._buf = text;
    this._lastProgressAt = Date.now();
    this._resetInactivityTimer();

    // Normalize line endings
    let chunk = fresh.replace(/\r/g, '');

    // If we didn't get anything fresh, try to parse remaining (final flush)
    if (finalFlush && !chunk && text) {
      chunk = text.replace(/\r/g, '');
    }

    // Accumulate into a working buffer for block parsing
    if (!this._workBuf) this._workBuf = '';
    this._workBuf += chunk;

    // Parse complete SSE events separated by blank line
    let idx;
    while ((idx = this._workBuf.indexOf('\n\n')) >= 0) {
      const rawBlock = this._workBuf.slice(0, idx);
      this._workBuf = this._workBuf.slice(idx + 2);


      // Parse the block: may contain multiple 'data:' lines and optional 'event:'
      let evtName = '';
      let dataStr = '';
      const lines = rawBlock.split('\n');
      for (const lineRaw of lines) {
        const line = lineRaw.trimEnd(); // keep leading spaces inside data if any
        if (!line) continue;
        if (line.startsWith('event:')) {
          evtName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const piece = line.slice(5).trim();
          dataStr += (dataStr ? '\n' : '') + piece;
        }
      }

      if (!dataStr) continue;
      if (dataStr === '[DONE]') {
        this._sawDoneEvent = true;  // ✅ Track done event
        this.opts.onEvent?.({ type: 'done' });
        continue;
      }

      try {
        const evt = this.opts.parseLine(dataStr, evtName);
        if (evt) {
          if (evt.type === 'done') {
            this._sawDoneEvent = true;  // ✅ Track done event from parsed data
          }
          this.opts.onEvent?.(evt);
        }
      } catch (e) {
        this._log('parse error', e);
      }
    }
  }

  _scheduleRetry(reason) {
    // ✅ NEW: Respect retry policy and finished state
    if (this._finished || this._aborted) return;
    
    // Check retry policy
    if (this.opts.retryPolicy === 'none') {
      this._log('retries disabled by policy');
      return;
    }
    
    if (this.opts.retryPolicy === 'network-only') {
      const networkReasons = ['network_error', 'timeout', 'heartbeat_failed'];
      if (!networkReasons.includes(reason)) {
        this._log('retry skipped - not a network error');
        return;
      }
    }
    
    // Check if we have retry delays left
    if (!this.opts.retryDelays || this.opts.retryDelays.length === 0) {
      this._log('no retry delays configured');
      return;
    }
    
    const delay = this.opts.retryDelays[Math.min(this._retryIndex, this.opts.retryDelays.length - 1)];
    this._retryIndex++;
    this._log('retry in', delay, 'ms (attempt', this._retryIndex, ')');
    setTimeout(() => {
      if (!this._finished && !this._aborted) {
        this._connect();
      }
    }, delay);
  }

  _armHeartbeat() {
    if (!this.opts.heartbeatInterval) return;
    this._heartbeatTimer = setInterval(() => {
      if (this._finished || this._aborted) return;  // ✅ Don't act if already done
      const idle = Date.now() - this._lastProgressAt;
      if (idle > this.opts.heartbeatInterval * 2) {
        this._log('heartbeat missed, reconnecting');
        try { this._xhr && this._xhr.abort(); } catch {}
        this._xhr = null;
        // ✅ Use _terminate for clean state
        this._terminate('heartbeat_failed', 'HEARTBEAT', true);
        this._scheduleRetry('heartbeat_failed');
      }
    }, this.opts.heartbeatInterval);
  }

  _armTimeout() {
    if (!this.opts.timeoutMs) return;
    this._timeoutTimer = setTimeout(() => {
      if (this._finished || this._aborted) return;  // ✅ Don't act if already done
      this._log('global timeout, abort');
      try { this._xhr && this._xhr.abort(); } catch {}
      this._xhr = null;
      // ✅ Use _terminate for clean state
      this._terminate('global_timeout', 'GLOBAL_TIMEOUT', true);
      this._scheduleRetry('global_timeout');
    }, this.opts.timeoutMs * 1.5);
  }

  _resetInactivityTimer() {
    if (this._inactivityTimer) clearTimeout(this._inactivityTimer);
    if (!this.opts.inactivityTimeoutMs) return;
    this._inactivityTimer = setTimeout(() => {
      if (this._finished || this._aborted) return;  // ✅ Don't act if already done
      this._log('inactivity timeout, aborting');
      try { this._xhr && this._xhr.abort(); } catch {}
      this._xhr = null;
      // ✅ Use _terminate for clean state
      this._terminate('inactivity_timeout', 'INACTIVITY_TIMEOUT', true);
      this._scheduleRetry('inactivity_timeout');
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
    // Logging disabled for production
  }
}

// Default parser:
// - If payload already includes a `type`, pass through (works with your proxy).
// - If it's raw OpenAI Responses SSE, map event names to {type:'token'|'done'|'error'}.
function defaultParseLine(payload /*, evtName */) {
  const evtName = arguments[1]; // accept optional second arg without changing signature
  let obj;
  try {
    obj = JSON.parse(payload);
  } catch {
    // Non-JSON payload; return as-is
    return { type: 'data', payload, event: evtName };
  }

  // If your proxy already normalized: {type:'token'|'done'|'error', ...}
  if (obj && typeof obj === 'object' && obj.type) return obj;

  // Map common OpenAI Responses events
  switch (evtName) {
    case 'response.output_text.delta':
      if (typeof obj.delta === 'string' || typeof obj.output_text_delta === 'string') {
        return { type: 'token', delta: obj.delta || obj.output_text_delta };
      }
      return null;
    case 'response.completed':
      return { type: 'done' };
    case 'response.error':
      return { type: 'error', ...obj };
    default:
      // Unknown event; still surface
      return { type: 'event', event: evtName || 'message', ...obj };
  }
}

export default SSEClient;

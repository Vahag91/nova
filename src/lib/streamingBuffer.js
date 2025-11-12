// Simple global bus with throttled subscriptions for streaming text
const _buffers = new Map();         // id -> string
const _listeners = new Map();       // id -> Set<fn>

export function appendStream(id, chunk) {
  if (!id || typeof chunk !== 'string' || !chunk) {
    return;
  }
  
  const before = _buffers.get(id) || '';
  const after = before + chunk;
  _buffers.set(id, after);
  
  const set = _listeners.get(id);
  if (set && set.size) {
    const fns = Array.from(set);
    for (const fn of fns) {
      try { fn(); } catch { /* swallow listener error */ }
    }
  }
}

export function getStream(id) { 
  return _buffers.get(id) || ''; 
}

export function clearStream(id) { 
  _buffers.delete(id); 
  _listeners.delete(id); 
}

export function hasStream(id) { 
  return _buffers.has(id); 
}

export function subscribeStream(id, cb, { throttleMs = 120 } = {}) {
  let t = null, queued = false;
  const fire = () => {
    if (t) { queued = true; return; }
    cb(); // first fire immediately
    t = setTimeout(() => {
      t = null;
      if (queued) { queued = false; cb(); }
    }, throttleMs);
  };

  let set = _listeners.get(id);
  if (!set) { set = new Set(); _listeners.set(id, set); }
  set.add(fire);

  return () => {
    const s = _listeners.get(id);
    if (!s) return;
    s.delete(fire);
    if (s.size === 0) _listeners.delete(id);
    if (t) { clearTimeout(t); t = null; }
  };
}

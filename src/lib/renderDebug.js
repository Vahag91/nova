// Lightweight render/debug helpers for dev builds
import { useEffect, useRef } from 'react';

const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

function shallowDiff(prev, next) {
  const changed = [];
  const prevKeys = Object.keys(prev || {});
  const nextKeys = Object.keys(next || {});
  const all = Array.from(new Set([...prevKeys, ...nextKeys]));
  for (const k of all) {
    if (prev?.[k] !== next?.[k]) changed.push(k);
  }
  return changed;
}

export function useRenderDebug(name, summary = {}, options = {}) {
  const { trace = false } = options || {};
  const enabled = isDev && (typeof global !== 'undefined' ? global.__RENDER_DEBUG_ENABLED__ !== false : true);
  const countRef = useRef(0);
  const prevRef = useRef();

  if (enabled) {
    const count = ++countRef.current;
    const prev = prevRef.current || {};
    const changed = shallowDiff(prev, summary);
    const label = `[Render] ${name} #${count}${changed.length ? ` changed: ${changed.join(', ')}` : ' (no top-level changes)'}`;
    // Group logs for readability but avoid heavy nesting
    try {
      if (console.groupCollapsed) console.groupCollapsed(label);
      else console.log(label);
      console.log('summary:', summary);
      if (trace && console.trace) console.trace('[trace]');
    } catch {}
    try { if (console.groupEnd) console.groupEnd(); } catch {}
  }

  useEffect(() => {
    prevRef.current = summary;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });
}

// Utility to toggle globally at runtime if needed
export function setRenderDebugEnabled(v) {
  try { if (typeof global !== 'undefined') global.__RENDER_DEBUG_ENABLED__ = !!v; } catch {}
}


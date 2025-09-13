export async function readSSE(stream, onEvent) {
  const reader = stream.getReader();
  const dec = new TextDecoder('utf-8');
  let buf = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });

    // Normalize newlines and handle CRLF
    const parts = buf.replace(/\r/g, '').split('\n');
    buf = parts.pop() || '';

    for (let line of parts) {
      line = line.trim();
      if (!line || !line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const evt = JSON.parse(payload);
        console.log('SSE Parser: Successfully parsed event:', evt);
        onEvent?.(evt);
      } catch (e) {
        console.log('SSE Parser: Failed to parse payload:', payload, 'Error:', e.message);
        /* ignore partial fragments */
      }
    }
  }
}

export function sseHeaders() {
  return new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
}

export function writeEvent(controller, obj) {
  const line = `data: ${JSON.stringify(obj)}\n\n`;
  controller.enqueue(new TextEncoder().encode(line));
}

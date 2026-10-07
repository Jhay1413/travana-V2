// Tiny fan-out for the app's single SSE stream. The one EventSource lives in
// features/conversations (use-conversations-realtime.ts); other features that
// need a named event subscribe here instead of opening a second connection.

type Handler = (data: unknown) => void;

const handlers = new Map<string, Set<Handler>>();

/** Synthetic event emitted on every (re)connect: anything raised while the stream was down is gone. */
export const REALTIME_STREAM_OPEN = "stream.open";

export function subscribeRealtime(type: string, handler: Handler): () => void {
  const set = handlers.get(type) ?? new Set<Handler>();
  set.add(handler);
  handlers.set(type, set);
  return () => {
    set.delete(handler);
    if (set.size === 0) handlers.delete(type);
  };
}

export function emitRealtime(type: string, data?: unknown): void {
  handlers.get(type)?.forEach((handler) => handler(data));
}

import { EventEmitter } from "node:events";
import type { RealtimeEvent } from "./realtime.types";

// Singleton in-process event bus, namespaced by orgId (the emitter's event
// name IS the orgId — that namespacing is the tenant guard). Under the
// Reserved VM (single always-on instance) deployment this bus IS the real
// delivery mechanism; it's kept behind this publish/subscribe interface so a
// future multi-instance deployment could swap it for Postgres LISTEN/NOTIFY
// or Redis pub/sub without touching any caller.
//
// This is infra, like a logger — services may import it directly.
const emitter = new EventEmitter();

// Many concurrent SSE subscribers (one per open staff tab, across every org)
// share this single emitter instance. Node's default cap of 10 listeners
// would log spurious MaxListenersExceeded warnings well before that's a real
// problem, so raise it generously. Listener count is bounded by real
// connections (each unsubscribes on stream close), not by an unbounded loop.
emitter.setMaxListeners(0); // 0 = unlimited

export const eventBus = {
  publish(orgId: string, event: RealtimeEvent): void {
    emitter.emit(orgId, event);
  },

  // Returns an unsubscribe function.
  subscribe(orgId: string, handler: (event: RealtimeEvent) => void): () => void {
    emitter.on(orgId, handler);
    return () => {
      emitter.off(orgId, handler);
    };
  },
};

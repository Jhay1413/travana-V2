import { eventBus } from "./event-bus";
import type { RealtimeEvent } from "./realtime.types";

// Max concurrent SSE streams a single authenticated user may hold open (e.g.
// several browser tabs). Beyond the cap, the OLDEST connection for that user
// is evicted in favour of the newest — "newest tab wins" matches user
// expectations better than rejecting the new connection.
export const MAX_CONNECTIONS_PER_USER = 5;

interface TrackedConnection {
  id: number;
  close: () => void;
}

// Per-user connection bookkeeping. Deliberately kept here and NOT in
// event-bus.ts — the bus stays a pure pub/sub primitive with no notion of
// "connections" or per-user limits.
const connectionsByUser = new Map<string, TrackedConnection[]>();
let nextConnectionId = 0;

// Thin pass-through to the event bus — no Express types, no `res`. Exists so
// the controller (the only layer allowed to touch HTTP) never imports the
// bus directly, matching the Route → Controller → Service layering.
export const realtimeService = {
  publish(orgId: string, event: RealtimeEvent): void {
    eventBus.publish(orgId, event);
  },

  subscribe(orgId: string, handler: (event: RealtimeEvent) => void): () => void {
    return eventBus.subscribe(orgId, handler);
  },

  /**
   * Registers a new SSE connection for `userId`. When the user is already at
   * MAX_CONNECTIONS_PER_USER, the oldest connection's `close` callback runs
   * before the new one is tracked (the controller supplies `close` — it owns
   * the actual `res`, this only owns the bookkeeping). Returns the live
   * connection count for that user and an `unregister` function the caller
   * MUST invoke on stream close.
   */
  registerConnection(userId: string, close: () => void): { count: number; unregister: () => void } {
    const id = nextConnectionId++;
    const connections = connectionsByUser.get(userId) ?? [];

    if (connections.length >= MAX_CONNECTIONS_PER_USER) {
      const oldest = connections.shift();
      oldest?.close();
    }

    connections.push({ id, close });
    connectionsByUser.set(userId, connections);

    return {
      count: connections.length,
      unregister: () => {
        const current = connectionsByUser.get(userId);
        if (!current) return;
        const remaining = current.filter((conn) => conn.id !== id);
        if (remaining.length > 0) connectionsByUser.set(userId, remaining);
        else connectionsByUser.delete(userId);
      },
    };
  },
};

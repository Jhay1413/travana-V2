import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler";
import { getScope } from "../utils/scope";
import { realtimeService } from "./realtime.service";
import type { RealtimeEvent } from "./realtime.types";

const HEARTBEAT_MS = 25_000;

export const realtimeController = {
  // GET /api/v2/realtime/stream — one long-lived SSE connection per browser
  // tab (the client keeps a single shared EventSource). Cookie-authenticated
  // via the same isAuthenticated + orgBranchScope middleware as every other
  // v2 route, so this owns the `res` and is the only place in this module
  // that touches HTTP.
  stream: asyncHandler(async (req: Request, res: Response) => {
    const { orgId, userId } = getScope(req);
    const openedAt = Date.now();

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let closed = false;
    const write = (chunk: string): void => {
      if (closed) return;
      res.write(chunk);
    };

    // Lets the client's onopen handler fire a broad resync invalidation.
    write(": connected\n\n");

    const unsubscribe = realtimeService.subscribe(orgId, (event: RealtimeEvent) => {
      write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });

    const heartbeat = setInterval(() => write(": keep-alive\n\n"), HEARTBEAT_MS);

    // Per-user connection cap: when this user is already at the limit, the
    // oldest of their streams is closed here in favour of this new one.
    let unregister = (): void => {};
    if (userId) {
      const registered = realtimeService.registerConnection(userId, () => close("replaced"));
      unregister = registered.unregister;
      console.log(`[realtime] open user=${userId} org=${orgId} connections=${registered.count}`);
    }

    function close(reason: "replaced" | "client"): void {
      if (closed) return;
      if (reason === "replaced") write(": replaced\n\n");
      closed = true;
      clearInterval(heartbeat);
      unsubscribe();
      unregister();
      res.end();
      const durationSec = ((Date.now() - openedAt) / 1000).toFixed(1);
      console.log(`[realtime] close user=${userId ?? "anon"} org=${orgId} duration=${durationSec}s`);
    }

    req.on("close", () => close("client"));
  }),
};

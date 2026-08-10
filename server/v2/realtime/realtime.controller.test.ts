import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { realtimeController } from "./realtime.controller";
import { eventBus } from "./event-bus";
import { MAX_CONNECTIONS_PER_USER } from "./realtime.service";

// Light mocks matching the repo's controller-test style (see
// transaction.controller.test.ts) — req is a real EventEmitter so
// `req.on("close", ...)` behaves like Express, res is a set of write/end
// spies standing in for the long-lived SSE response.
function makeReq(overrides: Record<string, unknown> = {}) {
  const req = new EventEmitter() as EventEmitter & Record<string, unknown>;
  req.orgId = "org-a";
  req.branchId = null;
  req.orgRole = "agent";
  req.orgRoles = ["agent"];
  req.user = { authType: "password", userId: "user-1" };
  Object.assign(req, overrides);
  return req;
}

function makeRes() {
  return {
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
  };
}

describe("realtimeController.stream — headers and initial handshake", () => {
  it("sets SSE headers, flushes them, and writes the initial connected comment", async () => {
    const req = makeReq();
    const res = makeRes();

    await realtimeController.stream(req as never, res as never, vi.fn());

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
    expect(res.setHeader).toHaveBeenCalledWith("Connection", "keep-alive");
    expect(res.setHeader).toHaveBeenCalledWith("X-Accel-Buffering", "no");
    expect(res.flushHeaders).toHaveBeenCalledOnce();
    expect(res.write).toHaveBeenCalledWith(": connected\n\n");

    req.emit("close");
  });
});

describe("realtimeController.stream — org-scoped event delivery", () => {
  it("delivers a published event for the caller's org as an SSE frame, not one from a different org", async () => {
    const req = makeReq({ orgId: "org-events", user: { authType: "password", userId: "user-events" } });
    const res = makeRes();

    await realtimeController.stream(req as never, res as never, vi.fn());
    res.write.mockClear();

    eventBus.publish("org-events", { type: "message.received", conversationId: "conv-1" });

    expect(res.write).toHaveBeenCalledWith(
      'event: message.received\ndata: {"type":"message.received","conversationId":"conv-1"}\n\n',
    );

    res.write.mockClear();
    eventBus.publish("org-different", { type: "message.received", conversationId: "conv-2" });

    expect(res.write).not.toHaveBeenCalled();

    req.emit("close");
  });

  // ticket.changed carries a ticketId instead of a conversationId — the frame is
  // built from the event object generically, so a second payload shape must ride
  // the same stream without the controller learning about it.
  it("delivers a ticket event, org-scoped like every other event", async () => {
    const req = makeReq({ orgId: "org-tickets", user: { authType: "password", userId: "user-tickets" } });
    const res = makeRes();

    await realtimeController.stream(req as never, res as never, vi.fn());
    res.write.mockClear();

    eventBus.publish("org-tickets", { type: "ticket.changed", ticketId: "ticket-1" });

    expect(res.write).toHaveBeenCalledWith(
      'event: ticket.changed\ndata: {"type":"ticket.changed","ticketId":"ticket-1"}\n\n',
    );

    res.write.mockClear();
    eventBus.publish("org-different", { type: "ticket.changed", ticketId: "ticket-2" });

    expect(res.write).not.toHaveBeenCalled();

    req.emit("close");
  });
});

describe("realtimeController.stream — close cleanup", () => {
  it("clears the heartbeat timer and unsubscribes from the bus on close", async () => {
    vi.useFakeTimers();
    try {
      const req = makeReq({ orgId: "org-heartbeat", user: { authType: "password", userId: "user-heartbeat" } });
      const res = makeRes();

      await realtimeController.stream(req as never, res as never, vi.fn());
      res.write.mockClear();

      vi.advanceTimersByTime(25_000);
      expect(res.write).toHaveBeenCalledWith(": keep-alive\n\n");

      req.emit("close");
      res.write.mockClear();

      vi.advanceTimersByTime(50_000);
      expect(res.write).not.toHaveBeenCalled();

      eventBus.publish("org-heartbeat", { type: "message.received", conversationId: "conv-x" });
      expect(res.write).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("realtimeController.stream — per-user connection cap", () => {
  it("closes the oldest stream for a user once the cap is exceeded", async () => {
    const userId = "user-cap";
    const orgId = "org-cap";
    const streams: Array<{ req: EventEmitter & Record<string, unknown>; res: ReturnType<typeof makeRes> }> = [];

    for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i++) {
      const req = makeReq({ orgId, user: { authType: "password", userId } });
      const res = makeRes();
      await realtimeController.stream(req as never, res as never, vi.fn());
      streams.push({ req, res });
    }

    streams.forEach(({ res }) => expect(res.end).not.toHaveBeenCalled());

    const req6 = makeReq({ orgId, user: { authType: "password", userId } });
    const res6 = makeRes();
    await realtimeController.stream(req6 as never, res6 as never, vi.fn());

    expect(streams[0].res.write).toHaveBeenCalledWith(": replaced\n\n");
    expect(streams[0].res.end).toHaveBeenCalledOnce();
    streams.slice(1).forEach(({ res }) => expect(res.end).not.toHaveBeenCalled());
    expect(res6.end).not.toHaveBeenCalled();

    streams.slice(1).forEach(({ req }) => req.emit("close"));
    req6.emit("close");
  });
});

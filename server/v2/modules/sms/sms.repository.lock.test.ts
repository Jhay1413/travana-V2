import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

class FakeClient extends EventEmitter {
  lockResult = true;
  queries: string[] = [];
  release = vi.fn();
  failQuery?: Error;
  query = vi.fn(async (text: string) => {
    this.queries.push(text);
    if (this.failQuery) throw this.failQuery;
    if (text.includes("pg_try_advisory_lock")) return { rows: [{ locked: this.lockResult }] };
    return { rows: [] };
  });
}

const state = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("../../config/database", () => ({
  db: {},
  pool: { connect: vi.fn(async () => state.client) },
}));

import { smsRepository } from "./sms.repository";

let client: FakeClient;
beforeEach(() => {
  client = new FakeClient();
  state.client = client;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("runWithAdvisoryLock", () => {
  it("runs the work under the lock, then unlocks and releases a healthy client", async () => {
    const work = vi.fn(async () => "done");
    const out = await smsRepository.runWithAdvisoryLock(42, work);
    expect(out).toEqual({ acquired: true, result: "done" });
    expect(client.queries[0]).toContain("pg_try_advisory_lock");
    expect(client.queries[1]).toContain("pg_advisory_unlock");
    expect(client.release).toHaveBeenCalledWith(undefined);
    expect(client.listenerCount("error")).toBe(0);
  });

  it("does not run the work when someone else holds the lock", async () => {
    client.lockResult = false;
    const work = vi.fn();
    expect(await smsRepository.runWithAdvisoryLock(42, work)).toEqual({ acquired: false });
    expect(work).not.toHaveBeenCalled();
    expect(client.queries.some((q) => q.includes("unlock"))).toBe(false);
    expect(client.release).toHaveBeenCalledWith(undefined);
    expect(client.listenerCount("error")).toBe(0);
  });

  it("keeps an error listener while the work runs, so a dropped connection cannot crash the process", async () => {
    let held: boolean | undefined;
    let listenersDuringWork = 0;
    const out = await smsRepository.runWithAdvisoryLock(42, async (lock) => {
      listenersDuringWork = client.listenerCount("error");
      expect(lock.isHeld()).toBe(true);
      client.emit("error", new Error("connection reset")); // would throw if nobody listened
      held = lock.isHeld();
      return "partial";
    });
    expect(listenersDuringWork).toBe(1);
    expect(held).toBe(false);
    expect(out).toEqual({ acquired: true, result: "partial" });
    // Logged, no unlock attempted on the dead connection, client destroyed instead of pooled.
    expect(console.error).toHaveBeenCalledWith("[sms] advisory lock connection lost:", "connection reset");
    expect(client.queries.some((q) => q.includes("unlock"))).toBe(false);
    expect(client.release).toHaveBeenCalledWith(expect.objectContaining({ message: "connection reset" }));
    expect(client.listenerCount("error")).toBe(0);
  });

  it("destroys the client and rethrows when the lock query itself fails", async () => {
    client.failQuery = new Error("terminated");
    await expect(smsRepository.runWithAdvisoryLock(42, vi.fn())).rejects.toThrow("terminated");
    expect(client.release).toHaveBeenCalledWith(expect.objectContaining({ message: "terminated" }));
    expect(client.listenerCount("error")).toBe(0);
  });

  it("still unlocks and keeps the client when only the work throws", async () => {
    await expect(
      smsRepository.runWithAdvisoryLock(42, async () => {
        throw new Error("work failed");
      }),
    ).rejects.toThrow("work failed");
    expect(client.queries.some((q) => q.includes("pg_advisory_unlock"))).toBe(true);
    expect(client.release).toHaveBeenCalledWith(undefined);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// A chainable stand-in for the Drizzle builder: every call returns itself and awaiting it rejects with `failure`.
const state = vi.hoisted(() => ({ failure: undefined as unknown, rows: [] as unknown[], insertValues: undefined as unknown, executed: [] as unknown[], updateValues: undefined as unknown }));
vi.mock("../../config/database", () => {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const m of ["select", "from", "where", "limit", "innerJoin", "leftJoin"]) chain[m] = vi.fn(self);
  chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => (state.failure ? reject(state.failure) : resolve(state.rows));
  return {
    db: {
      ...chain,
      transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
        if (state.failure) throw state.failure;
        return cb({
          ...chain,
          execute: (q: unknown) => { state.executed.push(q); return Promise.resolve(); },
          insert: () => ({ values: (v: unknown) => ({ returning: async () => { state.insertValues = v; return [{ id: "new-id" }]; } }) }),
        });
      },
      update: () => ({ set: (v: unknown) => ({ where: () => { state.updateValues = v; return state.failure ? Promise.reject(state.failure) : Promise.resolve(); } }) }),
      insert: vi.fn(() => ({ values: (v: unknown) => { state.insertValues = v; return state.failure ? Promise.reject(state.failure) : Promise.resolve(); } })),
    },
  };
});

import { customerMessagingRepository as repo, LogUnavailableError } from "./customer-messaging.repository";
import { customerMessageLog } from "@shared/schema";

beforeEach(() => {
  state.failure = undefined;
  state.rows = [];
  state.insertValues = undefined;
  state.executed = [];
  state.updateValues = undefined;
});

const missingTable = Object.assign(new Error("relation does not exist"), { code: "42P01" });

describe("before the customer_message_log table exists", () => {
  it("the duplicate check reports LogUnavailableError (so WhatsApp sends nothing)", async () => {
    state.failure = missingTable;
    await expect(repo.hasRecentSent({ orgId: "o", clientId: "c", purpose: "p", dedupeKey: "p", since: new Date() })).rejects.toBeInstanceOf(LogUnavailableError);
  });

  it("recognises the error when the driver wraps it in `cause`", async () => {
    state.failure = Object.assign(new Error("wrapped"), { cause: missingTable });
    await expect(repo.insertLog({ orgId: "o", purpose: "p", channel: "sms", status: "sent" })).rejects.toBeInstanceOf(LogUnavailableError);
  });

  it("any other database error is not disguised", async () => {
    state.failure = new Error("connection reset");
    await expect(repo.hasRecentSent({ orgId: "o", clientId: "c", purpose: "p", dedupeKey: "p", since: new Date() })).rejects.toThrow("connection reset");
  });
});

describe("hasRecentSent and insertLog", () => {
  it("is true only when a sent row exists", async () => {
    state.rows = [{ id: "1" }];
    expect(await repo.hasRecentSent({ orgId: "o", clientId: "c", purpose: "p", dedupeKey: "p", since: new Date() })).toBe(true);
    state.rows = [];
    expect(await repo.hasRecentSent({ orgId: "o", clientId: "c", purpose: "p", dedupeKey: "p", since: new Date() })).toBe(false);
  });

  it("writes the row it is given", async () => {
    const row = { orgId: "o", clientId: "c", purpose: "booking_confirmation", channel: "whatsapp", status: "sent" };
    await repo.insertLog(row);
    expect(state.insertValues).toEqual(row);
  });
});

describe("the new table is only reachable from the log functions", () => {
  it("the table has the columns the owner asked for, plus sensible indexes", () => {
    const cols = Object.keys(customerMessageLog).filter((k) => !k.startsWith("_") && k !== "enableRLS");
    for (const c of ["id", "orgId", "clientId", "purpose", "channel", "status", "reason", "templateName", "triggerSource", "triggeredBy", "providerMessageId", "dedupeKey", "createdAt"]) {
      expect(cols).toContain(c);
    }
  });
});

describe("reserving a send (the duplicate race)", () => {
  const row = { orgId: "o", clientId: "c", purpose: "booking_confirmation", channel: "whatsapp", status: "pending", dedupeKey: "booking_confirmation:bk1" };
  const since = new Date();

  it("takes the advisory lock first, then inserts the row as pending when nothing recent exists", async () => {
    state.rows = [];
    expect(await repo.reserveSend({ row, since })).toEqual({ id: "new-id" });
    expect(state.executed).toHaveLength(1);
    const text = JSON.stringify(state.executed[0]);
    expect(text).toContain("pg_advisory_xact_lock");
    expect(text).toContain("customer_message:o:c:booking_confirmation:booking_confirmation:bk1");
    expect(state.insertValues).toMatchObject({ ...row, status: "pending" });
  });

  it("returns null and inserts nothing when a sent or pending row is already there (either channel)", async () => {
    state.rows = [{ id: "existing" }];
    expect(await repo.reserveSend({ row: { ...row, channel: "sms" }, since })).toBeNull();
    expect(state.insertValues).toBeUndefined();
  });

  it("reports LogUnavailableError before the table exists", async () => {
    state.failure = missingTable;
    await expect(repo.reserveSend({ row, since })).rejects.toBeInstanceOf(LogUnavailableError);
  });

  it("settles a reserved row", async () => {
    await repo.finalizeLog("id1", { status: "sent", reason: null, templateName: "t", providerMessageId: "m" });
    expect(state.updateValues).toEqual({ status: "sent", reason: null, templateName: "t", providerMessageId: "m" });
  });

  it("says whether the log table exists", async () => {
    expect(await repo.isLogAvailable()).toBe(true);
    state.failure = missingTable;
    expect(await repo.isLogAvailable()).toBe(false);
    state.failure = new Error("connection reset");
    await expect(repo.isLogAvailable()).rejects.toThrow("connection reset");
  });
});

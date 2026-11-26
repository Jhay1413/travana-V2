import { describe, it, expect, vi, beforeEach } from "vitest";

// Customer actions must keep working before the reason / wants_similar columns are pushed: the older shape of
// action is written with a statement that does not name them, and reads fall back to the older columns.
const state = vi.hoisted(() => ({
  queries: [] as Array<{ text: string; values: unknown[] }>,
  failWhen: null as null | ((text: string) => boolean),
  rows: [] as unknown[],
}));

vi.mock("../../config/database", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const fakePool = {
    query: async (q: string | { text: string; values?: unknown[] }, values?: unknown[]) => {
      const text = typeof q === "string" ? q : q.text;
      const vals = typeof q === "string" ? (values ?? []) : (q.values ?? values ?? []);
      state.queries.push({ text, values: vals });
      if (state.failWhen?.(text)) throw Object.assign(new Error("column does not exist"), { code: "42703" });
      return { rows: state.rows, rowCount: state.rows.length, fields: [] };
    },
  };
  return { db: drizzle(fakePool as never) };
});

import { quotePublicRepository } from "./quote-public.repository";

const last = () => state.queries[state.queries.length - 1];

beforeEach(() => {
  state.queries.length = 0;
  state.failWhen = null;
  state.rows = [];
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("createCustomerAction", () => {
  it("an accept (no reason, no similar flag) never names the newer columns", async () => {
    state.rows = [{ id: "a1", quote_id: "q1", action_type: "accepted", message: "hi", customer_name: "Pat", created_at: new Date("2026-11-24T10:00:00Z") }];
    const result = await quotePublicRepository.createCustomerAction({ quoteId: "q1", actionType: "accepted", message: "hi", customerName: "Pat" });
    expect(last().text).toContain("insert into quote_customer_actions (quote_id, action_type, message, customer_name)");
    expect(last().text).not.toMatch(/reason|wants_similar/);
    expect(last().values).toEqual(["q1", "accepted", "hi", "Pat"]);
    expect(result).toMatchObject({ id: "a1", quoteId: "q1", actionType: "accepted", message: "hi", customerName: "Pat", reason: null, wantsSimilar: null });
  });

  it("a decline writes the reason and the similar flag", async () => {
    state.rows = [];
    await quotePublicRepository.createCustomerAction({ quoteId: "q1", actionType: "declined", reason: "Wrong dates", wantsSimilar: true, message: null, customerName: "Pat" });
    expect(last().text).toContain('"reason"');
    expect(last().text).toContain('"wants_similar"');
    expect(last().values).toEqual(expect.arrayContaining(["Wrong dates", true]));
  });

  it("a decline before the schema push fails (and logs once) rather than writing something else", async () => {
    state.failWhen = (t) => t.includes('"reason"');
    const input = { quoteId: "q1", actionType: "declined", reason: "Wrong dates", wantsSimilar: true, message: null, customerName: "Pat" };
    await expect(quotePublicRepository.createCustomerAction(input)).rejects.toMatchObject({ code: "42703" });
    await expect(quotePublicRepository.createCustomerAction(input)).rejects.toMatchObject({ code: "42703" });
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});

describe("getCustomerActions", () => {
  it("returns every column when they exist", async () => {
    await quotePublicRepository.getCustomerActions("q1");
    expect(last().text).toContain('"reason"');
    expect(last().text).toContain('"wants_similar"');
  });

  it("falls back to the older columns before the schema push, with the new fields null", async () => {
    state.failWhen = (t) => t.includes('"reason"');
    state.rows = [];
    expect(await quotePublicRepository.getCustomerActions("q1")).toEqual([]);
    expect(last().text).not.toContain('"reason"');
    expect(last().text).toContain('"action_type"');
  });
});

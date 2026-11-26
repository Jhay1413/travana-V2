import { describe, it, expect, vi, beforeEach } from "vitest";

// A real drizzle instance over a fake pool: nothing connects, every statement the repository builds is captured
// as text + params so the SQL itself can be asserted. `state.failWhen` makes a statement fail like a missing column.
const state = vi.hoisted(() => ({
  queries: [] as Array<{ text: string; values: unknown[] }>,
  failWhen: null as null | ((text: string) => boolean),
  failCode: "42703",
  rows: [] as unknown[][],
}));

vi.mock("../../config/database", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const fakePool = {
    query: async (q: string | { text: string; values?: unknown[] }, values?: unknown[]) => {
      const text = typeof q === "string" ? q : q.text;
      const vals = typeof q === "string" ? (values ?? []) : (q.values ?? values ?? []);
      state.queries.push({ text, values: vals });
      if (state.failWhen?.(text)) throw Object.assign(new Error("boom"), { code: state.failCode });
      return { rows: state.rows, rowCount: state.rows.length, fields: [] };
    },
  };
  return { db: drizzle(fakePool as never) };
});

import { portalQuotesRepository } from "./portal-quotes.repository";

const last = () => state.queries[state.queries.length - 1];
const D = "$";

beforeEach(() => {
  state.queries.length = 0;
  state.failWhen = null;
  state.failCode = "42703";
  state.rows = [];
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("findClientQuotes", () => {
  it("is limited to the client's own quotes and hides quotes whose deal is already booked", async () => {
    await portalQuotesRepository.findClientQuotes("c1");
    const { text, values } = last();
    expect(values).toContain("c1");
    expect(text).toContain(`"transaction"."client_id" = ${D}`);
    expect(text).toContain("not exists");
    // The same "live booking" rule as the bookings list: active, and not LOST (no status counts as live).
    expect(text).toContain(`"booking_table"."is_active" = ${D}`);
    expect(text).toContain(`"booking_status" is null`);
    expect(text).toContain(`"booking_status" <> 'LOST'`);
  });

  it("uses the one visible-to-customers rule: live quote, live deal, not a test deal", async () => {
    await portalQuotesRepository.findClientQuotes("c1");
    const { text } = last();
    expect(text).toContain(`"quote_table"."is_active" = ${D}`);
    expect(text).toContain(`"transaction"."is_active" = ${D}`);
    expect(text).toContain(`"transaction"."is_test" = ${D}`);
  });

  it("hides quotes staff marked lost or archived, and keeps quotes with no status", async () => {
    await portalQuotesRepository.findClientQuotes("c1");
    const { text, values } = last();
    expect(text).toContain(`"quote_table"."quote_status" is null`);
    expect(text).toContain(`"quote_table"."quote_status" not in (${D}`);
    expect(values).toEqual(expect.arrayContaining(["lost", "archived"]));
  });

  it("reads the operator, board, sent date and expiry", async () => {
    await portalQuotesRepository.findClientQuotes("c1");
    const { text } = last();
    expect(text).toContain('"tour_operator_table"');
    expect(text).toContain('"board_basis"');
    expect(text).toContain('"quote_sent_at"');
    expect(text).toContain('"date_expiry"');
  });

  it("selects no cost-side column that is not needed for the customer price", async () => {
    await portalQuotesRepository.findClientQuotes("c1");
    expect(last().text).not.toMatch(/commission|profit|net_price|supplier_cost|cost_price/i);
  });
});

describe("findAccessByToken", () => {
  it("looks the quote up by its token and only among quotes visible to customers", async () => {
    await portalQuotesRepository.findAccessByToken("TOK1", "org-a");
    const { text, values } = last();
    expect(text).toContain(`"quote_token" = ${D}`);
    expect(values).toContain("TOK1");
    expect(text).toContain(`"quote_table"."is_active" = ${D}`);
    expect(text).toContain(`"transaction"."is_active" = ${D}`);
    expect(text).toContain(`"transaction"."is_test" = ${D}`);
  });

  it("decides the published-deal flag with the deals-list predicate for the viewer's own agency", async () => {
    await portalQuotesRepository.findAccessByToken("TOK1", "org-a");
    const { text, values } = last();
    expect(values).toContain("org-a");
    expect(text).toContain(`"show_on_portal" = ${D}`);
    expect(text).toContain(`"isFreeQuote" = ${D}`);
    expect(text).toContain(`"org_id" = ${D}`);
  });

  it("with no organisation the published-deal flag is a constant false and no deal predicate is built", async () => {
    await portalQuotesRepository.findAccessByToken("TOK1", null);
    expect(last().text).not.toContain('"show_on_portal"');
  });

  it("returns null for an unknown token", async () => {
    expect(await portalQuotesRepository.findAccessByToken("NOPE", "org-a")).toBeNull();
  });
});

describe("findDecisionActions", () => {
  it("does not query at all for no quotes", async () => {
    expect(await portalQuotesRepository.findDecisionActions([])).toEqual([]);
    expect(state.queries).toHaveLength(0);
  });

  it("asks only for accepted / declined / reopened, newest first", async () => {
    await portalQuotesRepository.findDecisionActions(["q1", "q2"]);
    const { text, values } = last();
    expect(values).toEqual(expect.arrayContaining(["q1", "q2", "accepted", "declined", "reopened"]));
    expect(text).toContain('order by "quote_customer_actions"."created_at" desc');
    expect(text).toContain('"reason"');
  });

  it("before the schema push (missing column) it falls back to the older columns, reads the new ones as null, and logs once", async () => {
    state.failWhen = (text) => text.includes('"reason"');
    state.rows = [];
    const first = await portalQuotesRepository.findDecisionActions(["q1"]);
    const second = await portalQuotesRepository.findDecisionActions(["q1"]);
    expect(first).toEqual([]);
    expect(second).toEqual([]);
    const fallback = state.queries.filter((q) => !q.text.includes('"reason"'));
    expect(fallback).toHaveLength(2);
    expect(fallback[0].text).not.toContain("wants_similar");
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("any other database error is not swallowed", async () => {
    state.failWhen = () => true;
    state.failCode = "57P01";
    await expect(portalQuotesRepository.findDecisionActions(["q1"])).rejects.toMatchObject({ code: "57P01" });
    expect(state.queries).toHaveLength(1);
  });
});

describe("findLiveBookingIdsForQuote", () => {
  it("reads at most two live bookings (the live-booking rule, test deals excluded) on the quote's own deal", async () => {
    state.rows = [{ id: "bk-1" }];
    await portalQuotesRepository.findLiveBookingIdsForQuote("q1");
    const { text, values } = last();
    expect(values).toContain("q1");
    expect(text).toContain(`"quote_table"."id" = ${D}`);
    expect(text).toContain(`"booking_table"."transaction_id" = "transaction"."id"`);
    expect(text).toContain(`"booking_status" <> 'LOST'`);
    expect(text).toContain(`"transaction"."is_test" = ${D}`);
    expect(text).toContain("limit");
  });
});

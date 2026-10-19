import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { agentProfileRepository } from "./agent-profile.repository";
import { renderOrderBy, renderWhere, resetCapture, setRows } from "../../test/capture-db";

beforeEach(() => resetCapture());

const W = { from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-10-20T00:00:00Z") };
const SUBJECT = { orgId: "o1", branchId: "b1", userId: "u1" };
const ORG_ONLY = { orgId: "o1" };

/** The organisation predicate must lead every deal query. */
function expectOrgFirst(index: number) {
  const { text, params } = renderWhere(index);
  expect(text.startsWith('("client_table"."org_id" = ')).toBe(true);
  expect(text).toContain('"transaction"."is_test" = ');
  expect(params[0]).toBe("o1");
}

describe("deal queries are org scoped, test-excluded and narrowed only when asked", () => {
  it("lifetime profit", async () => {
    setRows([{ profit: "1250.5" }]);
    expect(await agentProfileRepository.getLifetimeProfit(SUBJECT)).toBe(1250.5);
    expectOrgFirst(0);
    expect(renderWhere(0).text).toContain('"transaction"."user_id" = ');
  });

  it("window totals carry user and branch for a manager, neither for the org comparator", async () => {
    setRows([{ profit: "100", bookings: "2", sales: "800" }]);
    expect(await agentProfileRepository.getWindowTotals(SUBJECT, W)).toEqual({ profit: 100, bookings: 2, sales: 800 });
    await agentProfileRepository.getWindowTotals(ORG_ONLY, W);

    expectOrgFirst(0);
    expect(renderWhere(0).params).toEqual(expect.arrayContaining(["b1", "u1"]));
    expectOrgFirst(1);
    expect(renderWhere(1).text).not.toContain('"transaction"."user_id"');
    expect(renderWhere(1).text).not.toContain('"transaction"."branch_id"');
  });

  it("quote counts only count countable quotes created in the window", async () => {
    setRows([{ quotesSent: "7", quotedDeals: "5" }]);
    expect(await agentProfileRepository.getQuoteWindowCounts(SUBJECT, W)).toEqual({ quotesSent: 7, quotedDeals: 5 });
    expectOrgFirst(0);
    const { text, params } = renderWhere(0);
    expect(text).toContain('"quote_table"."deleted_at" is null');
    expect(text).toContain('"transaction"."client_id" is not null');
    expect(params).toEqual(expect.arrayContaining([W.from.toISOString(), W.to.toISOString()]));
  });

  it("quote views carry the countable-quote conditions and bound both view and quote windows", async () => {
    setRows([{ views: "12" }]);
    expect(await agentProfileRepository.countQuoteViews(SUBJECT, W)).toBe(12);
    expectOrgFirst(0);
    const { text } = renderWhere(0);
    expect(text).toContain('"quote_table"."deleted_at" is null');
    expect(text).toContain('"quote_table"."isFreeQuote"');
    expect(text).toContain('"quote_views"."viewed_at" >= ');
    expect(text).toContain('"quote_views"."viewed_at" < ');
  });

  it("biggest deals are ordered by commission then newest, and capped", async () => {
    setRows([
      { bookingId: "b1", transactionId: "t1", clientId: "c1", clientFirstName: "A", clientSurname: "L", title: "x", bookedAt: null, travelDate: "2026-11-01", salesPrice: "900", commission: "120.5" },
    ]);
    const rows = await agentProfileRepository.listBiggestDeals(SUBJECT, 5);
    expect(rows[0]).toMatchObject({ salesPrice: 900, commission: 120.5 });
    expectOrgFirst(0);
    const order = renderOrderBy(0);
    expect(order).toContain("desc");
    expect(order).toContain('"booking_table"."date_created" desc');
    expect(renderWhere(0).text).toContain("<> 'LOST'");
  });

  it("departures exclude lost and inactive bookings and use a half-open date range", async () => {
    await agentProfileRepository.listDepartures(SUBJECT, "2026-10-19", "2026-10-26");
    expectOrgFirst(0);
    const { text, params } = renderWhere(0);
    expect(text).toContain("<> 'LOST'");
    expect(text).toContain('"booking_table"."is_active"');
    expect(text).toContain('"booking_table"."travel_date" >= ');
    expect(text).toContain('"booking_table"."travel_date" < ');
    expect(params).toEqual(expect.arrayContaining(["2026-10-19", "2026-10-26"]));
  });
});

describe("user, membership and organisation reads", () => {
  it("memberships are filtered by organisation on both the member row and the branch", async () => {
    await agentProfileRepository.listMemberships("u1", "o1");
    const { text, params } = renderWhere(0);
    expect(text).toContain('"branch_members"."org_id" = ');
    expect(text).toContain('"branch_members"."user_id" = ');
    expect(params).toEqual(expect.arrayContaining(["o1", "u1"]));
  });

  it("subject lookup needs a membership in the organisation and returns null otherwise", async () => {
    expect(await agentProfileRepository.findSubjectUser("u1", "o1")).toBeNull();
    const { text, params } = renderWhere(0);
    expect(text).toContain('"branch_members"."org_id" = ');
    expect(text).toContain('"user"."id" = ');
    expect(params).toEqual(expect.arrayContaining(["o1", "u1"]));
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});
vi.mock("../user-org-roles/user-org-roles.repository", () => ({
  userOrgRolesRepository: {
    findSalesAgentUserIds: vi.fn(),
    findHomeworkerUserIds: vi.fn(),
    findSuspendedUserIds: vi.fn(),
  },
}));

import { organizationOverviewRepository } from "./organization-overview.repository";
import { resetCapture, renderWhere, setRows, whereCalls } from "../../test/capture-db";
import { userOrgRolesRepository } from "../user-org-roles/user-org-roles.repository";

beforeEach(() => resetCapture());

const WHEN = new Date("2026-01-15T12:00:00Z");

describe("organizationOverviewRepository.getHomeworkerBranches", () => {
  it("only returns owned homeworker branches (never the legacy shared branch)", async () => {
    await organizationOverviewRepository.getHomeworkerBranches("o1");

    const { text, params } = renderWhere(0);
    expect(text).toContain('"branches"."branch_type" = ');
    expect(text).toContain('"branches"."owner_user_id" is not null');
    expect(params).toEqual(expect.arrayContaining(["homeworker", "o1"]));
  });

  it("maps rows into records with a numeric profit share", async () => {
    setRows([
      {
        branchId: "hb1", name: "H", ownerUserId: "u1", ownerFirstName: "Ann", ownerLastName: "Lee",
        ownerName: null, ownerEmail: "a@x", ownerImage: null, profitSharePercent: "62.50", isActive: false,
      },
    ]);

    const [rec] = await organizationOverviewRepository.getHomeworkerBranches("o1");

    expect(rec).toMatchObject({ ownerName: "Ann Lee", profitSharePercent: 62.5, isActive: false, ownerAvatarUrl: null });
  });
});

describe("organizationOverviewRepository org-wide targets", () => {
  it("monthly target sums shop targets (shop branches) and homeworker agent targets", async () => {
    setRows([{ total: "1000" }]);

    const total = await organizationOverviewRepository.getOrgMonthlyTarget("o1", WHEN, "b1");

    expect(total).toBe(2000); // both parts summed (capture-db returns the same row for each query)
    const shop = renderWhere(0);
    const hw = renderWhere(1);
    expect(shop.text).toContain('"branches"."branch_type" <> ');
    expect(hw.text).toContain('"branches"."branch_type" = ');
    expect(hw.text).toContain('"agent_target_table"');
  });

  it("monthly target uses the stored business target when one is set for the month", async () => {
    setRows([{ amount: "3500.00" }]);

    const total = await organizationOverviewRepository.getOrgMonthlyTarget("o1", WHEN);

    expect(total).toBe(3500);
    const stored = renderWhere(0);
    expect(stored.text).toContain('"org_target_table"');
    expect(stored.params).toEqual(expect.arrayContaining(["o1", 2026, 1]));
  });

  it("a branch-scoped monthly target ignores the stored business target", async () => {
    setRows([{ total: "10" }]);
    await organizationOverviewRepository.getOrgMonthlyTarget("o1", WHEN, "b1");
    expect(whereCalls).toHaveLength(2);
    expect(renderWhere(0).text).not.toContain("org_target_table");
  });

  it("falls back to the derived sum when no stored target exists", async () => {
    setRows([]);
    const total = await organizationOverviewRepository.getOrgMonthlyTarget("o1", WHEN);
    expect(total).toBe(0);
    expect(whereCalls).toHaveLength(3); // stored lookup, then shop + homeworker sums
  });

  it("yearly series merges both parts per month", async () => {
    setRows([{ month: 1, total: "300" }]);

    const map = await organizationOverviewRepository.getOrgYearlyTargets("o1", 2026, "b1");

    expect(map.get(1)).toBe(600);
    expect(renderWhere(0).text).toContain('"shop_target_table"');
    expect(renderWhere(1).text).toContain('"agent_target_table"');
  });

  it("yearly series: a stored business target overrides the derived sum for its month", async () => {
    setRows([{ month: 1, total: "300", amount: "900" }]);

    const map = await organizationOverviewRepository.getOrgYearlyTargets("o1", 2026);

    expect(map.get(1)).toBe(900);
    expect(renderWhere(2).text).toContain('"org_target_table"');
  });

  it("returns zero without an org", async () => {
    expect(await organizationOverviewRepository.getOrgMonthlyTarget(null, WHEN)).toBe(0);
    expect((await organizationOverviewRepository.getOrgYearlyTargets(null, 2026)).size).toBe(0);
  });
});

describe("organizationOverviewRepository.getBranchLeaderboard upsell", () => {
  it("adds upsell commission (by added_at, active only) to the branch commission", async () => {
    // capture-db returns the same row for every query in the Promise.all.
    setRows([
      {
        id: "b1", name: "Shop", code: null, isActive: true, branchType: "shop", profitSharePercent: null,
        ownerUserId: null, branchId: "b1", bookings: 2, commission: "100", upsell: "40", quotes: 1,
        count: 3, amount: "1000",
      },
    ]);
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-02-01T00:00:00Z");

    const [row] = await organizationOverviewRepository.getBranchLeaderboard("o1", start, end, WHEN);

    expect(row.commission).toBe(140);
    expect(row.percentToTarget).toBeCloseTo(14);
    const upsellWhere = whereCalls.map((_, i) => renderWhere(i).text).find((t) => t.includes('"booking_upsell"."added_at"'));
    expect(upsellWhere).toContain('"booking_upsell"."is_active" = true');
  });
});

describe("organizationOverviewRepository stored business target ignores £0 rows", () => {
  it("monthly and yearly lookups only consider amounts above 0", async () => {
    setRows([]);
    await organizationOverviewRepository.getOrgMonthlyTarget("o1", WHEN);
    expect(renderWhere(0).text).toContain('"org_target_table"."target_amount" > ');

    resetCapture();
    setRows([]);
    await organizationOverviewRepository.getOrgYearlyTargets("o1", 2026);
    expect(renderWhere(2).text).toContain('"org_target_table"."target_amount" > ');
  });
});

describe("organizationOverviewRepository.getCompareTotals", () => {
  const windows = {
    now: { from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-10-17T12:00:00Z") },
    other: { from: new Date("2026-09-01T00:00:00Z"), to: new Date("2026-09-17T12:00:00Z") },
  };

  it("scopes both queries by org, test deals and branch, bounded by the earliest window start", async () => {
    setRows([]);

    await organizationOverviewRepository.getCompareTotals("o1", windows, "b1");

    expect(whereCalls).toHaveLength(2);
    const bookings = renderWhere(0);
    expect(bookings.params).toEqual(
      expect.arrayContaining(["o1", "b1", false, windows.other.from.toISOString()]),
    );
    expect(bookings.text).toContain('"booking_upsell"."added_at" >=');
    const quotes = renderWhere(1);
    expect(quotes.text).toContain('"quote_table"."deleted_at" is null');
    expect(quotes.text).toContain('"quote_table"."isFreeQuote"');
    expect(quotes.params).toEqual(expect.arrayContaining(["o1", "b1", false]));
    expect(quotes.params.map(String).some((p) => p.includes("2026-09-01"))).toBe(true);
  });

  it("omits the branch condition when no branch is chosen", async () => {
    setRows([]);
    await organizationOverviewRepository.getCompareTotals("o1", windows);
    expect(renderWhere(0).text).not.toContain('"transaction"."branch_id"');
  });

  it("maps numeric strings into window totals and defaults to zero", async () => {
    setRows([
      { nowProfit: "1200.50", nowBookings: "4", otherProfit: "500", otherBookings: "5", nowQuoted: "8", otherQuoted: "2" },
    ]);
    expect(await organizationOverviewRepository.getCompareTotals("o1", windows)).toEqual({
      now: { profit: 1200.5, bookings: 4, quotedDeals: 8 },
      other: { profit: 500, bookings: 5, quotedDeals: 2 },
    });

    setRows([]);
    expect(await organizationOverviewRepository.getCompareTotals("o1", windows)).toEqual({
      now: { profit: 0, bookings: 0, quotedDeals: 0 },
      other: { profit: 0, bookings: 0, quotedDeals: 0 },
    });
  });
});

describe("organizationOverviewRepository.getProfitSourceTotals", () => {
  const monthStart = new Date("2026-09-30T23:00:00Z");
  const monthEnd = new Date("2026-10-31T00:00:00Z");

  it("restricts to the org and bookings touched since the month start", async () => {
    setRows([]);

    await organizationOverviewRepository.getProfitSourceTotals("o1", monthStart, monthEnd, "b1");

    const { text, params } = renderWhere(0);
    expect(params).toEqual(expect.arrayContaining(["o1", "b1", false, monthStart.toISOString()]));
    expect(text).toContain('"booking_upsell"."added_at" >=');
  });

  it("maps rows to numbers", async () => {
    setRows([{ source: "FACEBOOK", profit: "250.25", bookings: "3" }]);
    expect(await organizationOverviewRepository.getProfitSourceTotals("o1", monthStart, monthEnd)).toEqual([
      { source: "FACEBOOK", profit: 250.25, bookings: 3 },
    ]);
  });
});

describe("organizationOverviewRepository.getOpenDealCounts", () => {
  it("counts distinct deals with an open quote, excluding booked/lost, scoped to org and branch", async () => {
    setRows([{ agentId: "u1", count: "2" }, { agentId: null, count: "9" }]);

    const counts = await organizationOverviewRepository.getOpenDealCounts("o1", "b1");

    expect(counts).toEqual(new Map([["u1", 2]]));
    const { text, params } = renderWhere(0);
    expect(text).toContain("'BOOKED', 'BOOKING_CONFIRMED', 'LOST'");
    expect(text).toContain('"quote_table"."deleted_at" is null');
    expect(params).toEqual(expect.arrayContaining(["o1", "b1", false]));
  });
});

describe("organizationOverviewRepository.getAgentsPerformance ppb and openDeals", () => {
  it("adds ppb (incl. upsells) and openDeals while keeping the booking-only avgPerBooking", async () => {
    vi.spyOn(userOrgRolesRepository, "findSalesAgentUserIds").mockResolvedValue(["u1"]);
    vi.spyOn(userOrgRolesRepository, "findHomeworkerUserIds").mockResolvedValue([]);
    vi.spyOn(userOrgRolesRepository, "findSuspendedUserIds").mockResolvedValue(new Set());
    // capture-db returns the same row for every query in the call.
    setRows([
      {
        agentId: "u1", today: "0", week: "0", month: "300", rangeBookings: "4", rangeCommission: "300",
        rangeSales: "900", rangeQuotes: "3", todayUpsell: "0", weekUpsell: "0", monthUpsell: "50",
        rangeCommissionUpsell: "50", rangeSalesUpsell: "0", count: "2", id: "u1", name: "Ann Lee",
        firstName: "Ann", lastName: "Lee", email: "a@x", image: null, userId: "u1", code: null, amount: "500",
      },
    ]);

    const result = await organizationOverviewRepository.getAgentsPerformance("o1", "month");

    expect(result.rows[0]).toMatchObject({
      id: "u1",
      rangeBookings: 4,
      rangeCommission: 350,
      avgPerBooking: 75,
      ppb: 87.5,
      openDeals: 2,
    });
  });

  it("reports ppb 0 and openDeals 0 for an agent without bookings or open deals", async () => {
    vi.spyOn(userOrgRolesRepository, "findSalesAgentUserIds").mockResolvedValue(["u1"]);
    vi.spyOn(userOrgRolesRepository, "findHomeworkerUserIds").mockResolvedValue([]);
    vi.spyOn(userOrgRolesRepository, "findSuspendedUserIds").mockResolvedValue(new Set());
    setRows([{ id: "u1", name: "Ann", firstName: "Ann", lastName: null, email: "a@x", image: null }]);

    const result = await organizationOverviewRepository.getAgentsPerformance("o1", "month");

    expect(result.rows[0]).toMatchObject({ ppb: 0, openDeals: 0, avgPerBooking: 0 });
  });
});

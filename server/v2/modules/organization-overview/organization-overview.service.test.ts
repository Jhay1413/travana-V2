import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./organization-overview.repository", () => ({
  organizationOverviewRepository: {
    getStats: vi.fn(),
    getHomeworkerBranches: vi.fn(),
    getAgentsPerformance: vi.fn(),
    getBranchesPerformance: vi.fn(),
    getCompareTotals: vi.fn(),
    getProfitSourceTotals: vi.fn(),
  },
}));
vi.mock("../plan/plan.service", () => ({ planService: { getOrgPlan: vi.fn() } }));
vi.mock("../branch/branch.service", () => ({ branchService: { assertBranchInOrg: vi.fn() } }));

import { organizationOverviewService, buildHomeworkerRows } from "./organization-overview.service";
import { organizationOverviewRepository as repo } from "./organization-overview.repository";
import { planService } from "../plan/plan.service";
import { branchService } from "../branch/branch.service";
import type { AgentPerformanceRow, HomeworkerBranchRecord } from "./organization-overview.types";

const scope = { orgRole: "org_admin", orgId: "o1", branchId: null } as never;

function record(over: Partial<HomeworkerBranchRecord> = {}): HomeworkerBranchRecord {
  return {
    branchId: "hb1",
    name: "Hannah",
    ownerUserId: "u1",
    ownerName: "Hannah H",
    ownerAvatarUrl: "a.png",
    profitSharePercent: 60,
    isActive: true,
    ...over,
  };
}

function agentRow(over: Partial<AgentPerformanceRow> = {}): AgentPerformanceRow {
  return {
    id: "u1",
    name: "Hannah H",
    firstName: "Hannah",
    avatarUrl: null,
    isHomeworker: true,
    branches: [],
    today: 10,
    week: 50,
    month: 200,
    rangeBookings: 4,
    rangeCommission: 200,
    rangeSales: 1000,
    rangeQuotes: 9,
    avgPerBooking: 50,
    ppb: 50,
    openDeals: 2,
    target: 400,
    achievedPercent: 50,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(planService.getOrgPlan).mockResolvedValue({ code: "pro" } as never);
  vi.mocked(repo.getStats).mockResolvedValue({ branchLeaderboard: [] } as never);
});

describe("buildHomeworkerRows", () => {
  it("maps owner performance onto the homeworker branch row", () => {
    const [row] = buildHomeworkerRows([record()], [agentRow()]);

    expect(row).toEqual({
      branchId: "hb1",
      name: "Hannah",
      ownerUserId: "u1",
      ownerName: "Hannah H",
      ownerAvatarUrl: "a.png",
      profitSharePercent: 60,
      status: "active",
      today: 10,
      week: 50,
      month: 200,
      rangeBookings: 4,
      avgPerBooking: 50,
      target: 400,
      achievedPercent: 50,
    });
  });

  it("reports zeros and archived status when the owner has no performance row", () => {
    const [row] = buildHomeworkerRows([record({ isActive: false })], []);

    expect(row.status).toBe("archived");
    expect(row.month).toBe(0);
    expect(row.target).toBe(0);
  });

  it("does not match a null owner to anyone", () => {
    const [row] = buildHomeworkerRows([record({ ownerUserId: null })], [agentRow({ id: "" })]);

    expect(row.month).toBe(0);
  });

  it("lists active branches first, then by month profit", () => {
    const rows = buildHomeworkerRows(
      [
        record({ branchId: "arch", ownerUserId: "u3", isActive: false }),
        record({ branchId: "low", ownerUserId: "u2" }),
        record({ branchId: "high", ownerUserId: "u1" }),
      ],
      [agentRow({ id: "u1", month: 500 }), agentRow({ id: "u2", month: 100 }), agentRow({ id: "u3", month: 900 })],
    );

    expect(rows.map((r) => r.branchId)).toEqual(["high", "low", "arch"]);
  });
});

describe("organizationOverviewService.getStats - homeworkers list", () => {
  it("adds a separate homeworkers list built from the agent performance query", async () => {
    vi.mocked(repo.getHomeworkerBranches).mockResolvedValue([record()]);
    vi.mocked(repo.getAgentsPerformance).mockResolvedValue({ rows: [agentRow()] } as never);

    const result = await organizationOverviewService.getStats(scope);

    expect(repo.getAgentsPerformance).toHaveBeenCalledWith("o1", "month", undefined, undefined, undefined, { includeOpenDeals: false });
    expect(result.kind).toBe("multi-branch");
    expect(result.homeworkers).toHaveLength(1);
    expect(result.homeworkers[0].branchId).toBe("hb1");
  });

  it("skips the performance query when the org has no homeworker branches", async () => {
    vi.mocked(repo.getHomeworkerBranches).mockResolvedValue([]);

    const result = await organizationOverviewService.getStats(scope);

    expect(repo.getAgentsPerformance).not.toHaveBeenCalled();
    expect(result.homeworkers).toEqual([]);
  });

  it("also returns homeworkers on the single-branch (starter) shape", async () => {
    vi.mocked(planService.getOrgPlan).mockResolvedValue({ code: "starter" } as never);
    vi.mocked(repo.getHomeworkerBranches).mockResolvedValue([record()]);
    vi.mocked(repo.getAgentsPerformance).mockResolvedValue({ rows: [] } as never);

    const result = await organizationOverviewService.getStats(scope);

    expect(result.kind).toBe("single-branch");
    expect(result.homeworkers).toHaveLength(1);
  });

  it("keeps isHomeworker untouched on agent rows", async () => {
    vi.mocked(repo.getAgentsPerformance).mockResolvedValue({ rows: [agentRow()] } as never);

    const result = await organizationOverviewService.getAgentsPerformance(scope, "month");

    expect(result.rows[0].isHomeworker).toBe(true);
  });

  it("passes the branch filter through to the homeworker lookup", async () => {
    vi.mocked(repo.getHomeworkerBranches).mockResolvedValue([]);

    await organizationOverviewService.getStats(scope, "b1");

    expect(repo.getHomeworkerBranches).toHaveBeenCalledWith("o1", "b1");
  });
});

describe("organizationOverviewService.getStats - branch leaderboard", () => {
  it("is shop-only; homeworker branches live in homeworkers[]", async () => {
    vi.mocked(repo.getStats).mockResolvedValue({
      branchLeaderboard: [{ id: "b1", branchType: "shop" }, { id: "hb1", branchType: "homeworker" }],
    } as never);
    vi.mocked(repo.getHomeworkerBranches).mockResolvedValue([record({ branchId: "hb1" })]);
    vi.mocked(repo.getAgentsPerformance).mockResolvedValue({ rows: [] } as never);

    const result = await organizationOverviewService.getStats(scope);

    if (result.kind !== "multi-branch") throw new Error("expected multi-branch");
    expect(result.branchLeaderboard).toEqual([{ id: "b1", branchType: "shop" }]);
    expect(result.homeworkers.map((h) => h.branchId)).toEqual(["hb1"]);
  });
});

describe("organizationOverviewService.getBranchesPerformance", () => {
  it("drops homeworker rows server-side and keeps branchType on the rest", async () => {
    vi.mocked(repo.getBranchesPerformance).mockResolvedValue({
      rows: [{ id: "b1", branchType: "shop" }, { id: "hb1", branchType: "homeworker" }],
    } as never);

    const result = await organizationOverviewService.getBranchesPerformance(scope, "month");

    expect(result.rows).toEqual([{ id: "b1", branchType: "shop" }]);
  });
});

describe("organizationOverviewService - fail-closed org scope", () => {
  const noOrg = { orgRole: "platform_admin", orgId: "", branchId: null } as never;

  it.each([
    ["getStats", () => organizationOverviewService.getStats(noOrg)],
    ["getAgentsPerformance", () => organizationOverviewService.getAgentsPerformance(noOrg, "month")],
    ["getBranchesPerformance", () => organizationOverviewService.getBranchesPerformance(noOrg, "month")],
    ["getCompare", () => organizationOverviewService.getCompare(noOrg, "week", "prev")],
    ["getProfitSources", () => organizationOverviewService.getProfitSources(noOrg)],
  ])("%s throws 403 when there is no org context", async (_name, call) => {
    await expect(call()).rejects.toMatchObject({ statusCode: 403, message: "Select an organisation first" });
    expect(repo.getStats).not.toHaveBeenCalled();
    expect(repo.getCompareTotals).not.toHaveBeenCalled();
    expect(repo.getProfitSourceTotals).not.toHaveBeenCalled();
  });

  it("a platform admin acting inside an org is scoped to that org", async () => {
    vi.mocked(repo.getProfitSourceTotals).mockResolvedValue([]);
    const inOrg = { orgRole: "platform_admin", orgId: "o9", branchId: null } as never;

    await organizationOverviewService.getProfitSources(inOrg);

    expect(vi.mocked(repo.getProfitSourceTotals).mock.calls[0][0]).toBe("o9");
  });
});

describe("organizationOverviewService.getCompare", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T14:30:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("derives ppb and close rate from the raw totals, clamping close rate at 100", async () => {
    vi.mocked(repo.getCompareTotals).mockResolvedValue({
      now: { profit: 1200, bookings: 4, quotedDeals: 16 },
      other: { profit: 500, bookings: 5, quotedDeals: 2 },
    });

    const result = await organizationOverviewService.getCompare(scope, "month", "prev");

    expect(result.now).toEqual({ profit: 1200, bookings: 4, ppb: 300, closeRate: 25 });
    expect(result.other).toEqual({ profit: 500, bookings: 5, ppb: 100, closeRate: 100 });
  });

  it("returns 0 ppb and close rate for empty windows", async () => {
    vi.mocked(repo.getCompareTotals).mockResolvedValue({
      now: { profit: 0, bookings: 0, quotedDeals: 0 },
      other: { profit: 0, bookings: 0, quotedDeals: 0 },
    });

    const result = await organizationOverviewService.getCompare(scope, "week", "prev");

    expect(result.now).toEqual({ profit: 0, bookings: 0, ppb: 0, closeRate: 0 });
  });

  it("passes London windows to the repository and returns them as ISO strings with labels", async () => {
    vi.mocked(repo.getCompareTotals).mockResolvedValue({
      now: { profit: 0, bookings: 0, quotedDeals: 0 },
      other: { profit: 0, bookings: 0, quotedDeals: 0 },
    });

    const result = await organizationOverviewService.getCompare(scope, "month", "year", "b1");

    const [orgId, windows, branchId] = vi.mocked(repo.getCompareTotals).mock.calls[0];
    expect(orgId).toBe("o1");
    expect(branchId).toBe("b1");
    expect(windows.now.from.toISOString()).toBe("2026-09-30T23:00:00.000Z");
    expect(result.windows.other).toEqual({ from: "2025-09-30T23:00:00.000Z", to: "2025-10-17T14:30:00.000Z" });
    expect(result.labels).toEqual({ now: "This month so far", other: "Same point last year" });
    expect(result).toMatchObject({ period: "month", against: "year" });
  });

  it("normalises year/year to prev", async () => {
    vi.mocked(repo.getCompareTotals).mockResolvedValue({
      now: { profit: 0, bookings: 0, quotedDeals: 0 },
      other: { profit: 0, bookings: 0, quotedDeals: 0 },
    });

    const result = await organizationOverviewService.getCompare(scope, "year", "year");

    expect(result.against).toBe("prev");
  });

  it("checks the branch belongs to the org before querying", async () => {
    vi.mocked(branchService.assertBranchInOrg).mockRejectedValueOnce(new Error("Branch not found"));

    await expect(organizationOverviewService.getCompare(scope, "week", "prev", "bx")).rejects.toThrow("Branch not found");

    expect(branchService.assertBranchInOrg).toHaveBeenCalledWith("bx", "o1");
    expect(repo.getCompareTotals).not.toHaveBeenCalled();
  });
});

describe("organizationOverviewService.getProfitSources", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-31T23:30:00Z")); // London is already 1 April
  });
  afterEach(() => vi.useRealTimers());

  it("labels, drops empty rows, sorts by profit then label and totals the rest", async () => {
    vi.mocked(repo.getProfitSourceTotals).mockResolvedValue([
      { source: "WHATSAPP", profit: 100, bookings: 1 },
      { source: "none", profit: 400, bookings: 3 },
      { source: "FACEBOOK", profit: 100, bookings: 2 },
      { source: "SHOP", profit: 0, bookings: 0 },
      { source: "PHONE_ENQUIRY", profit: 250.5, bookings: 1 },
    ]);

    const result = await organizationOverviewService.getProfitSources(scope);

    expect(result.rows.map((r) => [r.source, r.label])).toEqual([
      ["none", "Not recorded"],
      ["PHONE_ENQUIRY", "Phone enquiry"],
      ["FACEBOOK", "Facebook"],
      ["WHATSAPP", "WhatsApp"],
    ]);
    expect(result.totals).toEqual({ profit: 850.5, bookings: 7 });
  });

  it("uses the London month window and labels it YYYY-MM", async () => {
    vi.mocked(repo.getProfitSourceTotals).mockResolvedValue([]);

    const result = await organizationOverviewService.getProfitSources(scope, "b1");

    const [orgId, start, end, branchId] = vi.mocked(repo.getProfitSourceTotals).mock.calls[0];
    expect(orgId).toBe("o1");
    expect(branchId).toBe("b1");
    expect(start.toISOString()).toBe("2026-03-31T23:00:00.000Z");
    expect(end.toISOString()).toBe("2026-04-30T23:00:00.000Z");
    expect(result.month).toBe("2026-04");
    expect(result.rows).toEqual([]);
    expect(result.totals).toEqual({ profit: 0, bookings: 0 });
  });

  it("keeps an unknown source key with its title-cased label", async () => {
    vi.mocked(repo.getProfitSourceTotals).mockResolvedValue([{ source: "WALK_IN", profit: 10, bookings: 1 }]);

    const result = await organizationOverviewService.getProfitSources(scope);

    expect(result.rows[0]).toMatchObject({ source: "WALK_IN", label: "Walk In" });
  });
});

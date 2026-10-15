import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./organization-overview.repository", () => ({
  organizationOverviewRepository: {
    getStats: vi.fn(),
    getHomeworkerBranches: vi.fn(),
    getAgentsPerformance: vi.fn(),
    getBranchesPerformance: vi.fn(),
  },
}));
vi.mock("../plan/plan.service", () => ({ planService: { getOrgPlan: vi.fn() } }));
vi.mock("../branch/branch.service", () => ({ branchService: { assertBranchInOrg: vi.fn() } }));

import { organizationOverviewService, buildHomeworkerRows } from "./organization-overview.service";
import { organizationOverviewRepository as repo } from "./organization-overview.repository";
import { planService } from "../plan/plan.service";
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

    expect(repo.getAgentsPerformance).toHaveBeenCalledWith("o1", "month", undefined, undefined, undefined);
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

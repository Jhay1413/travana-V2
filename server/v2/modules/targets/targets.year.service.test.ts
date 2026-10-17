import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./targets.repository", () => ({
  // legacy surface (unused here but imported by the service module)
  branchBelongsToOrg: vi.fn(),
  getBranchInfo: vi.fn(),
  userBelongsToBranch: vi.fn(),
  getActiveBranchMemberIds: vi.fn(),
  getAllShopTargets: vi.fn(),
  bulkUpsertShopTargets: vi.fn(),
  getAllAgentTargets: vi.fn(),
  getAgentTargetsByUserId: vi.fn(),
  bulkUpsertAgentTargets: vi.fn(),
  getAllAgents: vi.fn(),
  getShopTargetsByDateRange: vi.fn(),
  getAgentTargetsByDateRange: vi.fn(),
  getTargetSummaryByDateRange: vi.fn(),
  // year view
  withTransaction: vi.fn(),
  listBranchesByOrg: vi.fn(),
  getOrgBranchesByIds: vi.fn(),
  findHomeworkerBranchByOwner: vi.fn(),
  listMembers: vi.fn(),
  getMemberUserIds: vi.fn(),
  getOrgTargetsForYear: vi.fn(),
  getShopTargetsForYear: vi.fn(),
  getAgentTargetRowsForYear: vi.fn(),
  getActualsForYear: vi.fn(),
  upsertOrgTargets: vi.fn(),
  upsertShopTargetMonths: vi.fn(),
  upsertAgentTargetMonths: vi.fn(),
  upsertAgentTargetRows: vi.fn(),
  deleteAgentTargetRows: vi.fn(),
}));
vi.mock("../organization/organization-audit.service", () => ({
  organizationAuditService: { record: vi.fn() },
}));

import * as service from "./targets.service";
import * as repo from "./targets.repository";
import { organizationAuditService } from "../organization/organization-audit.service";
import type { AgentTargetRowData } from "./targets.types";

const TX = { tx: true } as never;
const ACTOR = { userId: "actor1", ipAddress: null, userAgent: null, impersonating: false };
const twelve = (v: number) => new Array<number>(12).fill(v);

const admin = { orgRole: "org_admin", orgRoles: ["org_admin"], orgId: "o1", branchId: null, userId: "actor1" } as never;
const platformNoOrg = { orgRole: "platform_admin", orgRoles: ["platform_admin"], orgId: "", branchId: null, userId: "p1" } as never;
const manager = { orgRole: "branch_manager", orgRoles: ["branch_manager"], orgId: "o1", branchId: "s1", userId: "m1" } as never;
const agent = { orgRole: "agent", orgRoles: ["agent"], orgId: "o1", branchId: "s1", userId: "a1" } as never;
const homeworker = { orgRole: "homeworker", orgRoles: ["homeworker"], orgId: "o1", branchId: "h1", userId: "hw1" } as never;

const shop = (id: string, name = id) => ({ id, name, branchType: "shop" as const, ownerUserId: null, ownerName: null, isActive: true });
const hwBranch = (id: string, owner: string) => ({
  id, name: `${owner} branch`, branchType: "homeworker" as const, ownerUserId: owner, ownerName: `Owner ${owner}`, isActive: true,
});

function row(over: Partial<AgentTargetRowData> & { month: number }): AgentTargetRowData {
  return {
    branchId: "h1", userId: "hw1", year: 2026, targetAmount: "0.00", source: "self", selfAmount: null, note: null,
    updatedBy: "someone", updatedAt: null, ...over,
  };
}

function emptyYearMocks() {
  vi.mocked(repo.listBranchesByOrg).mockResolvedValue([]);
  vi.mocked(repo.getOrgTargetsForYear).mockResolvedValue([]);
  vi.mocked(repo.getShopTargetsForYear).mockResolvedValue([]);
  vi.mocked(repo.getAgentTargetRowsForYear).mockResolvedValue([]);
  vi.mocked(repo.listMembers).mockResolvedValue([]);
  vi.mocked(repo.getActualsForYear).mockResolvedValue([]);
}

beforeEach(() => {
  vi.resetAllMocks();
  emptyYearMocks();
  vi.mocked(repo.withTransaction).mockImplementation(async (fn) => fn(TX));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("yearProgress (London)", () => {
  it("is 0 elapsed at London midnight on 1 Jan, month 1", () => {
    const p = service.yearProgress(2026, new Date("2026-01-01T00:00:00Z"));
    expect(p).toEqual({ elapsed: 0, currentMonth: 1 });
  });

  it("treats 23:30 UTC on 30 June as 1 July in London (BST)", () => {
    expect(service.yearProgress(2026, new Date("2026-06-30T23:30:00Z")).currentMonth).toBe(7);
  });

  it("is still the old year until London midnight (UTC in winter)", () => {
    const late = new Date("2025-12-31T23:59:59Z");
    expect(service.yearProgress(2025, late).currentMonth).toBe(12);
    expect(service.yearProgress(2025, late).elapsed).toBeCloseTo(1, 6);
    expect(service.yearProgress(2026, late)).toEqual({ elapsed: 0, currentMonth: 0 });
  });

  it("past year is fully elapsed with month 12, future year is 0 / 0", () => {
    const now = new Date("2026-10-16T12:00:00Z");
    expect(service.yearProgress(2025, now)).toEqual({ elapsed: 1, currentMonth: 12 });
    expect(service.yearProgress(2027, now)).toEqual({ elapsed: 0, currentMonth: 0 });
  });

  it("elapsed is the share of the year gone (mid-year ~ half)", () => {
    const p = service.yearProgress(2026, new Date("2026-07-02T12:00:00Z"));
    expect(p.currentMonth).toBe(7);
    expect(p.elapsed).toBeGreaterThan(0.49);
    expect(p.elapsed).toBeLessThan(0.51);
  });
});

describe("getTargetsYear", () => {
  const now = new Date("2026-10-16T12:00:00Z");

  it("platform_admin without an organisation is rejected", async () => {
    await expect(service.getTargetsYear(platformNoOrg, 2026, now)).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.listBranchesByOrg).not.toHaveBeenCalled();
  });

  it("assembles the org-wide view for an org_admin", async () => {
    vi.mocked(repo.listBranchesByOrg).mockResolvedValue([shop("s1", "North"), shop("s2", "South"), hwBranch("h1", "hw1")]);
    vi.mocked(repo.getOrgTargetsForYear).mockResolvedValue([{ month: 1, amount: "10000.00" }, { month: 12, amount: "5000.00" }]);
    vi.mocked(repo.getShopTargetsForYear).mockResolvedValue([
      { branchId: "s1", month: 1, amount: "6000.00" },
      { branchId: "s2", month: 1, amount: "4000.00" },
    ]);
    vi.mocked(repo.listMembers).mockResolvedValue([
      { branchId: "s1", userId: "a1", name: "Ann", isActive: true },
      { branchId: "s1", userId: "a2", name: "Old Ollie", isActive: false },
      { branchId: "s2", userId: "a3", name: "Gone Gary", isActive: false },
    ]);
    vi.mocked(repo.getAgentTargetRowsForYear).mockResolvedValue([
      row({ branchId: "s1", userId: "a1", month: 1, targetAmount: "2500.40" }),
      row({ branchId: "s1", userId: "a2", month: 2, targetAmount: "700.00" }),
      row({ branchId: "h1", userId: "hw1", month: 3, targetAmount: "900.00", source: "self" }),
    ]);
    vi.mocked(repo.getActualsForYear).mockResolvedValue([
      { branchId: "s1", userId: "a1", month: 1, amount: 1000.4 },
      { branchId: "s1", userId: "a1", month: 1, amount: 250.3 },
      { branchId: "s2", userId: "a9", month: 2, amount: 300 },
      { branchId: "h1", userId: "hw1", month: 3, amount: 800.5 },
    ]);

    const y = await service.getTargetsYear(admin, 2026, now);

    expect(y.year).toBe(2026);
    expect(y.currentMonth).toBe(10);
    expect(y.business?.months[0]).toBe(10000);
    expect(y.business?.months[11]).toBe(5000);
    expect(y.business?.months[5]).toBe(0);
    // business actual is the org-wide sum over every branch incl. homeworkers (rounded per month)
    expect(y.business?.actual[0]).toBe(1251);
    expect(y.business?.actual[1]).toBe(300);
    expect(y.business?.actual[2]).toBe(801);
    expect(y.branches.map((b) => b.id)).toEqual(["s1", "s2"]);
    expect(y.branches[0].months[0]).toBe(6000);
    expect(y.branches[0].actual[0]).toBe(1251);
    expect(y.branches[1].actual[1]).toBe(300);
    // agents: active Ann (rounded 2500), inactive Ollie kept because he has a target, Gary dropped
    expect(y.agents.map((a) => a.userId)).toEqual(["a1", "a2"]);
    expect(y.agents[0].months[0]).toBe(2500);
    expect(y.agents[0].actual[0]).toBe(1251);
    expect(y.agents[0].inactive).toBeUndefined();
    expect(y.agents[1].inactive).toBe(true);
    expect(y.homeworkers).toHaveLength(1);
    expect(y.homeworkers[0]).toMatchObject({ userId: "hw1", branchId: "h1", name: "Owner hw1", source: "self", note: null });
    expect(y.homeworkers[0].months[2]).toBe(900);
    expect(y.homeworkers[0].selfMonths[2]).toBe(900);
    expect(y.homeworkers[0].selfMonths[0]).toBeNull();
    expect(y.homeworkers[0].actual[2]).toBe(801);
    expect(y.canEdit).toEqual({
      business: true, shopBranchIds: ["s1", "s2"], agentBranchIds: ["s1", "s2"], homeworkers: true, mine: false,
    });
    expect(repo.getActualsForYear).toHaveBeenCalledWith("o1", 2026, {});
  });

  it("reports an admin override with its note and the owner's remembered figure", async () => {
    vi.mocked(repo.listBranchesByOrg).mockResolvedValue([hwBranch("h1", "hw1")]);
    vi.mocked(repo.getAgentTargetRowsForYear).mockResolvedValue([
      row({ month: 1, targetAmount: "3000.00", source: "admin", selfAmount: "2000.00", note: "Agreed" }),
      row({ month: 2, targetAmount: "1500.00", source: "self", selfAmount: "1500.00" }),
      row({ month: 3, targetAmount: "400.00", source: "admin", selfAmount: null }),
    ]);

    const [hw] = (await service.getTargetsYear(admin, 2026, now)).homeworkers;

    expect(hw.source).toBe("admin");
    expect(hw.note).toBe("Agreed");
    expect(hw.months.slice(0, 3)).toEqual([3000, 1500, 400]);
    expect(hw.selfMonths.slice(0, 3)).toEqual([2000, 1500, null]);
  });

  it("branch_manager sees only their own shop: no business, no homeworkers, scoped actuals", async () => {
    vi.mocked(repo.listBranchesByOrg).mockResolvedValue([shop("s1"), shop("s2"), hwBranch("h1", "hw1")]);

    const y = await service.getTargetsYear(manager, 2026, now);

    expect(y.business).toBeNull();
    expect(y.homeworkers).toEqual([]);
    expect(y.branches.map((b) => b.id)).toEqual(["s1"]);
    expect(repo.getShopTargetsForYear).toHaveBeenCalledWith(["s1"], 2026);
    expect(repo.listMembers).toHaveBeenCalledWith("o1", ["s1"], undefined);
    expect(repo.getActualsForYear).toHaveBeenCalledWith("o1", 2026, { branchIds: ["s1"] });
    expect(y.canEdit).toEqual({ business: false, shopBranchIds: [], agentBranchIds: ["s1"], homeworkers: false, mine: false });
  });

  it("branch_manager without a branch is rejected", async () => {
    const noBranch = { ...(manager as object), branchId: null } as never;
    await expect(service.getTargetsYear(noBranch, 2026, now)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("an agent reads only their own rows: no business, no branches", async () => {
    vi.mocked(repo.listBranchesByOrg).mockResolvedValue([shop("s1"), hwBranch("h1", "hw1")]);
    vi.mocked(repo.listMembers).mockResolvedValue([{ branchId: "s1", userId: "a1", name: "Ann", isActive: true }]);

    const y = await service.getTargetsYear(agent, 2026, now);

    expect(y.business).toBeNull();
    expect(y.branches).toEqual([]);
    expect(y.homeworkers).toEqual([]);
    expect(y.agents.map((a) => a.userId)).toEqual(["a1"]);
    expect(repo.listMembers).toHaveBeenCalledWith("o1", ["s1"], "a1");
    expect(repo.getAgentTargetRowsForYear).toHaveBeenCalledWith(["s1"], 2026, "a1");
    expect(repo.getActualsForYear).toHaveBeenCalledWith("o1", 2026, { userId: "a1" });
    expect(y.canEdit).toEqual({ business: false, shopBranchIds: [], agentBranchIds: [], homeworkers: false, mine: false });
  });

  it("a homeworker sees only their own homeworker row and may edit it", async () => {
    vi.mocked(repo.listBranchesByOrg).mockResolvedValue([shop("s1"), hwBranch("h1", "hw1"), hwBranch("h2", "hw2")]);

    const y = await service.getTargetsYear(homeworker, 2026, now);

    expect(y.homeworkers.map((h) => h.userId)).toEqual(["hw1"]);
    expect(y.branches).toEqual([]);
    expect(y.business).toBeNull();
    expect(repo.getAgentTargetRowsForYear).toHaveBeenCalledWith(["s1", "h1"], 2026, "hw1");
    expect(y.canEdit.mine).toBe(true);
    expect(y.canEdit.homeworkers).toBe(false);
  });
});

describe("setBusinessTargets", () => {
  it("is admin only", async () => {
    for (const scope of [manager, agent, homeworker]) {
      await expect(service.setBusinessTargets(scope, ACTOR, { year: 2026, months: twelve(1) })).rejects.toMatchObject({ statusCode: 403 });
    }
    expect(repo.withTransaction).not.toHaveBeenCalled();
  });

  it("a platform_admin must have an organisation in scope", async () => {
    await expect(service.setBusinessTargets(platformNoOrg, ACTOR, { year: 2026, months: twelve(1) })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("writes in a transaction, audits and returns the year", async () => {
    const y = await service.setBusinessTargets(admin, ACTOR, { year: 2026, months: twelve(1000) });

    expect(repo.upsertOrgTargets).toHaveBeenCalledWith(TX, "o1", 2026, twelve(1000));
    expect(organizationAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "targets.business.set", orgId: "o1", actor: ACTOR }),
    );
    expect(y.year).toBe(2026);
  });
});

describe("setMyTargets (homeworker self)", () => {
  const months = (first: number) => [first, ...twelve(0).slice(1)];

  it("rejects non-homeworkers and homeworkers without an owned branch", async () => {
    await expect(service.setMyTargets(agent, ACTOR, { year: 2026, months: twelve(1) })).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.setMyTargets(admin, ACTOR, { year: 2026, months: twelve(1) })).rejects.toMatchObject({ statusCode: 403 });
    vi.mocked(repo.findHomeworkerBranchByOwner).mockResolvedValue(null);
    await expect(service.setMyTargets(homeworker, ACTOR, { year: 2026, months: twelve(1) })).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.upsertAgentTargetRows).not.toHaveBeenCalled();
  });

  it("writes only the caller's own branch/user, skipping zero months that have no row", async () => {
    vi.mocked(repo.findHomeworkerBranchByOwner).mockResolvedValue({ id: "h1", name: "HB" });

    await service.setMyTargets(homeworker, ACTOR, { year: 2026, months: months(1200) });

    expect(repo.findHomeworkerBranchByOwner).toHaveBeenCalledWith("o1", "hw1");
    const [, rows] = vi.mocked(repo.upsertAgentTargetRows).mock.calls[0];
    expect(rows).toEqual([
      { branchId: "h1", userId: "hw1", year: 2026, month: 1, targetAmount: "1200", source: "self", selfAmount: "1200", note: null, updatedBy: "hw1" },
    ]);
    expect(organizationAuditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: "targets.homeworker.self", targetUserId: "hw1" }));
  });

  it("while an admin override is in force only self_amount changes", async () => {
    vi.mocked(repo.findHomeworkerBranchByOwner).mockResolvedValue({ id: "h1", name: "HB" });
    vi.mocked(repo.getAgentTargetRowsForYear).mockResolvedValue([
      row({ month: 1, targetAmount: "3000.00", source: "admin", selfAmount: "2000.00", note: "Agreed" }),
      row({ month: 2, targetAmount: "500.00", source: "self", selfAmount: "500.00" }),
    ]);

    await service.setMyTargets(homeworker, ACTOR, { year: 2026, months: [2500, 700, ...twelve(0).slice(2)] });

    const [, rows] = vi.mocked(repo.upsertAgentTargetRows).mock.calls[0];
    expect(rows).toEqual([
      { branchId: "h1", userId: "hw1", year: 2026, month: 1, targetAmount: "3000.00", source: "admin", selfAmount: "2500", note: "Agreed", updatedBy: "someone" },
      { branchId: "h1", userId: "hw1", year: 2026, month: 2, targetAmount: "700", source: "self", selfAmount: "700", note: null, updatedBy: "hw1" },
    ]);
  });
});

describe("homeworker override and revert", () => {
  it("override and revert are admin only", async () => {
    for (const scope of [manager, agent, homeworker]) {
      await expect(service.setHomeworkerOverride(scope, ACTOR, "hw1", { year: 2026, months: twelve(1) })).rejects.toMatchObject({ statusCode: 403 });
      await expect(service.revertHomeworkerOverride(scope, ACTOR, "hw1", 2026)).rejects.toMatchObject({ statusCode: 403 });
    }
  });

  it("404s for a user who owns no homeworker branch in the org", async () => {
    vi.mocked(repo.findHomeworkerBranchByOwner).mockResolvedValue(null);
    await expect(service.setHomeworkerOverride(admin, ACTOR, "x", { year: 2026, months: twelve(1) })).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.revertHomeworkerOverride(admin, ACTOR, "x", 2026)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("override sets the effective target as admin, keeps self_amount, skips untouched months", async () => {
    vi.mocked(repo.findHomeworkerBranchByOwner).mockResolvedValue({ id: "h1", name: "HB" });
    vi.mocked(repo.getAgentTargetRowsForYear).mockResolvedValue([
      row({ month: 1, targetAmount: "1000.00", source: "self", selfAmount: "1000.00" }), // changed
      row({ month: 2, targetAmount: "800.00", source: "self", selfAmount: "800.00" }), // same value -> untouched
    ]);

    await service.setHomeworkerOverride(admin, ACTOR, "hw1", {
      year: 2026,
      months: [1500, 800, 600, ...twelve(0).slice(3)],
      note: "  Agreed in review ",
    });

    const [, rows] = vi.mocked(repo.upsertAgentTargetRows).mock.calls[0];
    expect(rows).toEqual([
      { branchId: "h1", userId: "hw1", year: 2026, month: 1, targetAmount: "1500", source: "admin", selfAmount: "1000.00", note: "Agreed in review", updatedBy: "actor1" },
      { branchId: "h1", userId: "hw1", year: 2026, month: 3, targetAmount: "600", source: "admin", selfAmount: null, note: "Agreed in review", updatedBy: "actor1" },
    ]);
    expect(organizationAuditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: "targets.homeworker.override" }));
  });

  it("revert copies self_amount back (source self) and removes rows with no self figure", async () => {
    vi.mocked(repo.findHomeworkerBranchByOwner).mockResolvedValue({ id: "h1", name: "HB" });
    vi.mocked(repo.getAgentTargetRowsForYear).mockResolvedValue([
      row({ month: 1, targetAmount: "3000.00", source: "admin", selfAmount: "2000.00", note: "x" }),
      row({ month: 2, targetAmount: "900.00", source: "admin", selfAmount: null }),
      row({ month: 3, targetAmount: "100.00", source: "self", selfAmount: "100.00" }),
    ]);

    await service.revertHomeworkerOverride(admin, ACTOR, "hw1", 2026);

    const [, rows] = vi.mocked(repo.upsertAgentTargetRows).mock.calls[0];
    expect(rows).toEqual([
      { branchId: "h1", userId: "hw1", year: 2026, month: 1, targetAmount: "2000.00", source: "self", selfAmount: "2000.00", note: null, updatedBy: "actor1" },
    ]);
    expect(repo.deleteAgentTargetRows).toHaveBeenCalledWith(TX, "h1", "hw1", 2026, [2]);
    expect(organizationAuditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: "targets.homeworker.revert" }));
  });
});

describe("saveAllocation", () => {
  const shopsRows = (...ids: string[]) => ids.map((id) => ({ id, branchType: "shop" as const }));

  it("rejects agents, homeworkers and social roles", async () => {
    for (const scope of [agent, homeworker]) {
      await expect(service.saveAllocation(scope, ACTOR, { year: 2026, business: { months: twelve(1) } })).rejects.toMatchObject({ statusCode: 403 });
    }
  });

  it("branch_manager may not send business or shops (403)", async () => {
    await expect(service.saveAllocation(manager, ACTOR, { year: 2026, business: { months: twelve(1) } })).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      service.saveAllocation(manager, ACTOR, { year: 2026, shops: [{ branchId: "s1", months: twelve(1) }] }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.withTransaction).not.toHaveBeenCalled();
  });

  it("branch_manager sending agents for another branch is 403", async () => {
    await expect(
      service.saveAllocation(manager, ACTOR, { year: 2026, agents: [{ branchId: "s2", userId: "a1", months: twelve(1) }] }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.getOrgBranchesByIds).not.toHaveBeenCalled();
  });

  it("platform_admin without an organisation is rejected", async () => {
    await expect(service.saveAllocation(platformNoOrg, ACTOR, { year: 2026, business: { months: twelve(1) } })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a branch that is not in the org (404) and writes nothing", async () => {
    vi.mocked(repo.getOrgBranchesByIds).mockResolvedValue(shopsRows("s1"));
    await expect(
      service.saveAllocation(admin, ACTOR, {
        year: 2026,
        shops: [{ branchId: "s1", months: twelve(1) }, { branchId: "foreign", months: twelve(1) }],
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.getOrgBranchesByIds).toHaveBeenCalledWith("o1", ["s1", "foreign"]);
    expect(repo.withTransaction).not.toHaveBeenCalled();
  });

  it("rejects a homeworker branch (400)", async () => {
    vi.mocked(repo.getOrgBranchesByIds).mockResolvedValue([{ id: "h1", branchType: "homeworker" }]);
    await expect(
      service.saveAllocation(admin, ACTOR, { year: 2026, agents: [{ branchId: "h1", userId: "hw1", months: twelve(1) }] }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a user who is not a member of the branch (404) and writes nothing", async () => {
    vi.mocked(repo.getOrgBranchesByIds).mockResolvedValue(shopsRows("s1"));
    vi.mocked(repo.getMemberUserIds).mockResolvedValue(new Set(["a1"]));
    await expect(
      service.saveAllocation(admin, ACTOR, {
        year: 2026,
        agents: [
          { branchId: "s1", userId: "a1", months: twelve(1) },
          { branchId: "s1", userId: "stranger", months: twelve(1) },
        ],
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.getMemberUserIds).toHaveBeenCalledWith("s1", ["a1", "stranger"]);
    expect(repo.withTransaction).not.toHaveBeenCalled();
    expect(organizationAuditService.record).not.toHaveBeenCalled();
  });

  it("rejects duplicate rows", async () => {
    await expect(
      service.saveAllocation(admin, ACTOR, {
        year: 2026,
        shops: [{ branchId: "s1", months: twelve(1) }, { branchId: "s1", months: twelve(2) }],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("writes every provided row in ONE transaction and audits per kind", async () => {
    vi.mocked(repo.getOrgBranchesByIds).mockResolvedValue(shopsRows("s1", "s2"));
    vi.mocked(repo.getMemberUserIds).mockResolvedValue(new Set(["a1"]));

    const y = await service.saveAllocation(admin, ACTOR, {
      year: 2026,
      business: { months: twelve(10) },
      shops: [{ branchId: "s1", months: twelve(5) }],
      agents: [{ branchId: "s2", userId: "a1", months: twelve(2) }],
    });

    expect(repo.withTransaction).toHaveBeenCalledTimes(1);
    expect(repo.upsertOrgTargets).toHaveBeenCalledWith(TX, "o1", 2026, twelve(10));
    expect(repo.upsertShopTargetMonths).toHaveBeenCalledWith(TX, "s1", 2026, twelve(5));
    expect(repo.upsertAgentTargetMonths).toHaveBeenCalledWith(TX, "s2", "a1", 2026, twelve(2), "actor1");
    const actions = vi.mocked(organizationAuditService.record).mock.calls.map((c) => c[0].action);
    expect(actions).toEqual(["targets.business.set", "targets.shop.set", "targets.agent.set"]);
    expect(y.year).toBe(2026);
  });

  it("a failure part-way through the transaction propagates and nothing is audited (all-or-nothing)", async () => {
    vi.mocked(repo.getOrgBranchesByIds).mockResolvedValue(shopsRows("s1"));
    vi.mocked(repo.getMemberUserIds).mockResolvedValue(new Set(["a1"]));
    vi.mocked(repo.upsertAgentTargetMonths).mockRejectedValue(new Error("db down"));

    await expect(
      service.saveAllocation(admin, ACTOR, {
        year: 2026,
        shops: [{ branchId: "s1", months: twelve(5) }],
        agents: [{ branchId: "s1", userId: "a1", months: twelve(2) }],
      }),
    ).rejects.toThrow("db down");

    // every write ran inside the single withTransaction call, so the db rolls the shop write back too
    expect(repo.withTransaction).toHaveBeenCalledTimes(1);
    expect(organizationAuditService.record).not.toHaveBeenCalled();
  });

  it("branch_manager can allocate agents in their own branch", async () => {
    vi.mocked(repo.getOrgBranchesByIds).mockResolvedValue(shopsRows("s1"));
    vi.mocked(repo.getMemberUserIds).mockResolvedValue(new Set(["a1"]));

    await service.saveAllocation(manager, ACTOR, { year: 2026, agents: [{ branchId: "s1", userId: "a1", months: twelve(3) }] });

    expect(repo.upsertAgentTargetMonths).toHaveBeenCalledWith(TX, "s1", "a1", 2026, twelve(3), "actor1");
    expect(repo.upsertOrgTargets).not.toHaveBeenCalled();
    expect(repo.upsertShopTargetMonths).not.toHaveBeenCalled();
  });
});

describe("getTargetsOverview — exact balance and London month", () => {
  const mgr = { orgRole: "branch_manager", orgRoles: ["branch_manager"], orgId: "o1", branchId: "s1", userId: "m1" } as never;

  function mockOverview(shopAmount: string, agentTotal: string) {
    vi.mocked(repo.getBranchInfo).mockResolvedValue({ branchType: "shop", ownerUserId: null });
    vi.mocked(repo.getShopTargetsByDateRange).mockResolvedValue([]);
    vi.mocked(repo.getAgentTargetsByDateRange).mockResolvedValue([]);
    vi.mocked(repo.getAllAgents).mockResolvedValue([]);
    vi.mocked(repo.getTargetSummaryByDateRange).mockResolvedValue({
      shopTargets: [{ year: 2026, month: 1, targetAmount: shopAmount }] as never,
      agentTargetSums: [{ year: 2026, month: 1, total: agentTotal }],
    });
  }

  it("a £300 gap is no longer 'balanced' (the £500 tolerance is gone)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T12:00:00Z"));
    mockOverview("10000.00", "9700.00");

    const { summary } = await service.getTargetsOverview(mgr);

    expect(summary[0]).toMatchObject({ month: 1, difference: "-300.00", status: "under" });
  });

  it("an exact match is balanced and an excess is over", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T12:00:00Z"));
    mockOverview("10000.00", "10000.00");
    expect((await service.getTargetsOverview(mgr)).summary[0].status).toBe("balanced");
    mockOverview("10000.00", "10001.00");
    expect((await service.getTargetsOverview(mgr)).summary[0].status).toBe("over");
  });

  it("uses the London month: 23:30 UTC on 30 June is already July", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T23:30:00Z"));
    mockOverview("0", "0");

    await service.getTargetsOverview(mgr);

    // current month 7 -> window ends 23 months later: June 2028
    expect(repo.getShopTargetsByDateRange).toHaveBeenCalledWith("s1", 2026, 1, 2028, 6);
  });
});

describe("legacy writes are audited", () => {
  it("records shop and agent writes when an actor is supplied", async () => {
    const adm = { orgRole: "org_admin", orgRoles: ["org_admin"], orgId: "o1", branchId: "s1", userId: "actor1" } as never;
    vi.mocked(repo.getBranchInfo).mockResolvedValue({ branchType: "shop", ownerUserId: null });
    vi.mocked(repo.getActiveBranchMemberIds).mockResolvedValue(new Set(["a1"]));
    vi.mocked(repo.bulkUpsertShopTargets).mockResolvedValue([]);
    vi.mocked(repo.bulkUpsertAgentTargets).mockResolvedValue([]);

    await service.upsertShopTargets(adm, [{ year: 2026, month: 1, targetAmount: "100" }], undefined, ACTOR);
    await service.upsertAgentTargets(adm, [{ userId: "a1", year: 2026, month: 1, targetAmount: "100" }], undefined, ACTOR);

    const actions = vi.mocked(organizationAuditService.record).mock.calls.map((c) => c[0].action);
    expect(actions).toEqual(["targets.shop.set", "targets.agent.set"]);
  });
});

describe("legacy homeworker rows (source admin, updated_by null) are the owner's own figure", () => {
  const legacy = (month: number, amount: string) =>
    row({ month, targetAmount: amount, source: "admin", selfAmount: null, updatedBy: null });

  it("year view reads them as self, with selfMonths = target and no override note", async () => {
    vi.mocked(repo.listBranchesByOrg).mockResolvedValue([hwBranch("h1", "hw1")]);
    vi.mocked(repo.getAgentTargetRowsForYear).mockResolvedValue([legacy(1, "1200.00")]);

    const [hw] = (await service.getTargetsYear(admin, 2026, new Date("2026-10-16T12:00:00Z"))).homeworkers;

    expect(hw.source).toBe("self");
    expect(hw.months[0]).toBe(1200);
    expect(hw.selfMonths[0]).toBe(1200);
    expect(hw.note).toBeNull();
  });

  it("revert never deletes a legacy row (it is the owner's own figure)", async () => {
    vi.mocked(repo.findHomeworkerBranchByOwner).mockResolvedValue({ id: "h1", name: "HB" });
    vi.mocked(repo.getAgentTargetRowsForYear).mockResolvedValue([legacy(1, "1200.00")]);

    await service.revertHomeworkerOverride(admin, ACTOR, "hw1", 2026);

    expect(repo.deleteAgentTargetRows).toHaveBeenCalledWith(TX, "h1", "hw1", 2026, []);
    const [, rows] = vi.mocked(repo.upsertAgentTargetRows).mock.calls[0];
    expect(rows).toEqual([]);
  });

  it("PUT /mine on a legacy row replaces the figure and persists proper bookkeeping", async () => {
    vi.mocked(repo.findHomeworkerBranchByOwner).mockResolvedValue({ id: "h1", name: "HB" });
    vi.mocked(repo.getAgentTargetRowsForYear).mockResolvedValue([legacy(1, "1200.00")]);

    await service.setMyTargets(homeworker, ACTOR, { year: 2026, months: [1500, ...twelve(0).slice(1)] });

    const [, rows] = vi.mocked(repo.upsertAgentTargetRows).mock.calls[0];
    expect(rows).toEqual([
      { branchId: "h1", userId: "hw1", year: 2026, month: 1, targetAmount: "1500", source: "self", selfAmount: "1500", note: null, updatedBy: "hw1" },
    ]);
  });

  it("an override of a legacy row keeps the old figure as self_amount and stamps updated_by", async () => {
    vi.mocked(repo.findHomeworkerBranchByOwner).mockResolvedValue({ id: "h1", name: "HB" });
    vi.mocked(repo.getAgentTargetRowsForYear).mockResolvedValue([legacy(1, "1200.00")]);

    await service.setHomeworkerOverride(admin, ACTOR, "hw1", { year: 2026, months: [2000, ...twelve(0).slice(1)] });

    const [, rows] = vi.mocked(repo.upsertAgentTargetRows).mock.calls[0];
    expect(rows).toEqual([
      { branchId: "h1", userId: "hw1", year: 2026, month: 1, targetAmount: "2000", source: "admin", selfAmount: "1200.00", note: null, updatedBy: "actor1" },
    ]);
  });
});

describe("homeworker note choice and lost-update protection", () => {
  it("the note comes from the most recently updated override, else the lowest month", async () => {
    vi.mocked(repo.listBranchesByOrg).mockResolvedValue([hwBranch("h1", "hw1")]);
    vi.mocked(repo.getAgentTargetRowsForYear).mockResolvedValue([
      row({ month: 5, source: "admin", note: "older", updatedAt: new Date("2026-01-01T00:00:00Z") }),
      row({ month: 7, source: "admin", note: "newest-later-month", updatedAt: new Date("2026-03-01T00:00:00Z") }),
      row({ month: 2, source: "admin", note: "newest", updatedAt: new Date("2026-03-01T00:00:00Z") }),
    ]);
    const [hw] = (await service.getTargetsYear(admin, 2026, new Date("2026-10-16T12:00:00Z"))).homeworkers;
    expect(hw.note).toBe("newest");
  });

  it("self, override and revert read the rows FOR UPDATE inside their transaction", async () => {
    vi.mocked(repo.findHomeworkerBranchByOwner).mockResolvedValue({ id: "h1", name: "HB" });
    await service.setMyTargets(homeworker, ACTOR, { year: 2026, months: twelve(1) });
    await service.setHomeworkerOverride(admin, ACTOR, "hw1", { year: 2026, months: twelve(1) });
    await service.revertHomeworkerOverride(admin, ACTOR, "hw1", 2026);
    const locked = vi.mocked(repo.getAgentTargetRowsForYear).mock.calls.filter((c) => c[3] === TX && c[4] === true);
    expect(locked).toHaveLength(3);
  });
});

describe("self-only scope fails closed", () => {
  it("a self-only caller without a userId is 403 before any query", async () => {
    const noUser = { orgRole: "agent", orgRoles: ["agent"], orgId: "o1", branchId: "s1", userId: null } as never;
    await expect(service.getTargetsYear(noUser, 2026)).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.listBranchesByOrg).not.toHaveBeenCalled();
    expect(repo.getAgentTargetRowsForYear).not.toHaveBeenCalled();
  });
});

describe("legacy POST /agent on an owned homeworker branch", () => {
  const hwAdmin = { orgRole: "org_admin", orgRoles: ["org_admin"], orgId: "o1", branchId: null, userId: "actor1" } as never;

  it("is routed through the override bookkeeping (source admin, self figure kept)", async () => {
    vi.mocked(repo.branchBelongsToOrg).mockResolvedValue(true);
    vi.mocked(repo.getBranchInfo).mockResolvedValue({ branchType: "homeworker", ownerUserId: "hw1" });
    vi.mocked(repo.getActiveBranchMemberIds).mockResolvedValue(new Set(["hw1"]));
    vi.mocked(repo.getAgentTargetsByUserId).mockResolvedValue([]);
    vi.mocked(repo.getAgentTargetRowsForYear).mockResolvedValue([
      row({ month: 3, targetAmount: "800.00", source: "self", selfAmount: "800.00" }),
    ]);

    await service.upsertAgentTargets(
      hwAdmin,
      [{ userId: "hw1", year: 2026, month: 3, targetAmount: "900" }],
      "h1",
      ACTOR,
    );

    expect(repo.bulkUpsertAgentTargets).not.toHaveBeenCalled();
    const [, rows] = vi.mocked(repo.upsertAgentTargetRows).mock.calls[0];
    expect(rows).toEqual([
      { branchId: "h1", userId: "hw1", year: 2026, month: 3, targetAmount: "900", source: "admin", selfAmount: "800.00", note: null, updatedBy: "actor1" },
    ]);
    expect(organizationAuditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: "targets.homeworker.override" }));
  });
});

describe("legacy validateYear matches the new range", () => {
  it("accepts 2000 and 2100, rejects 1999", async () => {
    const adm = { orgRole: "org_admin", orgRoles: ["org_admin"], orgId: "o1", branchId: "s1", userId: "actor1" } as never;
    vi.mocked(repo.getBranchInfo).mockResolvedValue({ branchType: "shop", ownerUserId: null });
    vi.mocked(repo.bulkUpsertShopTargets).mockResolvedValue([]);
    await expect(service.upsertShopTargets(adm, [{ year: 2100, month: 1, targetAmount: "1" }])).resolves.toBeDefined();
    await expect(service.upsertShopTargets(adm, [{ year: 1999, month: 1, targetAmount: "1" }])).rejects.toMatchObject({ statusCode: 400 });
  });
});

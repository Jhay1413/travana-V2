import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./agent-profile.repository", () => ({
  agentProfileRepository: {
    listMemberships: vi.fn(),
    findSubjectUser: vi.fn(),
    findOrganisationName: vi.fn(),
    getLifetimeProfit: vi.fn(),
    listBiggestDeals: vi.fn(),
    getWindowTotals: vi.fn(),
    getQuoteWindowCounts: vi.fn(),
    countQuoteViews: vi.fn(),
  },
}));
vi.mock("../targets/targets.repository", () => ({ getActualsForYear: vi.fn() }));
vi.mock("../targets/targets.service", () => ({ getMemberYearTargets: vi.fn(), yearProgress: vi.fn() }));
vi.mock("../organization-overview/organization-overview-compare.repository", () => ({
  organizationOverviewCompareRepository: { getOpenDealCounts: vi.fn() },
}));
vi.mock("../homeworker/homeworker.repository", () => ({ homeworkerRepository: { findByOwner: vi.fn() } }));
vi.mock("../user-org-roles/user-org-roles.service", () => ({
  userOrgRolesService: { listForUser: vi.fn() },
  primaryRole: (roles: string[]) => roles[0] ?? null,
}));

import { agentProfileService } from "./agent-profile.service";
import { agentProfileRepository as repo } from "./agent-profile.repository";
import * as targetsRepository from "../targets/targets.repository";
import { getMemberYearTargets, yearProgress } from "../targets/targets.service";
import { organizationOverviewCompareRepository } from "../organization-overview/organization-overview-compare.repository";
import { homeworkerRepository } from "../homeworker/homeworker.repository";
import { userOrgRolesService } from "../user-org-roles/user-org-roles.service";

const NOW = new Date("2026-10-19T12:00:00Z");

const admin = { orgId: "o1", branchId: null, orgRole: "org_admin", orgRoles: ["org_admin"], userId: "viewer" } as never;
const manager = { orgId: "o1", branchId: "b1", orgRole: "branch_manager", orgRoles: ["branch_manager"], userId: "viewer" } as never;

const membership = (over: Record<string, unknown> = {}) => ({
  branchId: "b1", branchName: "North", branchType: "shop", openingPattern: "mon-sat", orgRole: "agent",
  isActive: true, joinedAt: new Date("2025-03-01T00:00:00Z"), ...over,
});
const subject = (over: Record<string, unknown> = {}) => ({
  id: "u1", name: "Ann Lee", firstName: "Ann", lastName: "Lee", email: "a@x", phone: "07", image: null,
  createdAt: new Date("2024-01-01T00:00:00Z"), hrStartDate: null, organisationName: "Travana Ltd", ...over,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.listMemberships).mockResolvedValue([membership(), membership({ branchId: "b2", branchName: "South" })] as never);
  vi.mocked(repo.findSubjectUser).mockResolvedValue(subject() as never);
  vi.mocked(repo.findOrganisationName).mockResolvedValue("Travana Ltd");
  vi.mocked(repo.getLifetimeProfit).mockResolvedValue(9000);
  vi.mocked(repo.listBiggestDeals).mockResolvedValue([]);
  vi.mocked(userOrgRolesService.listForUser).mockResolvedValue(["agent"]);
  vi.mocked(homeworkerRepository.findByOwner).mockResolvedValue(null);
  vi.mocked(organizationOverviewCompareRepository.getOpenDealCounts).mockResolvedValue(new Map([["u1", 4]]));
  vi.mocked(targetsRepository.getActualsForYear).mockResolvedValue([]);
  vi.mocked(getMemberYearTargets).mockResolvedValue(new Array<number>(12).fill(1000));
  vi.mocked(yearProgress).mockReturnValue({ elapsed: 0.8, currentMonth: 10 });
});

describe("getHeader - access and filters", () => {
  it("404s a branch manager for an agent outside their branch before reading any data", async () => {
    vi.mocked(repo.listMemberships).mockResolvedValue([membership({ branchId: "b9" })] as never);

    await expect(agentProfileService.getHeader(manager, "u1", NOW)).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.findSubjectUser).not.toHaveBeenCalled();
    expect(repo.getLifetimeProfit).not.toHaveBeenCalled();
  });

  it("403s without an organisation", async () => {
    const noOrg = { ...(admin as object), orgId: "" } as never;
    await expect(agentProfileService.getHeader(noOrg, "u1", NOW)).rejects.toMatchObject({ statusCode: 403 });
    expect(repo.listMemberships).not.toHaveBeenCalled();
  });

  it("an admin's reads are org + user only; a manager's add the manager's branch everywhere", async () => {
    await agentProfileService.getHeader(admin, "u1", NOW);
    expect(repo.getLifetimeProfit).toHaveBeenLastCalledWith({ orgId: "o1", branchId: undefined, userId: "u1" });
    expect(targetsRepository.getActualsForYear).toHaveBeenLastCalledWith("o1", 2026, { userId: "u1" });
    expect(organizationOverviewCompareRepository.getOpenDealCounts).toHaveBeenLastCalledWith("o1", undefined, "u1");

    await agentProfileService.getHeader(manager, "u1", NOW);
    expect(repo.getLifetimeProfit).toHaveBeenLastCalledWith({ orgId: "o1", branchId: "b1", userId: "u1" });
    expect(repo.listBiggestDeals).toHaveBeenLastCalledWith({ orgId: "o1", branchId: "b1", userId: "u1" }, 1);
    expect(targetsRepository.getActualsForYear).toHaveBeenLastCalledWith("o1", 2026, { userId: "u1", branchIds: ["b1"] });
    expect(organizationOverviewCompareRepository.getOpenDealCounts).toHaveBeenLastCalledWith("o1", "b1", "u1");
  });
});

describe("getHeader - content", () => {
  it("shows an admin every branch and a manager only their own", async () => {
    expect((await agentProfileService.getHeader(admin, "u1", NOW)).branches.map((b) => b.id)).toEqual(["b1", "b2"]);
    const asManager = await agentProfileService.getHeader(manager, "u1", NOW);
    expect(asManager.branches.map((b) => b.id)).toEqual(["b1"]);
    expect(asManager.branches[0].openingPattern).toBe("mon-sat");
  });

  it("comparator is the organisation for admins and the branch for managers", async () => {
    expect((await agentProfileService.getHeader(admin, "u1", NOW)).viewer).toEqual({
      isAdmin: true, canSeePay: true, comparatorScope: "organisation", comparatorLabel: "Travana Ltd",
    });
    expect((await agentProfileService.getHeader(manager, "u1", NOW)).viewer).toEqual({
      isAdmin: false, canSeePay: false, comparatorScope: "branch", comparatorLabel: "North",
    });
  });

  it("started date falls back HR, then membership, then account", async () => {
    vi.mocked(repo.findSubjectUser).mockResolvedValue(subject({ hrStartDate: "2024-09-02" }) as never);
    expect(await agentProfileService.getHeader(admin, "u1", NOW)).toMatchObject({ startedAt: "2024-09-02", startedAtSource: "hr" });

    vi.mocked(repo.findSubjectUser).mockResolvedValue(subject() as never);
    expect(await agentProfileService.getHeader(admin, "u1", NOW)).toMatchObject({ startedAt: "2025-03-01", startedAtSource: "membership" });
  });

  it("nulls the profit share unless the viewer can see pay", async () => {
    vi.mocked(userOrgRolesService.listForUser).mockResolvedValue(["homeworker"]);
    vi.mocked(repo.listMemberships).mockResolvedValue([membership({ branchId: "hb1", branchType: "homeworker" })] as never);
    vi.mocked(homeworkerRepository.findByOwner).mockResolvedValue({ id: "hb1", name: "Ann HW", isActive: true, profitSharePercent: "70.00" } as never);

    const asAdmin = await agentProfileService.getHeader(admin, "u1", NOW);
    expect(asAdmin.isHomeworker).toBe(true);
    expect(asAdmin.homeworker).toMatchObject({ branchId: "hb1", profitSharePercent: 70 });

    const mgr = { ...(manager as object), branchId: "hb1" } as never;
    expect((await agentProfileService.getHeader(mgr, "u1", NOW)).homeworker).toMatchObject({ profitSharePercent: null });
  });

  it("hides a homeworker branch from a manager who cannot see that membership", async () => {
    vi.mocked(homeworkerRepository.findByOwner).mockResolvedValue({ id: "hb1", name: "HW", isActive: true, profitSharePercent: "70.00" } as never);
    const header = await agentProfileService.getHeader(manager, "u1", NOW);
    expect(header.homeworker).toBeNull();
  });

  it("best month is null when nothing was earned and the strongest month otherwise", async () => {
    expect((await agentProfileService.getHeader(admin, "u1", NOW)).bestMonth).toBeNull();

    vi.mocked(targetsRepository.getActualsForYear).mockResolvedValue([
      { branchId: "b1", userId: "u1", month: 3, amount: 400 },
      { branchId: "b1", userId: "u1", month: 8, amount: 900.4 },
    ]);
    expect((await agentProfileService.getHeader(admin, "u1", NOW)).bestMonth).toEqual({ month: "2026-08", profit: 900 });
  });

  it("reports suspended only when every visible membership is off, and the open-deal count", async () => {
    vi.mocked(repo.listMemberships).mockResolvedValue([membership({ isActive: false })] as never);
    const header = await agentProfileService.getHeader(admin, "u1", NOW);
    expect(header.isSuspended).toBe(true);
    expect(header.openDeals).toBe(4);
    expect(header.lifetimeProfit).toBe(9000);
  });
});

describe("getPerformance", () => {
  beforeEach(() => {
    vi.mocked(repo.getWindowTotals).mockImplementation(async (f) =>
      f.userId ? { profit: 300, bookings: 3, sales: 2400 } : { profit: 3000, bookings: 20, sales: 30000 },
    );
    vi.mocked(repo.getQuoteWindowCounts).mockResolvedValue({ quotesSent: 12, quotedDeals: 6 });
    vi.mocked(repo.countQuoteViews).mockResolvedValue(30);
  });

  it("derives ppb, close rate (bookings / quoted deals) and commission rate, with the comparator", async () => {
    const out = await agentProfileService.getPerformance(admin, "u1", "2026-10-01", "2026-10-20");

    expect(out).toMatchObject({
      window: { from: "2026-10-01", to: "2026-10-20" },
      profit: 300, bookings: 3, sales: 2400, ppb: 100, quotesSent: 12, quotedDeals: 6, quoteViews: 30,
      closeRate: 50, commissionRate: 12.5,
      comparator: { scope: "organisation", label: "Travana Ltd", profit: 3000, bookings: 20, sales: 30000, avgCommissionRate: 10 },
    });
  });

  it("converts London dates to instants (BST midnight is 23:00 UTC the day before)", async () => {
    await agentProfileService.getPerformance(admin, "u1", "2026-10-01", "2026-10-20");
    const window = vi.mocked(repo.getWindowTotals).mock.calls[0][1];
    expect(window.from.toISOString()).toBe("2026-09-30T23:00:00.000Z");
    expect(window.to.toISOString()).toBe("2026-10-19T23:00:00.000Z");
  });

  it("uses the manager's branch for both the agent and the comparator", async () => {
    const out = await agentProfileService.getPerformance(manager, "u1", "2026-10-01", "2026-10-20");

    const filters = vi.mocked(repo.getWindowTotals).mock.calls.map((c) => c[0]);
    expect(filters).toContainEqual({ orgId: "o1", branchId: "b1", userId: "u1" });
    expect(filters).toContainEqual({ orgId: "o1", branchId: "b1" });
    expect(out.comparator).toMatchObject({ scope: "branch", label: "North" });
  });

  it("guards the zero cases", async () => {
    vi.mocked(repo.getWindowTotals).mockResolvedValue({ profit: 0, bookings: 0, sales: 0 });
    vi.mocked(repo.getQuoteWindowCounts).mockResolvedValue({ quotesSent: 0, quotedDeals: 0 });
    const out = await agentProfileService.getPerformance(admin, "u1", "2026-10-01", "2026-10-20");
    expect(out).toMatchObject({ ppb: 0, closeRate: 0, commissionRate: null });
    expect(out.comparator.avgCommissionRate).toBeNull();
  });
});

describe("getMonthly", () => {
  it("reads the user's months and the comparator months from getActualsForYear", async () => {
    vi.mocked(targetsRepository.getActualsForYear).mockImplementation(async (_org, _year, filter) =>
      filter?.userId ? [{ branchId: "b1", userId: "u1", month: 2, amount: 150 }] : [{ branchId: "b1", userId: "x", month: 2, amount: 1500 }],
    );

    const out = await agentProfileService.getMonthly(admin, "u1", undefined, NOW);

    expect(out.year).toBe(2026);
    expect(out.currentMonth).toBe(10);
    expect(out.months[1]).toEqual({ month: "2026-02", profit: 150 });
    expect(out.comparator.months[1]).toEqual({ month: "2026-02", profit: 1500 });
    expect(out.targets).toHaveLength(12);
    expect(targetsRepository.getActualsForYear).toHaveBeenCalledWith("o1", 2026, { userId: "u1" });
    expect(targetsRepository.getActualsForYear).toHaveBeenCalledWith("o1", 2026, {});
    expect(getMemberYearTargets).toHaveBeenCalledWith(admin, "u1", 2026);
  });

  it("scopes a manager's agent and comparator to their branch and honours an explicit year", async () => {
    await agentProfileService.getMonthly(manager, "u1", 2025, NOW);

    expect(targetsRepository.getActualsForYear).toHaveBeenCalledWith("o1", 2025, { userId: "u1", branchIds: ["b1"] });
    expect(targetsRepository.getActualsForYear).toHaveBeenCalledWith("o1", 2025, { branchIds: ["b1"] });
    expect(yearProgress).toHaveBeenCalledWith(2025, NOW);
  });

  it("404s outside the manager's branch", async () => {
    vi.mocked(repo.listMemberships).mockResolvedValue([membership({ branchId: "b9" })] as never);
    await expect(agentProfileService.getMonthly(manager, "u1", 2026, NOW)).rejects.toMatchObject({ statusCode: 404 });
    expect(targetsRepository.getActualsForYear).not.toHaveBeenCalled();
  });
});

describe("getBiggestDeals", () => {
  it("defaults to five, maps rows and scopes a manager to their branch", async () => {
    vi.mocked(repo.listBiggestDeals).mockResolvedValue([
      {
        bookingId: "bk1", transactionId: "t1", clientId: "c1", clientFirstName: "Ann", clientSurname: "Lee", title: "Spain",
        bookedAt: new Date("2026-05-01T10:00:00Z"), travelDate: "2026-08-01", salesPrice: 4000, commission: 520,
      },
    ]);

    const out = await agentProfileService.getBiggestDeals(manager, "u1");

    expect(repo.listBiggestDeals).toHaveBeenCalledWith({ orgId: "o1", branchId: "b1", userId: "u1" }, 5);
    expect(out.rows[0]).toMatchObject({ bookingId: "bk1", clientName: "Ann Lee", commission: 520, bookedAt: "2026-05-01T10:00:00.000Z" });
  });
});

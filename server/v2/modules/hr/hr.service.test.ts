import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@aws-sdk/client-s3", () => ({
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: vi.fn() }));
vi.mock("../../config/s3", () => ({ s3Client: {}, S3_BUCKET: "bucket" }));
vi.mock("./hr.repository", () => ({ hrRepository: {} }));
vi.mock("../invite/invite.service", () => ({ inviteService: { send: vi.fn() } }));
vi.mock("../homeworker/homeworker.service", () => ({ homeworkerService: { invite: vi.fn() } }));

import { hrService } from "./hr.service";
import { hrRepository } from "./hr.repository";
import { inviteService } from "../invite/invite.service";
import { homeworkerService } from "../homeworker/homeworker.service";

const ADMIN_SCOPE = {
  orgId: "o1",
  branchId: null,
  orgRole: "org_admin",
  orgRoles: ["org_admin"],
  userId: "admin1",
  branchType: null,
  ownsHomeworkerBranch: false,
} as never;

const MANAGER_SCOPE = {
  orgId: "o1",
  branchId: "b1",
  orgRole: "branch_manager",
  orgRoles: ["branch_manager"],
  userId: "m1",
  branchType: "shop",
  ownsHomeworkerBranch: false,
} as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("hrService.invite", () => {
  it("routes a homeworker through the homeworker service (no invite.service, no branchId)", async () => {
    vi.mocked(homeworkerService.invite).mockResolvedValue({ userId: "u1", branchId: "hb1", email: "a@b.com", expiresAt: new Date(0) });

    const result = await hrService.invite(
      { email: "a@b.com", orgRole: "homeworker", profitSharePercent: "40", displayName: "Jo" },
      ADMIN_SCOPE,
    );

    expect(homeworkerService.invite).toHaveBeenCalledWith(
      { email: "a@b.com", profitSharePercent: "40", displayName: "Jo" },
      { orgId: "o1", userId: "admin1", orgRole: "org_admin", orgRoles: ["org_admin"] },
      undefined,
    );
    expect(inviteService.send).not.toHaveBeenCalled();
    expect(result).toMatchObject({ branchId: "hb1" });
  });

  it("hands the branch manager identity to the homeworker service so it can 403", async () => {
    vi.mocked(homeworkerService.invite).mockRejectedValue(Object.assign(new Error("no"), { statusCode: 403 }));

    await expect(hrService.invite({ email: "a@b.com", orgRole: "homeworker" }, MANAGER_SCOPE)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(vi.mocked(homeworkerService.invite).mock.calls[0][1]).toMatchObject({ orgRole: "branch_manager" });
  });

  it("keeps delegating branch roles to invite.service", async () => {
    vi.mocked(inviteService.send).mockResolvedValue({ userId: "u1" } as never);

    await hrService.invite({ email: "a@b.com", orgRole: "agent", branchId: "b1" }, MANAGER_SCOPE);

    expect(inviteService.send).toHaveBeenCalledWith(
      { email: "a@b.com", branchId: "b1", orgRole: "agent" },
      { orgId: "o1", userId: "m1", orgRole: "branch_manager", branchId: "b1" },
      undefined,
    );
    expect(homeworkerService.invite).not.toHaveBeenCalled();
  });

  it("still blocks a branch manager inviting into another branch", async () => {
    await expect(
      hrService.invite({ email: "a@b.com", orgRole: "agent", branchId: "b2" }, MANAGER_SCOPE),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(inviteService.send).not.toHaveBeenCalled();
  });
});

describe("hrService.invite - link origin", () => {
  it("passes the request origin to both invite arms", async () => {
    vi.mocked(homeworkerService.invite).mockResolvedValue({} as never);
    vi.mocked(inviteService.send).mockResolvedValue({} as never);
    await hrService.invite({ email: "a@b.com", orgRole: "homeworker" }, MANAGER_SCOPE, "http://localhost:5000");
    await hrService.invite({ email: "a@b.com", orgRole: "agent", branchId: "b1" }, MANAGER_SCOPE, "http://localhost:5000");
    expect(vi.mocked(homeworkerService.invite).mock.calls.at(-1)?.[2]).toBe("http://localhost:5000");
    expect(vi.mocked(inviteService.send).mock.calls.at(-1)?.[2]).toBe("http://localhost:5000");
  });
});

describe("hrService.get - holidayUsedDays", () => {
  const baseRow = {
    userId: "u1", name: "Ann", email: "a@x", phone: null, orgRole: "agent", branchId: "b1", branchName: "North",
    branchOpeningPattern: "mon-fri", isActive: true, address: null, emergencyContactName: null,
    emergencyContactRelationship: null, emergencyContactPhone: null, hrId: "hr1", status: "Active",
    employmentType: "Full-time", startDate: null, probationEnd: null, managerUserId: null, managerName: null,
    salary: null, salaryCurrency: null, contractType: null, contractEndDate: null, holidayAllowance: 28, taxId: null,
  };
  const leave = (type: string, status: string, fromDate: string, toDate: string) => ({
    id: `${fromDate}-${type}`, hrRecordId: "hr1", type, status, fromDate, toDate, reason: null, decidedBy: null,
    decidedAt: null, createdAt: new Date(0), updatedAt: new Date(0),
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  async function usedDays(pattern: string | null): Promise<number> {
    const repo = hrRepository as unknown as Record<string, ReturnType<typeof vi.fn>>;
    repo.getOne = vi.fn().mockResolvedValue({ ...baseRow, branchOpeningPattern: pattern });
    repo.listDocumentsForRecord = vi.fn().mockResolvedValue([]);
    repo.listNotesForRecord = vi.fn().mockResolvedValue([]);
    repo.listLeavesForRecord = vi.fn().mockResolvedValue([
      leave("Annual", "Approved", "2026-10-19", "2026-10-25"), // Mon-Sun
      leave("Annual", "Approved", "2025-12-29", "2026-01-02"), // straddles the year start
      leave("Annual", "Pending", "2026-11-02", "2026-11-06"),
      leave("Sick", "Approved", "2026-03-02", "2026-03-06"),
    ]);
    const detail = await hrService.get("u1", ADMIN_SCOPE);
    return detail.holidayUsedDays;
  }

  it("counts working days of approved Annual leave in the current London year only", async () => {
    expect(await usedDays("mon-fri")).toBe(7); // 5 + Thu/Fri of 2026
  });

  it("uses the person's branch opening pattern, defaulting to Mon-Fri", async () => {
    expect(await usedDays("mon-sat")).toBe(8);
    expect(await usedDays(null)).toBe(7);
  });
});

describe("hrService.get - per-leave workingDays", () => {
  it("counts each leave's own working days by the branch pattern, not clipped to the year", async () => {
    const repo = hrRepository as unknown as Record<string, ReturnType<typeof vi.fn>>;
    repo.getOne = vi.fn().mockResolvedValue({
      userId: "u1", name: "Ann", email: "a@x", phone: null, orgRole: "agent", branchId: "b1", branchName: "North",
      branchOpeningPattern: "mon-fri", isActive: true, address: null, emergencyContactName: null,
      emergencyContactRelationship: null, emergencyContactPhone: null, hrId: "hr1", status: "Active",
      employmentType: "Full-time", startDate: null, probationEnd: null, managerUserId: null, managerName: null,
      salary: null, salaryCurrency: null, contractType: null, contractEndDate: null, holidayAllowance: 28, taxId: null,
    });
    repo.listDocumentsForRecord = vi.fn().mockResolvedValue([]);
    repo.listNotesForRecord = vi.fn().mockResolvedValue([]);
    repo.listLeavesForRecord = vi.fn().mockResolvedValue([
      { id: "l1", hrRecordId: "hr1", type: "Annual", status: "Approved", fromDate: "2025-12-29", toDate: "2026-01-02", reason: null, decidedBy: null, decidedAt: null, createdAt: new Date(0), updatedAt: new Date(0) },
      { id: "l2", hrRecordId: "hr1", type: "Sick", status: "Pending", fromDate: "2026-10-23", toDate: "2026-10-26", reason: null, decidedBy: null, decidedAt: null, createdAt: new Date(0), updatedAt: new Date(0) },
    ]);

    const detail = await hrService.get("u1", ADMIN_SCOPE);

    expect(detail.holidays.map((h) => h.workingDays)).toEqual([5, 2]); // Fri+Mon in the second
  });
});

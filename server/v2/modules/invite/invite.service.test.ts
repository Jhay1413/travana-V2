import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./invite.repository", () => ({
  inviteRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    findByToken: vi.fn(),
    findPendingByOrg: vi.fn(),
    findBranchMembershipForUser: vi.fn(),
    getOrgName: vi.fn(),
    createPendingUserWithBranchMembership: vi.fn(),
    updateUser: vi.fn(),
    finaliseAcceptedInvite: vi.fn(),
    deletePendingUser: vi.fn(),
    findOwnedHomeworkerBranch: vi.fn(),
    deletePendingUserWithBranch: vi.fn(),
  },
}));
vi.mock("../homeworker/homeworker.service", () => ({ homeworkerService: { invite: vi.fn() } }));
vi.mock("../organization/organization-seat.service", () => ({
  organizationSeatService: { assertSeatAvailable: vi.fn() },
}));
vi.mock("../organization/organization-audit.service", () => ({
  organizationAuditService: { record: vi.fn() },
}));
vi.mock("../branch/branch.repository", () => ({ branchRepository: { findById: vi.fn() } }));
vi.mock("../../utils/public-url", () => ({ getPublicBaseUrl: () => "http://localhost:5000" }));
vi.mock("../../../services/email-provider", () => ({ getEmailProvider: () => ({ send: vi.fn() }) }));

import { inviteService } from "./invite.service";
import { inviteRepository } from "./invite.repository";
import { homeworkerService } from "../homeworker/homeworker.service";
import { branchRepository } from "../branch/branch.repository";
import { organizationSeatService } from "../organization/organization-seat.service";
import { organizationAuditService } from "../organization/organization-audit.service";

// A branch manager actor bound to branch b1.
const MANAGER = { orgId: "o1", userId: "m1", orgRole: "branch_manager", branchId: "b1" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("inviteService.send — branch-manager guards", () => {
  it("blocks a branch manager from inviting into another branch", async () => {
    await expect(
      inviteService.send({ email: "x@y.com", branchId: "b2", orgRole: "agent" }, MANAGER),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("blocks a branch manager from inviting a non-downstream role", async () => {
    await expect(
      inviteService.send({ email: "x@y.com", branchId: "b1", orgRole: "branch_manager" }, MANAGER),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("blocks a branch manager with no branch context", async () => {
    await expect(
      inviteService.send({ email: "x@y.com", branchId: "b1", orgRole: "agent" }, { ...MANAGER, branchId: null }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("blocks a branch manager from inviting a homeworker (403) without delegating", async () => {
    await expect(
      inviteService.send({ email: "x@y.com", orgRole: "homeworker" }, MANAGER),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(homeworkerService.invite).not.toHaveBeenCalled();
  });

  it("rejects a role outside the allowed set", async () => {
    await expect(
      inviteService.send({ email: "x@y.com", branchId: "b1", orgRole: "org_admin" as never }, MANAGER),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("inviteService.send — homeworker delegation", () => {
  const ADMIN = { orgId: "o1", userId: "a1", orgRole: "org_admin", branchId: null };

  it("delegates a homeworker invite to the homeworker service (no branch lookup, no pending-user path)", async () => {
    vi.mocked(homeworkerService.invite).mockResolvedValue({ userId: "u9", branchId: "hb1", email: "x@y.com", expiresAt: new Date(0) });

    const result = await inviteService.send(
      { email: "x@y.com", orgRole: "homeworker", profitSharePercent: "40", displayName: "Jo" },
      ADMIN,
    );

    expect(homeworkerService.invite).toHaveBeenCalledWith({ email: "x@y.com", profitSharePercent: "40", displayName: "Jo" }, ADMIN, undefined);
    expect(inviteRepository.createPendingUserWithBranchMembership).not.toHaveBeenCalled();
    expect(result).toMatchObject({ userId: "u9", branchId: "hb1" });
  });
});

describe("inviteService.send — existing pending invite", () => {
  const ADMIN = { orgId: "o1", userId: "a1", orgRole: "org_admin", branchId: null };

  it("409s when the pending invite has a different role than the new request", async () => {
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(inviteRepository.findByEmail).mockResolvedValue({ id: "u5", orgId: "o1", inviteToken: "t", orgRole: "homeworker" } as never);

    await expect(
      inviteService.send({ email: "x@y.com", branchId: "b1", orgRole: "agent" }, ADMIN),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("inviteService.getByToken — token validity", () => {
  it("rejects an unknown or tokenless invite", async () => {
    vi.mocked(inviteRepository.findByToken).mockResolvedValue(undefined as never);

    await expect(inviteService.getByToken("nope")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an expired invite", async () => {
    vi.mocked(inviteRepository.findByToken).mockResolvedValue({
      inviteToken: "t",
      inviteTokenExpiry: new Date(Date.now() - 1000),
    } as never);

    await expect(inviteService.getByToken("t")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns invite details for a valid, unexpired token", async () => {
    vi.mocked(inviteRepository.findByToken).mockResolvedValue({
      email: "x@y.com",
      orgRole: "agent",
      inviteAgencyName: "Acme",
      inviteToken: "t",
      inviteTokenExpiry: new Date(Date.now() + 60_000),
    } as never);

    await expect(inviteService.getByToken("t")).resolves.toMatchObject({
      email: "x@y.com",
      orgRole: "agent",
      orgName: "Acme",
    });
  });
});

describe("inviteService.acceptInvite — payload validation", () => {
  const base = { token: "t", firstName: "Ada", lastName: "Lovelace", phoneNumber: "123", password: "supersecret" };

  it("rejects a password shorter than 8 characters", async () => {
    await expect(inviteService.acceptInvite({ ...base, password: "short" })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("rejects a missing first name", async () => {
    await expect(inviteService.acceptInvite({ ...base, firstName: "  " })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("inviteService.acceptInvite — homeworker branch rename", () => {
  it("passes the full name so the repository can rename the owned homeworker branch", async () => {
    vi.mocked(inviteRepository.findByToken).mockResolvedValue({
      id: "u1",
      orgId: "o1",
      email: "x@y.com",
      inviteToken: "t",
      inviteTokenExpiry: new Date(Date.now() + 60_000),
    } as never);

    await inviteService.acceptInvite({ token: "t", firstName: " Ada ", lastName: "Lovelace", phoneNumber: "1", password: "supersecret" });

    expect(inviteRepository.finaliseAcceptedInvite).toHaveBeenCalledWith(
      "u1",
      "o1",
      expect.objectContaining({ name: "Ada Lovelace", firstName: "Ada", lastName: "Lovelace" }),
    );
  });
});

describe("inviteService.revoke — homeworker branch cleanup", () => {
  const ADMIN = { orgId: "o1", userId: "a1", orgRole: "org_admin", branchId: null };

  it("deletes the empty homeworker branch together with the unaccepted user", async () => {
    vi.mocked(inviteRepository.findById).mockResolvedValue({ id: "u1", orgId: "o1", inviteToken: "t" } as never);
    vi.mocked(inviteRepository.findOwnedHomeworkerBranch).mockResolvedValue({ id: "hb1" });

    await inviteService.revoke("u1", ADMIN);

    expect(inviteRepository.deletePendingUserWithBranch).toHaveBeenCalledWith("u1", "o1", "hb1");
    expect(inviteRepository.deletePendingUser).not.toHaveBeenCalled();
  });

  it("only deletes the user when no homeworker branch is owned", async () => {
    vi.mocked(inviteRepository.findById).mockResolvedValue({ id: "u1", orgId: "o1", inviteToken: "t" } as never);
    vi.mocked(inviteRepository.findOwnedHomeworkerBranch).mockResolvedValue(null);

    await inviteService.revoke("u1", ADMIN);

    expect(inviteRepository.deletePendingUser).toHaveBeenCalledWith("u1", "o1");
    expect(inviteRepository.deletePendingUserWithBranch).not.toHaveBeenCalled();
  });

  it("leaves an accepted homeworker alone (archive is the path)", async () => {
    vi.mocked(inviteRepository.findById).mockResolvedValue({ id: "u1", orgId: "o1", inviteToken: null } as never);

    await expect(inviteService.revoke("u1", ADMIN)).rejects.toMatchObject({ statusCode: 400 });
    expect(inviteRepository.deletePendingUserWithBranch).not.toHaveBeenCalled();
  });
});

describe("inviteService.listByOrg / resend — branch managers", () => {
  it("hides homeworker invites (their branch is not the manager's) from a branch manager", async () => {
    vi.mocked(inviteRepository.findPendingByOrg).mockResolvedValue([
      { userId: "u1", branchId: "b1" },
      { userId: "u2", branchId: "hb1" },
    ] as never);

    const rows = await inviteService.listByOrg(MANAGER);

    expect(rows.map((r) => r.userId)).toEqual(["u1"]);
  });

  it("403s when a branch manager resends a homeworker invite", async () => {
    vi.mocked(inviteRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", inviteToken: "t", email: "h@y.com" } as never);
    vi.mocked(inviteRepository.findBranchMembershipForUser).mockResolvedValue({ branchId: "hb1", isActive: false });

    await expect(inviteService.resend("u2", MANAGER)).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("inviteService.revoke — guards", () => {
  it("throws 404 when the invite belongs to another org", async () => {
    vi.mocked(inviteRepository.findById).mockResolvedValue({ id: "u1", orgId: "other", inviteToken: "t" } as never);

    await expect(inviteService.revoke("u1", MANAGER)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("refuses to revoke an already-accepted member", async () => {
    vi.mocked(inviteRepository.findById).mockResolvedValue({ id: "u1", orgId: "o1", inviteToken: null } as never);

    await expect(inviteService.revoke("u1", MANAGER)).rejects.toMatchObject({ statusCode: 400 });
  });
});

// ---------------------------------------------------------------------------
// Seats, names and audit
// ---------------------------------------------------------------------------

describe("inviteService.send — seats, names and audit", () => {
  const REQUEST_ACTOR = { userId: "a1", ipAddress: "1.1.1.1", userAgent: "ua", impersonating: false };
  const ADMIN = { orgId: "o1", userId: "a1", orgRole: "org_admin", branchId: null, requestActor: REQUEST_ACTOR };
  const payload = { email: "New@Y.com", branchId: "b1", orgRole: "agent" as const };

  beforeEach(() => {
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(inviteRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(inviteRepository.getOrgName).mockResolvedValue("Acme");
    vi.mocked(inviteRepository.createPendingUserWithBranchMembership).mockImplementation(
      async (values) => ({ id: values.id }) as never,
    );
  });

  it("409s with the seat error BEFORE creating anything", async () => {
    vi.mocked(organizationSeatService.assertSeatAvailable).mockRejectedValueOnce(
      Object.assign(new Error("All 10 seats are in use"), { statusCode: 409 }),
    );

    await expect(inviteService.send(payload, ADMIN)).rejects.toMatchObject({ statusCode: 409 });
    expect(inviteRepository.createPendingUserWithBranchMembership).not.toHaveBeenCalled();
    expect(organizationAuditService.record).not.toHaveBeenCalled();
  });

  it("checks seats after the existing-user check, and skips referral partners", async () => {
    vi.mocked(inviteRepository.findByEmail).mockResolvedValue({ id: "x", inviteToken: null, orgId: "o1" } as never);
    await expect(inviteService.send(payload, ADMIN)).rejects.toMatchObject({ statusCode: 409 });
    expect(organizationSeatService.assertSeatAvailable).not.toHaveBeenCalled();

    vi.mocked(inviteRepository.findByEmail).mockResolvedValue(null);
    await inviteService.send({ ...payload, orgRole: "referral_agent" }, ADMIN);
    expect(organizationSeatService.assertSeatAvailable).not.toHaveBeenCalled();

    await inviteService.send(payload, ADMIN);
    expect(organizationSeatService.assertSeatAvailable).toHaveBeenCalledWith("o1");
  });

  it("does not seat-check a resend of an existing pending invite", async () => {
    vi.mocked(inviteRepository.findByEmail).mockResolvedValue({
      id: "u5", orgId: "o1", inviteToken: "t", orgRole: "agent", email: "new@y.com",
    } as never);
    vi.mocked(inviteRepository.findById).mockResolvedValue({ id: "u5", orgId: "o1", inviteToken: "t", email: "new@y.com" } as never);

    await inviteService.send(payload, ADMIN);

    expect(organizationSeatService.assertSeatAvailable).not.toHaveBeenCalled();
    expect(inviteRepository.createPendingUserWithBranchMembership).not.toHaveBeenCalled();
    expect(organizationAuditService.record).toHaveBeenCalledWith(expect.objectContaining({ action: "invite.resend" }));
  });

  it("stores the optional first and last name and uses them as the display name", async () => {
    await inviteService.send({ ...payload, firstName: " Ada ", lastName: "Lovelace" }, ADMIN);

    const values = vi.mocked(inviteRepository.createPendingUserWithBranchMembership).mock.calls[0][0];
    expect(values).toMatchObject({ firstName: "Ada", lastName: "Lovelace", name: "Ada Lovelace", email: "new@y.com" });
  });

  it("falls back to the email as the name and empty first/last name", async () => {
    await inviteService.send(payload, ADMIN);

    const values = vi.mocked(inviteRepository.createPendingUserWithBranchMembership).mock.calls[0][0];
    expect(values).toMatchObject({ firstName: "", lastName: "", name: "new@y.com" });
  });

  it("writes an invite.send audit row for the new user", async () => {
    await inviteService.send(payload, ADMIN);

    expect(organizationAuditService.record).toHaveBeenCalledWith({
      actor: REQUEST_ACTOR,
      action: "invite.send",
      orgId: "o1",
      targetUserId: expect.any(String),
      metadata: { email: "new@y.com", orgRole: "agent", branchId: "b1" },
    });
  });

  it("leaves the homeworker arm to the homeworker service (it checks seats and audits itself)", async () => {
    vi.mocked(homeworkerService.invite).mockResolvedValue({ userId: "u9", branchId: "hb1", email: "x@y.com", expiresAt: new Date(0) });

    await inviteService.send({ email: "x@y.com", orgRole: "homeworker" }, ADMIN);

    expect(organizationSeatService.assertSeatAvailable).not.toHaveBeenCalled();
    expect(organizationAuditService.record).not.toHaveBeenCalled();
  });
});

describe("inviteService resend / revoke audit", () => {
  const REQUEST_ACTOR = { userId: "a1", ipAddress: null, userAgent: null, impersonating: false };
  const ADMIN = { orgId: "o1", userId: "a1", orgRole: "org_admin", branchId: null, requestActor: REQUEST_ACTOR };

  it("audits a resend", async () => {
    vi.mocked(inviteRepository.findById).mockResolvedValue({ id: "u5", orgId: "o1", inviteToken: "t", email: "a@b.com" } as never);
    vi.mocked(inviteRepository.getOrgName).mockResolvedValue("Acme");

    await inviteService.resend("u5", ADMIN);

    expect(organizationAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "invite.resend", targetUserId: "u5", orgId: "o1" }),
    );
  });

  it("audits a revoke with the user id in metadata (the user row no longer exists)", async () => {
    vi.mocked(inviteRepository.findById).mockResolvedValue({ id: "u5", orgId: "o1", inviteToken: "t", email: "a@b.com" } as never);
    vi.mocked(inviteRepository.findOwnedHomeworkerBranch).mockResolvedValue(null);

    await inviteService.revoke("u5", ADMIN);

    expect(organizationAuditService.record).toHaveBeenCalledWith({
      actor: REQUEST_ACTOR, action: "invite.revoke", orgId: "o1", targetUserId: null,
      metadata: { revokedUserId: "u5", email: "a@b.com" },
    });
  });

  it("does not audit a failed revoke", async () => {
    vi.mocked(inviteRepository.findById).mockResolvedValue({ id: "u5", orgId: "o1", inviteToken: null } as never);
    await expect(inviteService.revoke("u5", ADMIN)).rejects.toMatchObject({ statusCode: 400 });
    expect(organizationAuditService.record).not.toHaveBeenCalled();
  });
});

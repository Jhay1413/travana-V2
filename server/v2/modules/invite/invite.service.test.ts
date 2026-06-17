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
  },
}));
vi.mock("../branch/branch.repository", () => ({ branchRepository: { findById: vi.fn() } }));
vi.mock("../../utils/public-url", () => ({ getPublicBaseUrl: () => "http://localhost:5000" }));
vi.mock("../../../services/email-provider", () => ({ getEmailProvider: () => ({ send: vi.fn() }) }));

import { inviteService } from "./invite.service";
import { inviteRepository } from "./invite.repository";

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

  it("rejects a role outside the allowed set", async () => {
    await expect(
      inviteService.send({ email: "x@y.com", branchId: "b1", orgRole: "org_admin" as never }, MANAGER),
    ).rejects.toMatchObject({ statusCode: 400 });
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

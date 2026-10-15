import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./homeworker.repository", () => ({
  homeworkerRepository: {
    findOrgDefaults: vi.fn(),
    findUserByEmail: vi.fn(),
    createHomeworkerAtomic: vi.fn(),
    listByOrg: vi.fn(),
    findHomeworkerBranch: vi.fn(),
    findByOwner: vi.fn(),
    update: vi.fn(),
    archiveAtomic: vi.fn(),
    countMembers: vi.fn(),
    hasPendingInvite: vi.fn(),
  },
}));
vi.mock("../invite/invite-email.service", () => ({
  newInviteCredentials: () => ({ token: "tok", expiry: new Date("2030-01-01T00:00:00Z") }),
  sendInviteEmail: vi.fn(),
}));

import { homeworkerService, deriveHomeworkerStatus } from "./homeworker.service";
import { homeworkerRepository } from "./homeworker.repository";
import { sendInviteEmail } from "../invite/invite-email.service";

const ADMIN = { orgId: "o1", userId: "admin1", orgRole: "org_admin", orgRoles: ["org_admin"] };

function mockCreate() {
  vi.mocked(homeworkerRepository.findUserByEmail).mockResolvedValue(null);
  vi.mocked(homeworkerRepository.createHomeworkerAtomic).mockImplementation(
    async (records) =>
      ({
        user: { id: records.userValues.id },
        branch: { id: "hb1" },
      }) as never,
  );
}

function createdRecords() {
  return vi.mocked(homeworkerRepository.createHomeworkerAtomic).mock.calls[0][0];
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("homeworkerService.invite", () => {
  it("composes the user and homeworker branch in one repository call, then emails the invite", async () => {
    vi.mocked(homeworkerRepository.findOrgDefaults).mockResolvedValue({ name: "Acme", homeworkerCommission: 40 });
    mockCreate();

    const result = await homeworkerService.invite(
      { email: " Jo.Bloggs@Example.com ", firstName: "Jo", lastName: "Bloggs", profitSharePercent: "55.5" },
      ADMIN,
    );

    expect(homeworkerRepository.createHomeworkerAtomic).toHaveBeenCalledOnce();
    const { userValues, branchValues } = createdRecords();
    expect(userValues).toMatchObject({
      email: "jo.bloggs@example.com",
      orgRole: "homeworker",
      orgId: "o1",
      emailVerified: false,
      inviteToken: "tok",
      invitedBy: "admin1",
      inviteAgencyName: "Acme",
    });
    expect(branchValues).toMatchObject({
      organizationId: "o1",
      branchType: "homeworker",
      isDefault: false,
      isActive: true,
      name: "jo.bloggs",
      profitSharePercent: "55.5",
      address: "",
      openingPattern: "mon-fri",
      openingHours: [],
    });
    expect(sendInviteEmail).toHaveBeenCalledWith("jo.bloggs@example.com", "Acme", "tok");
    expect(result).toEqual({
      userId: userValues.id,
      branchId: "hb1",
      email: "jo.bloggs@example.com",
      expiresAt: new Date("2030-01-01T00:00:00Z"),
    });
  });

  it("uses the body share when given (even 0)", async () => {
    vi.mocked(homeworkerRepository.findOrgDefaults).mockResolvedValue({ name: "Acme", homeworkerCommission: 40 });
    mockCreate();

    await homeworkerService.invite({ email: "a@b.com", profitSharePercent: 0 }, ADMIN);

    expect(createdRecords().branchValues.profitSharePercent).toBe("0");
  });

  it("falls back to the org default share when the body has none", async () => {
    vi.mocked(homeworkerRepository.findOrgDefaults).mockResolvedValue({ name: "Acme", homeworkerCommission: 40 });
    mockCreate();

    await homeworkerService.invite({ email: "a@b.com" }, ADMIN);

    expect(createdRecords().branchValues.profitSharePercent).toBe("40");
  });

  it("falls back to null when neither body nor org default exist", async () => {
    vi.mocked(homeworkerRepository.findOrgDefaults).mockResolvedValue({ name: "Acme", homeworkerCommission: null });
    mockCreate();

    await homeworkerService.invite({ email: "a@b.com" }, ADMIN);

    expect(createdRecords().branchValues.profitSharePercent).toBeNull();
  });

  it("names the branch from displayName, else the deterministic email placeholder", async () => {
    vi.mocked(homeworkerRepository.findOrgDefaults).mockResolvedValue({ name: "Acme", homeworkerCommission: null });
    mockCreate();

    await homeworkerService.invite({ email: "sam.smith@b.com", displayName: "Sam's Travel" }, ADMIN);
    expect(createdRecords().branchValues.name).toBe("Sam's Travel");

    vi.clearAllMocks();
    vi.mocked(homeworkerRepository.findOrgDefaults).mockResolvedValue({ name: "Acme", homeworkerCommission: null });
    mockCreate();
    await homeworkerService.invite({ email: "sam.smith@b.com" }, ADMIN);
    expect(createdRecords().branchValues.name).toBe("sam.smith");
  });

  it("rejects a non-admin with 403 before touching the database", async () => {
    await expect(
      homeworkerService.invite({ email: "a@b.com" }, { ...ADMIN, orgRole: "branch_manager", orgRoles: ["branch_manager"] }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(homeworkerRepository.createHomeworkerAtomic).not.toHaveBeenCalled();
  });

  it("allows a platform admin", async () => {
    vi.mocked(homeworkerRepository.findOrgDefaults).mockResolvedValue({ name: "Acme", homeworkerCommission: null });
    mockCreate();

    await homeworkerService.invite({ email: "a@b.com" }, { ...ADMIN, orgRole: "platform_admin", orgRoles: ["platform_admin"] });

    expect(homeworkerRepository.createHomeworkerAtomic).toHaveBeenCalled();
  });

  it("409s when the email belongs to an existing user", async () => {
    vi.mocked(homeworkerRepository.findUserByEmail).mockResolvedValue({ id: "x", orgId: "o1", inviteToken: null });

    await expect(homeworkerService.invite({ email: "a@b.com" }, ADMIN)).rejects.toMatchObject({ statusCode: 409 });
    expect(homeworkerRepository.createHomeworkerAtomic).not.toHaveBeenCalled();
  });

  it("409s when the email is already invited, here or in another org", async () => {
    vi.mocked(homeworkerRepository.findUserByEmail).mockResolvedValue({ id: "x", orgId: "other", inviteToken: "t" });
    await expect(homeworkerService.invite({ email: "a@b.com" }, ADMIN)).rejects.toMatchObject({ statusCode: 409 });

    vi.mocked(homeworkerRepository.findUserByEmail).mockResolvedValue({ id: "x", orgId: "o1", inviteToken: "t" });
    await expect(homeworkerService.invite({ email: "a@b.com" }, ADMIN)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("404s when the organisation is missing", async () => {
    vi.mocked(homeworkerRepository.findUserByEmail).mockResolvedValue(null);
    vi.mocked(homeworkerRepository.findOrgDefaults).mockResolvedValue(null);

    await expect(homeworkerService.invite({ email: "a@b.com" }, ADMIN)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("deriveHomeworkerStatus", () => {
  it("is archived whenever the branch is inactive", () => {
    expect(deriveHomeworkerStatus({ isActive: false, inviteToken: null, memberIsActive: false })).toBe("archived");
    expect(deriveHomeworkerStatus({ isActive: false, inviteToken: "t", memberIsActive: false })).toBe("archived");
  });

  it("is pending while the invite is unaccepted", () => {
    expect(deriveHomeworkerStatus({ isActive: true, inviteToken: "t", memberIsActive: false })).toBe("pending");
    expect(deriveHomeworkerStatus({ isActive: true, inviteToken: "t", memberIsActive: true })).toBe("pending");
  });

  it("is suspended when accepted but the membership is inactive", () => {
    expect(deriveHomeworkerStatus({ isActive: true, inviteToken: null, memberIsActive: false })).toBe("suspended");
    expect(deriveHomeworkerStatus({ isActive: true, inviteToken: null, memberIsActive: null })).toBe("suspended");
  });

  it("is active once accepted with an active membership", () => {
    expect(deriveHomeworkerStatus({ isActive: true, inviteToken: null, memberIsActive: true })).toBe("active");
  });
});

describe("homeworkerService.list", () => {
  it("maps rows to status + owner and never leaks the invite token", async () => {
    vi.mocked(homeworkerRepository.listByOrg).mockResolvedValue([
      { branchId: "b1", name: "Jo", isActive: true, profitSharePercent: "40.00", createdAt: new Date(0), ownerUserId: "u1", ownerName: "Jo B", ownerEmail: "jo@x.com", inviteToken: "secret", memberIsActive: false },
      { branchId: "b2", name: "Al", isActive: true, profitSharePercent: null, createdAt: new Date(0), ownerUserId: "u2", ownerName: "Al", ownerEmail: "al@x.com", inviteToken: null, memberIsActive: true },
      { branchId: "b3", name: "Old", isActive: false, profitSharePercent: "10", createdAt: new Date(0), ownerUserId: "u3", ownerName: "Old", ownerEmail: "o@x.com", inviteToken: null, memberIsActive: false },
    ]);

    const result = await homeworkerService.list("o1", true);

    expect(homeworkerRepository.listByOrg).toHaveBeenCalledWith("o1", true);
    expect(result.map((r) => r.status)).toEqual(["pending", "active", "archived"]);
    expect(result[0].owner).toEqual({ userId: "u1", name: "Jo B", email: "jo@x.com" });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});

describe("homeworkerService.getMine", () => {
  it("returns the caller's own homeworker branch and share", async () => {
    vi.mocked(homeworkerRepository.findByOwner).mockResolvedValue({ id: "hb1", name: "Jo", profitSharePercent: "40.00", isActive: true } as never);

    await expect(homeworkerService.getMine("o1", "u1")).resolves.toEqual({
      branchId: "hb1",
      name: "Jo",
      profitSharePercent: "40.00",
      isActive: true,
    });
  });

  it("404s for a legacy shared-branch homeworker with no owned branch", async () => {
    vi.mocked(homeworkerRepository.findByOwner).mockResolvedValue(null);

    await expect(homeworkerService.getMine("o1", "u1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("404s when there is no user id", async () => {
    await expect(homeworkerService.getMine("o1", null)).rejects.toMatchObject({ statusCode: 404 });
    expect(homeworkerRepository.findByOwner).not.toHaveBeenCalled();
  });
});

describe("homeworkerService.update", () => {
  it("404s when the branch is not a homeworker branch of this org", async () => {
    vi.mocked(homeworkerRepository.findHomeworkerBranch).mockResolvedValue(null);

    await expect(homeworkerService.update("b1", "o1", { name: "X" })).rejects.toMatchObject({ statusCode: 404 });
    expect(homeworkerRepository.update).not.toHaveBeenCalled();
  });

  it("updates name and share, normalising the share to a string", async () => {
    vi.mocked(homeworkerRepository.findHomeworkerBranch).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(homeworkerRepository.update).mockResolvedValue({ id: "b1" } as never);

    await homeworkerService.update("b1", "o1", { name: "  New  ", profitSharePercent: 45 });

    expect(homeworkerRepository.update).toHaveBeenCalledWith("b1", "o1", { name: "New", profitSharePercent: "45" });
  });

  it("400s when nothing is provided", async () => {
    vi.mocked(homeworkerRepository.findHomeworkerBranch).mockResolvedValue({ id: "b1" } as never);

    await expect(homeworkerService.update("b1", "o1", {})).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("homeworkerService.archive", () => {
  it("404s when the branch is not a homeworker branch of this org", async () => {
    vi.mocked(homeworkerRepository.findHomeworkerBranch).mockResolvedValue(null);

    await expect(homeworkerService.archive("b1", "o1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("409s when already archived", async () => {
    vi.mocked(homeworkerRepository.findHomeworkerBranch).mockResolvedValue({ id: "b1", isActive: false } as never);

    await expect(homeworkerService.archive("b1", "o1")).rejects.toMatchObject({ statusCode: 409 });
    expect(homeworkerRepository.archiveAtomic).not.toHaveBeenCalled();
  });

  it("refuses to archive while the invite is still pending (400, revoke instead)", async () => {
    vi.mocked(homeworkerRepository.findHomeworkerBranch).mockResolvedValue({ id: "b1", isActive: true, ownerUserId: "hw1" } as never);
    vi.mocked(homeworkerRepository.hasPendingInvite).mockResolvedValue(true);

    await expect(homeworkerService.archive("b1", "o1")).rejects.toMatchObject({
      statusCode: 400,
      message: "Revoke the invite instead",
    });
    expect(homeworkerRepository.archiveAtomic).not.toHaveBeenCalled();
  });

  it("archives branch and suspends the owner atomically without deleting anything", async () => {
    vi.mocked(homeworkerRepository.findHomeworkerBranch).mockResolvedValue({ id: "b1", isActive: true, ownerUserId: "hw1" } as never);
    vi.mocked(homeworkerRepository.hasPendingInvite).mockResolvedValue(false);
    vi.mocked(homeworkerRepository.archiveAtomic).mockResolvedValue({ id: "b1", isActive: false } as never);

    await homeworkerService.archive("b1", "o1");

    expect(homeworkerRepository.archiveAtomic).toHaveBeenCalledWith("b1", "o1");
  });
});

describe("homeworkerService.assertNotArchived", () => {
  it("throws 400 when the user owns an archived homeworker branch", async () => {
    vi.mocked(homeworkerRepository.findByOwner).mockResolvedValue({ id: "b1", isActive: false } as never);

    await expect(homeworkerService.assertNotArchived("o1", "hw1")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("passes for an active homeworker branch or no owned branch", async () => {
    vi.mocked(homeworkerRepository.findByOwner).mockResolvedValueOnce({ id: "b1", isActive: true } as never);
    await expect(homeworkerService.assertNotArchived("o1", "hw1")).resolves.toBeUndefined();

    vi.mocked(homeworkerRepository.findByOwner).mockResolvedValueOnce(null);
    await expect(homeworkerService.assertNotArchived("o1", "u2")).resolves.toBeUndefined();
  });
});

describe("homeworkerService.assertCanAddMember", () => {
  it("is a no-op for a branch that is not a per-user homeworker branch", async () => {
    vi.mocked(homeworkerRepository.findHomeworkerBranch).mockResolvedValue(null);

    await expect(homeworkerService.assertCanAddMember("b1", "o1")).resolves.toBeUndefined();
    expect(homeworkerRepository.countMembers).not.toHaveBeenCalled();
  });

  it("throws 400 when the homeworker branch already has a member", async () => {
    vi.mocked(homeworkerRepository.findHomeworkerBranch).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(homeworkerRepository.countMembers).mockResolvedValue(1);

    await expect(homeworkerService.assertCanAddMember("b1", "o1")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("allows an empty homeworker branch", async () => {
    vi.mocked(homeworkerRepository.findHomeworkerBranch).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(homeworkerRepository.countMembers).mockResolvedValue(0);

    await expect(homeworkerService.assertCanAddMember("b1", "o1")).resolves.toBeUndefined();
  });
});

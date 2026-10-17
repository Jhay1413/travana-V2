import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./user.repository", () => ({
  userRepository: {
    findById: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    createHrRecord: vi.fn(),
  },
}));
// user.service imports the live db client only for createUser's HR-record insert.
vi.mock("../../config/database", () => ({ db: {} }));

import { userService } from "./user.service";
import { userRepository } from "./user.repository";

const ORG_SCOPE = { orgId: "o1", orgRole: "agent" } as never;
const ADMIN_SCOPE = { orgId: "o1", orgRole: "platform_admin" } as never;

// Self-edit scope: the caller (u2) is acting on their own record.
const SELF_SCOPE = { orgId: "o1", orgRole: "agent", orgRoles: ["agent"], userId: "u2" } as never;
// Genuine platform_admin scope — orgRoles is what permission checks (hasAnyRole)
// key off, matching how the rest of the codebase authorises admin-only actions.
const PLATFORM_ADMIN_SCOPE = { orgId: "o1", orgRole: "platform_admin", orgRoles: ["platform_admin"], userId: "admin1" } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("userService.createUser - homeworker", () => {
  it("rejects orgRole homeworker with 400 (use POST /homeworkers) before touching the repository", async () => {
    await expect(
      userService.createUser({ email: "a@b.com", orgRole: "homeworker" } as never, ORG_SCOPE),
    ).rejects.toMatchObject({ statusCode: 400, message: "Use POST /homeworkers" });
    expect(userRepository.create).not.toHaveBeenCalled();
  });
});

describe("userService.getUserById — tenant isolation", () => {
  it("returns 404 when the user belongs to another org", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "other" } as never);

    await expect(userService.getUserById("u2", ORG_SCOPE)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("returns the user when they are in the caller's org", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1" } as never);

    await expect(userService.getUserById("u2", ORG_SCOPE)).resolves.toMatchObject({ id: "u2" });
  });

  it("lets a platform_admin read a user from any org", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "other" } as never);

    await expect(userService.getUserById("u2", ADMIN_SCOPE)).resolves.toMatchObject({ id: "u2" });
  });

  it("returns 404 when the user does not exist at all", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(undefined as never);

    await expect(userService.getUserById("missing", ORG_SCOPE)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("userService.updateUser — org pinning", () => {
  it("forces the caller's orgId onto the update, ignoring an injected orgId", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1" } as never);
    vi.mocked(userRepository.update).mockResolvedValue({ id: "u2", orgId: "o1" } as never);

    await userService.updateUser("u2", { orgId: "attacker-org", firstName: "Ada" } as never, SELF_SCOPE);

    expect(vi.mocked(userRepository.update).mock.calls[0][1]).toMatchObject({ orgId: "o1", firstName: "Ada" });
  });
});

describe("userService.updateUser — privilege escalation guard", () => {
  it("refuses to let a non-privileged user set role on themselves", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1" } as never);

    await expect(
      userService.updateUser("u2", { role: "platform_admin" } as never, SELF_SCOPE),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it("refuses to let a non-privileged user set role on someone else in their org", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u3", orgId: "o1" } as never);

    await expect(
      userService.updateUser("u3", { role: "admin" } as never, SELF_SCOPE),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it("lets a platform_admin caller set role", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u3", orgId: "o1" } as never);
    vi.mocked(userRepository.update).mockResolvedValue({ id: "u3", orgId: "o1", role: "org_admin" } as never);

    await expect(
      userService.updateUser("u3", { role: "org_admin" } as never, PLATFORM_ADMIN_SCOPE),
    ).resolves.toMatchObject({ id: "u3" });

    expect(vi.mocked(userRepository.update).mock.calls[0][1]).toMatchObject({ role: "org_admin" });
  });

  it("still allows self-editable profile fields for an ordinary user", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1" } as never);
    vi.mocked(userRepository.update).mockResolvedValue({ id: "u2", orgId: "o1", firstName: "Ada" } as never);

    await userService.updateUser(
      "u2",
      { firstName: "Ada", lastName: "Lovelace", phoneNumber: "07000000000", image: "http://x/y.png" } as never,
      SELF_SCOPE,
    );

    expect(vi.mocked(userRepository.update).mock.calls[0][1]).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      phoneNumber: "07000000000",
      image: "http://x/y.png",
    });
  });

  it("silently drops non-self-serviceable fields (that aren't privileged) on a self-edit", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1" } as never);
    vi.mocked(userRepository.update).mockResolvedValue({ id: "u2", orgId: "o1" } as never);

    await userService.updateUser(
      "u2",
      { firstName: "Ada", orgName: "Attacker Corp", percentageCommission: 100 } as never,
      SELF_SCOPE,
    );

    const persisted = vi.mocked(userRepository.update).mock.calls[0][1];
    expect(persisted).toMatchObject({ firstName: "Ada" });
    expect(persisted).not.toHaveProperty("orgName");
    expect(persisted).not.toHaveProperty("percentageCommission");
  });

  it("always strips id from the update payload, even for a platform_admin", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u3", orgId: "o1" } as never);
    vi.mocked(userRepository.update).mockResolvedValue({ id: "u3", orgId: "o1" } as never);

    await userService.updateUser("u3", { id: "victim-id", firstName: "Ada" } as never, PLATFORM_ADMIN_SCOPE);

    expect(vi.mocked(userRepository.update).mock.calls[0][1]).not.toHaveProperty("id");
  });
});

describe("userService.updateUser — self or platform admin only", () => {
  it("refuses an org admin editing another member (403)", async () => {
    const orgAdminScope = { orgId: "o1", orgRole: "org_admin", orgRoles: ["org_admin"], userId: "admin2" } as never;
    await expect(
      userService.updateUser("u3", { firstName: "Mallory" } as never, orgAdminScope),
    ).rejects.toMatchObject({ statusCode: 403, message: "You can only edit your own profile" });
    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it("refuses a caller with no user id (403)", async () => {
    await expect(
      userService.updateUser("u3", { firstName: "X" } as never, ORG_SCOPE),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("lets a platform admin edit another user's profile fields", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u3", orgId: "o1" } as never);
    vi.mocked(userRepository.update).mockResolvedValue({ id: "u3", orgId: "o1" } as never);
    await expect(
      userService.updateUser("u3", { firstName: "Ada" } as never, PLATFORM_ADMIN_SCOPE),
    ).resolves.toMatchObject({ id: "u3" });
  });
});

describe("userService.deleteUser — never hard-deletes", () => {
  it("answers 409 for a user in the caller's org and does not delete", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1" } as never);
    await expect(userService.deleteUser("u2", ORG_SCOPE)).rejects.toMatchObject({
      statusCode: 409,
      message: "Users can't be deleted. Remove them from Teams & Roles instead; their history is kept.",
    });
    expect(userRepository.remove).not.toHaveBeenCalled();
  });

  it("answers 409 for a platform admin too", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1" } as never);
    await expect(userService.deleteUser("u2", PLATFORM_ADMIN_SCOPE)).rejects.toMatchObject({ statusCode: 409 });
    expect(userRepository.remove).not.toHaveBeenCalled();
  });
});

describe("userService.deleteUser — tenant isolation", () => {
  it("refuses to delete a user from another org", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "other" } as never);

    await expect(userService.deleteUser("u2", ORG_SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(userRepository.remove).not.toHaveBeenCalled();
  });
});

describe("userService.createUser - privileged fields", () => {
  it.each(["role", "orgRole", "password", "banned", "emailVerified", "inviteToken", "id"])(
    "refuses %s with 403 before touching the repository",
    async (field) => {
      await expect(
        userService.createUser({ email: "a@b.com", firstName: "A", lastName: "B", [field]: "x" } as never, PLATFORM_ADMIN_SCOPE),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(userRepository.create).not.toHaveBeenCalled();
    },
  );

  it("creates a plain Agent login with a generated id and display name", async () => {
    vi.mocked(userRepository.create).mockResolvedValue({ id: "x", orgId: null } as never);
    await userService.createUser({ email: "a@b.com", firstName: "Ada", lastName: "L", phoneNumber: "" } as never, PLATFORM_ADMIN_SCOPE);
    const data = vi.mocked(userRepository.create).mock.calls[0][0];
    expect(data).toMatchObject({ role: "Agent", name: "Ada L", email: "a@b.com" });
    expect(typeof data.id).toBe("string");
  });

  it("creates the HR record through the repository when the user has an org", async () => {
    vi.mocked(userRepository.create).mockResolvedValue({ id: "x", orgId: "o1" } as never);
    await userService.createUser({ email: "a@b.com", firstName: "A", lastName: "B", phoneNumber: "" } as never, PLATFORM_ADMIN_SCOPE);
    expect(userRepository.createHrRecord).toHaveBeenCalledWith("o1", "x");
  });
});

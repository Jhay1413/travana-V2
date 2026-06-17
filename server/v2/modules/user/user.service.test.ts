import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./user.repository", () => ({
  userRepository: {
    findById: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));
// user.service imports the live db client only for createUser's HR-record insert.
vi.mock("../../config/database", () => ({ db: {} }));

import { userService } from "./user.service";
import { userRepository } from "./user.repository";

const ORG_SCOPE = { orgId: "o1", orgRole: "agent" } as never;
const ADMIN_SCOPE = { orgId: "o1", orgRole: "platform_admin" } as never;

beforeEach(() => {
  vi.clearAllMocks();
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

    await userService.updateUser("u2", { orgId: "attacker-org", firstName: "Ada" } as never, ORG_SCOPE);

    expect(vi.mocked(userRepository.update).mock.calls[0][1]).toMatchObject({ orgId: "o1", firstName: "Ada" });
  });
});

describe("userService.deleteUser — tenant isolation", () => {
  it("refuses to delete a user from another org", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "other" } as never);

    await expect(userService.deleteUser("u2", ORG_SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(userRepository.remove).not.toHaveBeenCalled();
  });
});

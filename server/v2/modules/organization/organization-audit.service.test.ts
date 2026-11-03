import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../platform-admin/platform-admin-audit.repository", () => ({
  platformAdminAuditRepository: { create: vi.fn() },
}));

import { organizationAuditService } from "./organization-audit.service";
import { platformAdminAuditRepository } from "../platform-admin/platform-admin-audit.repository";

const actor = { userId: "a1", ipAddress: "9.9.9.9", userAgent: "ua", impersonating: false };

beforeEach(() => vi.clearAllMocks());

describe("organizationAuditService.record", () => {
  it("writes an admin_audit_log row with actor, org, target, ip and user agent", async () => {
    await organizationAuditService.record({
      actor, action: "member.suspend", orgId: "o1", targetUserId: "u2", metadata: { notified: true },
    });

    expect(platformAdminAuditRepository.create).toHaveBeenCalledWith({
      actorUserId: "a1", action: "member.suspend", targetOrgId: "o1", targetUserId: "u2",
      metadata: { notified: true }, ipAddress: "9.9.9.9", userAgent: "ua",
    });
  });

  it("flags impersonation in the metadata", async () => {
    await organizationAuditService.record({
      actor: { ...actor, impersonating: true }, action: "member.remove", orgId: "o1",
    });

    expect(vi.mocked(platformAdminAuditRepository.create).mock.calls[0][0]).toMatchObject({
      targetUserId: null, metadata: { impersonating: true },
    });
  });

  it("swallows a failed audit write: the action is already committed", async () => {
    vi.mocked(platformAdminAuditRepository.create).mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      organizationAuditService.record({ actor, action: "invite.send", orgId: "o1" }),
    ).resolves.toBeUndefined();

    spy.mockRestore();
  });
});

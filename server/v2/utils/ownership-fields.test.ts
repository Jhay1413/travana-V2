import { describe, it, expect, vi } from "vitest";
import { stripOwnershipFields } from "./ownership-fields";
import type { Scope } from "./scope";

const AGENT: Scope = { orgId: "o1", branchId: "b1", orgRole: "agent", orgRoles: ["agent"], userId: "u1", branchType: "shop", ownsHomeworkerBranch: false };
const ADMIN: Scope = { ...AGENT, orgRole: "org_admin", orgRoles: ["org_admin"] };
const BODY = { firstName: "Ada", orgId: "evil", branchId: "bX", createdBy: "evil-user" };

describe("stripOwnershipFields", () => {
  it("drops orgId, branchId and createdBy for non-admins without touching the branch lookup", async () => {
    const exists = vi.fn();
    const out = await stripOwnershipFields(BODY, AGENT, exists);
    expect(out).toEqual({ firstName: "Ada" });
    expect(exists).not.toHaveBeenCalled();
  });

  it("drops orgId and createdBy for an admin but keeps a branch of their org", async () => {
    const exists = vi.fn().mockResolvedValue(true);
    const out = await stripOwnershipFields(BODY, ADMIN, exists);
    expect(out).toEqual({ firstName: "Ada", branchId: "bX" });
    expect(exists).toHaveBeenCalledWith("bX", "o1");
  });

  it("rejects an admin's branch outside their org with 400", async () => {
    await expect(stripOwnershipFields(BODY, ADMIN, vi.fn().mockResolvedValue(false))).rejects.toMatchObject({ statusCode: 400 });
  });

  it("drops branchId for a platform_admin with no org context", async () => {
    const out = await stripOwnershipFields(BODY, { ...ADMIN, orgId: "", orgRole: "platform_admin", orgRoles: ["platform_admin"] }, vi.fn());
    expect(out).toEqual({ firstName: "Ada" });
  });
});

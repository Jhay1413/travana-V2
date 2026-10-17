import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../quote/quote-public.repository", () => ({
  quotePublicRepository: { getOwnerByQuoteId: vi.fn() },
}));

import { quoteShareService } from "./quote-share.service";
import { quotePublicRepository } from "../quote/quote-public.repository";
import type { Scope } from "../../utils/scope";

const scope = (over: Partial<Scope>): Scope => ({
  orgId: "o1", branchId: null, orgRole: "agent", orgRoles: ["agent"], userId: "u1",
  branchType: null, ownsHomeworkerBranch: false, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(quotePublicRepository.getOwnerByQuoteId).mockResolvedValue({ userId: "owner", orgId: "o1" });
});

describe("quoteShareService.verifyAccess", () => {
  it("404s for a quote that does not exist", async () => {
    vi.mocked(quotePublicRepository.getOwnerByQuoteId).mockResolvedValue(null);
    await expect(quoteShareService.verifyAccess("q1", "u1", scope({}))).rejects.toMatchObject({ statusCode: 404 });
  });

  it("404s (not 403) for a quote in another org, whatever the caller's role", async () => {
    vi.mocked(quotePublicRepository.getOwnerByQuoteId).mockResolvedValue({ userId: "owner", orgId: "other" });
    for (const roles of [["org_admin"], ["agent"], ["branch_manager"]] as const) {
      await expect(
        quoteShareService.verifyAccess("q1", "u1", scope({ orgRole: roles[0], orgRoles: [...roles] })),
      ).rejects.toMatchObject({ statusCode: 404 });
    }
  });

  it("404s a caller with no org context and a quote with no org", async () => {
    await expect(quoteShareService.verifyAccess("q1", "u1", scope({ orgId: "" }))).rejects.toMatchObject({ statusCode: 404 });
    vi.mocked(quotePublicRepository.getOwnerByQuoteId).mockResolvedValue({ userId: "owner", orgId: null });
    await expect(quoteShareService.verifyAccess("q1", "u1", scope({}))).rejects.toMatchObject({ statusCode: 404 });
  });

  it("lets a platform admin through across orgs", async () => {
    vi.mocked(quotePublicRepository.getOwnerByQuoteId).mockResolvedValue({ userId: "owner", orgId: "other" });
    await expect(
      quoteShareService.verifyAccess("q1", "pa", scope({ orgId: "", orgRole: "platform_admin", orgRoles: ["platform_admin"] })),
    ).resolves.toBeUndefined();
  });

  it("lets the owner, and org roles that work deals, through inside the org", async () => {
    await expect(quoteShareService.verifyAccess("q1", "owner", scope({ orgRoles: ["social_media_manager"], orgRole: "social_media_manager" }))).resolves.toBeUndefined();
    for (const role of ["org_admin", "branch_manager", "agent", "homeworker"] as const) {
      await expect(quoteShareService.verifyAccess("q1", "u1", scope({ orgRole: role, orgRoles: [role] }))).resolves.toBeUndefined();
    }
  });

  it("403s a same-org user whose roles do not work deals and who is not the owner", async () => {
    await expect(
      quoteShareService.verifyAccess("q1", "u1", scope({ orgRole: "referral_agent", orgRoles: ["referral_agent"] })),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("bases the decision on scope roles, not a legacy user.role string", async () => {
    // A user whose legacy role would have read as 'admin' but who holds only a non-deal role here.
    await expect(
      quoteShareService.verifyAccess("q1", "u1", scope({ orgRole: "social_media_manager", orgRoles: ["social_media_manager"] })),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

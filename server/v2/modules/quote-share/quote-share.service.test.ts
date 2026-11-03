import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../quote/quote-public.repository", () => ({
  quotePublicRepository: { getOwnerByQuoteId: vi.fn(), getClientQuoteViews: vi.fn() },
}));

vi.mock("../quote/quote-access", () => ({
  assertQuoteReadable: vi.fn(),
  assertQuoteWritable: vi.fn(),
}));

vi.mock("./quote-share.repository", () => ({
  quoteShareRepository: { updateSentInfo: vi.fn() },
}));

import { quoteShareService } from "./quote-share.service";
import { quotePublicRepository } from "../quote/quote-public.repository";
import { quoteShareRepository } from "./quote-share.repository";
import { assertQuoteReadable, assertQuoteWritable } from "../quote/quote-access";
import { AppError } from "../../utils/error-handler";
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

  it("lets a social_media_manager READ deals it does not own but not write to them", async () => {
    const smm = scope({ orgRole: "social_media_manager", orgRoles: ["social_media_manager"] });
    await expect(quoteShareService.verifyAccess("q1", "u1", smm, "read")).resolves.toBeUndefined();
    await expect(quoteShareService.verifyAccess("q1", "u1", smm, "write")).rejects.toMatchObject({ statusCode: 403 });
    await expect(quoteShareService.verifyAccess("q1", "u1", smm)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("still 404s a social_media_manager read of another org's quote", async () => {
    vi.mocked(quotePublicRepository.getOwnerByQuoteId).mockResolvedValue({ userId: "owner", orgId: "other" });
    const smm = scope({ orgRole: "social_media_manager", orgRoles: ["social_media_manager"] });
    await expect(quoteShareService.verifyAccess("q1", "u1", smm, "read")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("keeps non-deal roles such as referral_agent out of reads too", async () => {
    await expect(
      quoteShareService.verifyAccess("q1", "u1", scope({ orgRole: "referral_agent", orgRoles: ["referral_agent"] }), "read"),
    ).rejects.toMatchObject({ statusCode: 403 });
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

describe("quoteShareService.verifyAccess deal scope (B2)", () => {
  const agent = scope({ branchId: "shop1" });

  it("write mode (generate-token, send-whatsapp, sent) goes through the shop-pinned write check, read mode through the read check", async () => {
    await quoteShareService.verifyAccess("q1", "u1", agent, "write");
    expect(assertQuoteWritable).toHaveBeenCalledWith("q1", agent);
    expect(assertQuoteReadable).not.toHaveBeenCalled();

    vi.clearAllMocks();
    vi.mocked(quotePublicRepository.getOwnerByQuoteId).mockResolvedValue({ userId: "owner", orgId: "o1" });
    await quoteShareService.verifyAccess("q1", "u1", agent, "read");
    expect(assertQuoteReadable).toHaveBeenCalledWith("q1", agent);
    expect(assertQuoteWritable).not.toHaveBeenCalled();
  });

  it("refuses another shop's quote on write with 403 and a no-shop / foreign deal with 404, even for the owner", async () => {
    vi.mocked(assertQuoteWritable).mockRejectedValueOnce(new AppError("This deal belongs to another shop", 403));
    await expect(quoteShareService.verifyAccess("q1", "owner", agent, "write")).rejects.toMatchObject({ statusCode: 403 });
    vi.mocked(assertQuoteWritable).mockRejectedValueOnce(new AppError("Quote not found", 404));
    await expect(quoteShareService.verifyAccess("q1", "owner", scope({ branchId: null }), "write")).rejects.toMatchObject({ statusCode: 404 });
    vi.mocked(assertQuoteReadable).mockRejectedValueOnce(new AppError("Quote not found", 404));
    await expect(quoteShareService.verifyAccess("q1", "u1", scope({ branchId: null }), "read")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("quoteShareService.getClientQuoteViews", () => {
  it("hands the caller's full scope to the repository so the views are pinned like the client page deals", async () => {
    vi.mocked(quotePublicRepository.getClientQuoteViews).mockResolvedValue([]);
    const s = scope({ branchId: "shop1" });
    await quoteShareService.getClientQuoteViews("c1", s);
    expect(quotePublicRepository.getClientQuoteViews).toHaveBeenCalledWith("c1", s);
  });
});

describe("quoteShareService.updateSentInfo", () => {
  it("records the channel through the quote-share repository", async () => {
    await quoteShareService.updateSentInfo("q1", "sms");
    expect(quoteShareRepository.updateSentInfo).toHaveBeenCalledWith("q1", "sms");
  });
});

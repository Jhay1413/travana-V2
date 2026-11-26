import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./portal.repository", () => ({
  portalRepository: {
    findClientOrg: vi.fn(),
    findActiveOrgIdBySlug: vi.fn(),
    findDeals: vi.fn(),
    findForYouDeals: vi.fn(),
    findDealFilters: vi.fn(),
    findClientTagIds: vi.fn(),
    findTagsForQuotes: vi.fn(),
    findImagesForQuotes: vi.fn(),
  },
}));

import { portalDealsService, PORTAL_DEAL_WINDOW_DAYS } from "./portal-deals.service";
import { portalRepository } from "./portal.repository";
import { signPortalToken } from "./portal-auth";

const repo = vi.mocked(portalRepository);
const bearer = (clientId: string) => `Bearer ${signPortalToken({ clientId, email: "" })}`;

const dealRow = {
  id: "q1", token: "tok", title: null, salesPrice: "499.50", travelDate: "2026-12-01", numNights: 7,
  accommodationName: "Hotel", destinationName: "Rome", countryName: "Italy", portalAddedAt: new Date("2026-11-20T10:00:00Z"),
};

const base = { recent: false, interests: false } as const;

beforeEach(() => {
  vi.clearAllMocks();
  repo.findDeals.mockResolvedValue([dealRow]);
  repo.findForYouDeals.mockResolvedValue([dealRow]);
  repo.findTagsForQuotes.mockResolvedValue([{ quoteId: "q1", tagName: "Beach" }]);
  repo.findImagesForQuotes.mockResolvedValue([{ quoteId: "q1", url: "http://img", isPrimary: true }]);
  repo.findClientTagIds.mockResolvedValue([]);
});

describe("listDeals org scoping", () => {
  it("scopes a signed-in client's deals to their own agency", async () => {
    repo.findClientOrg.mockResolvedValue({ orgId: "org-a" });
    const deals = await portalDealsService.listDeals({ ...base, authorizationHeader: bearer("c1") });
    expect(repo.findDeals).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-a" }));
    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({
      id: "q1", title: "Rome Getaway", price: 499.5,
      destination: "Rome, Italy", tags: ["Beach"], image_url: "http://img", quote_url: "/portal/quote/tok",
      portal_added_at: "2026-11-20T10:00:00.000Z",
    });
  });

  it("a session beats an org slug: the slug cannot widen the client's agency", async () => {
    repo.findClientOrg.mockResolvedValue({ orgId: "org-a" });
    await portalDealsService.listDeals({ ...base, authorizationHeader: bearer("c1"), orgSlug: "agency-b" });
    expect(repo.findActiveOrgIdBySlug).not.toHaveBeenCalled();
    expect(repo.findDeals).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-a" }));
  });

  it("returns nothing (and never queries deals) for a client whose orgId is null, even with a slug", async () => {
    repo.findClientOrg.mockResolvedValue({ orgId: null });
    const deals = await portalDealsService.listDeals({ ...base, authorizationHeader: bearer("c1"), orgSlug: "agency-b" });
    expect(deals).toEqual([]);
    expect(repo.findDeals).not.toHaveBeenCalled();
  });

  it("returns nothing for a soft-deleted client holding a still-valid token", async () => {
    repo.findClientOrg.mockResolvedValue(undefined);
    expect(await portalDealsService.listDeals({ ...base, authorizationHeader: bearer("gone") })).toEqual([]);
    expect(repo.findDeals).not.toHaveBeenCalled();
  });

  it("without a session, an active org slug scopes the list", async () => {
    repo.findActiveOrgIdBySlug.mockResolvedValue("org-b");
    await portalDealsService.listDeals({ ...base, authorizationHeader: undefined, orgSlug: " Agency-B " });
    expect(repo.findActiveOrgIdBySlug).toHaveBeenCalledWith("agency-b");
    expect(repo.findDeals).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-b" }));
  });

  it("no session and no slug returns an empty list, never every agency's deals", async () => {
    expect(await portalDealsService.listDeals({ ...base, authorizationHeader: undefined })).toEqual([]);
    expect(repo.findDeals).not.toHaveBeenCalled();
  });

  it("an invalid token with no slug is treated as no session (empty)", async () => {
    expect(await portalDealsService.listDeals({ ...base, authorizationHeader: "Bearer junk" })).toEqual([]);
    expect(repo.findDeals).not.toHaveBeenCalled();
  });

  it("with a session, a junk org is ignored (no error, no lookup, session agency used)", async () => {
    repo.findClientOrg.mockResolvedValue({ orgId: "org-a" });
    const deals = await portalDealsService.listDeals({ ...base, authorizationHeader: bearer("c1"), orgSlug: "not a slug!!" });
    expect(deals).toHaveLength(1);
    expect(repo.findActiveOrgIdBySlug).not.toHaveBeenCalled();
    expect(repo.findDeals).toHaveBeenCalledWith(expect.objectContaining({ orgId: "org-a" }));
  });

  it("without a session, a junk org returns an empty list without a lookup", async () => {
    expect(await portalDealsService.listDeals({ ...base, authorizationHeader: undefined, orgSlug: "../x" })).toEqual([]);
    expect(repo.findActiveOrgIdBySlug).not.toHaveBeenCalled();
  });

  it("an unknown slug returns an empty list", async () => {
    repo.findActiveOrgIdBySlug.mockResolvedValue(null);
    expect(await portalDealsService.listDeals({ ...base, authorizationHeader: undefined, orgSlug: "nope" })).toEqual([]);
    expect(repo.findDeals).not.toHaveBeenCalled();
  });

  it("applies the recency window and passes filters through", async () => {
    repo.findClientOrg.mockResolvedValue({ orgId: "org-a" });
    await portalDealsService.listDeals({
      recent: true, interests: false, country: "Italy", tag: "Beach", authorizationHeader: bearer("c1"),
    });
    expect(repo.findDeals).toHaveBeenCalledWith(
      expect.objectContaining({ country: "Italy", tag: "Beach", recentDays: PORTAL_DEAL_WINDOW_DAYS, limit: 50 }),
    );
  });

  it("interests=1 restricts to the client's saved tags, and is ignored when none are saved", async () => {
    repo.findClientOrg.mockResolvedValue({ orgId: "org-a" });
    repo.findClientTagIds.mockResolvedValueOnce(["t1", "t2"]);
    await portalDealsService.listDeals({ recent: false, interests: true, authorizationHeader: bearer("c1") });
    expect(repo.findDeals).toHaveBeenLastCalledWith(expect.objectContaining({ clientTagIds: ["t1", "t2"] }));

    repo.findClientTagIds.mockResolvedValueOnce([]);
    await portalDealsService.listDeals({ recent: false, interests: true, authorizationHeader: bearer("c1") });
    expect(repo.findDeals).toHaveBeenLastCalledWith(expect.objectContaining({ clientTagIds: undefined }));
  });

  it("interests=1 without a session never looks up tags", async () => {
    repo.findActiveOrgIdBySlug.mockResolvedValue("org-b");
    await portalDealsService.listDeals({ recent: false, interests: true, authorizationHeader: undefined, orgSlug: "agency-b" });
    expect(repo.findClientTagIds).not.toHaveBeenCalled();
  });
});

describe("getDealFilters", () => {
  it("scopes to the signed-in client's agency", async () => {
    repo.findClientOrg.mockResolvedValue({ orgId: "org-a" });
    repo.findDealFilters.mockResolvedValue({ countries: ["Italy"], popularTags: [] });
    expect(await portalDealsService.getDealFilters({ authorizationHeader: bearer("c1") })).toEqual({
      countries: ["Italy"], popularTags: [],
    });
    expect(repo.findDealFilters).toHaveBeenCalledWith("org-a");
  });

  it("no session and no slug returns empty filters", async () => {
    expect(await portalDealsService.getDealFilters({ authorizationHeader: undefined })).toEqual({
      countries: [], popularTags: [],
    });
    expect(repo.findDealFilters).not.toHaveBeenCalled();
  });

  it("a null-org client gets empty filters", async () => {
    repo.findClientOrg.mockResolvedValue({ orgId: null });
    expect((await portalDealsService.getDealFilters({ authorizationHeader: bearer("c1") })).countries).toEqual([]);
    expect(repo.findDealFilters).not.toHaveBeenCalled();
  });

  it("an org slug scopes filters for a caller without a session", async () => {
    repo.findActiveOrgIdBySlug.mockResolvedValue("org-b");
    repo.findDealFilters.mockResolvedValue({ countries: [], popularTags: [] });
    await portalDealsService.getDealFilters({ authorizationHeader: undefined, orgSlug: "agency-b" });
    expect(repo.findDealFilters).toHaveBeenCalledWith("org-b");
  });
});

describe("listForYouDeals", () => {
  it("scopes to the client's agency and saved tags", async () => {
    repo.findClientOrg.mockResolvedValue({ orgId: "org-a" });
    repo.findClientTagIds.mockResolvedValue(["t1"]);
    const deals = await portalDealsService.listForYouDeals("c1", true);
    expect(repo.findForYouDeals).toHaveBeenCalledWith({
      orgId: "org-a", clientTagIds: ["t1"], limit: 20, recentDays: PORTAL_DEAL_WINDOW_DAYS,
    });
    expect(deals).toHaveLength(1);
  });

  it("returns none for a null-org client", async () => {
    repo.findClientOrg.mockResolvedValue({ orgId: null });
    expect(await portalDealsService.listForYouDeals("c1", false)).toEqual([]);
    expect(repo.findForYouDeals).not.toHaveBeenCalled();
  });

  it("returns none when the client has no saved tags", async () => {
    repo.findClientOrg.mockResolvedValue({ orgId: "org-a" });
    repo.findClientTagIds.mockResolvedValue([]);
    expect(await portalDealsService.listForYouDeals("c1", false)).toEqual([]);
    expect(repo.findForYouDeals).not.toHaveBeenCalled();
  });
});

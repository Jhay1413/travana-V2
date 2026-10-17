import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prepareImagesForPost: vi.fn(),
  uploadMediaFromUrl: vi.fn(),
  uploadOnlySocialsMedia: vi.fn(),
  scheduleOnlySocialsPost: vi.fn(),
  rescheduleOnlySocialsPost: vi.fn(),
  repo: {
    findById: vi.fn(),
    update: vi.fn(),
    findOrgIdForQuote: vi.fn(),
    findPrimaryAccommodationNameForQuote: vi.fn(),
    findPassengerCountsForQuote: vi.fn(),
    isTestTransactionForQuote: vi.fn(),
    findOrganizationBrandingById: vi.fn(),
    create: vi.fn(),
    findByIdWithOrg: vi.fn(),
    quoteBelongsToOrg: vi.fn(),
    findByQuoteId: vi.fn(),
  },
}));

vi.mock("../image-upscale/auto-upscale.service", () => ({
  autoUpscaleService: { prepareImagesForPost: mocks.prepareImagesForPost },
}));
vi.mock("./social-post.repository", () => ({ socialPostRepository: mocks.repo }));
vi.mock("../../utils/only-socials", () => ({
  scheduleOnlySocialsPost: mocks.scheduleOnlySocialsPost,
  rescheduleOnlySocialsPost: mocks.rescheduleOnlySocialsPost,
  deleteOnlySocialsPost: vi.fn(),
  uploadMultipleOnlySocialsMedia: vi.fn(),
  uploadOnlySocialsMedia: mocks.uploadOnlySocialsMedia,
  uploadMediaFromUrl: mocks.uploadMediaFromUrl,
  fetchOnlySocialsPost: vi.fn(),
}));
vi.mock("../../utils/image-storage", () => ({
  s3KeyFromStoredUrl: () => null,
  presignImageKey: vi.fn(),
}));
vi.mock("../usage/usage.service", () => ({ usageService: {} }));
vi.mock("../ai-embeddings/ai-embeddings.service", () => ({
  aiEmbeddingsService: { syncSource: vi.fn(), removeSourceById: vi.fn() },
}));

import { toOnlySocialsBody } from "@shared/social-post-body";
import {
  buildOrgSocialContact,
  familySize,
  formatPostHTML,
  shortTourOperatorName,
  socialPostService,
  type PostDeal,
} from "./social-post.service";
import type { OrgSocialContact } from "./social-post.types";

const baseDeal: PostDeal = {
  title: "Sunny Escape",
  travelDate: "2026-08-01",
  nights: 7,
  boardBasis: "All Inclusive",
  departureAirport: "Manchester",
  luggageTransfers: "Luggage & transfers included",
  tourOperator: "Jet2holidays",
  price: "999",
};

const noContact: OrgSocialContact = {
  businessName: null,
  phone: null,
  website: null,
  instagramUrl: null,
};

describe("formatPostHTML contact block", () => {
  it("includes the org's own configured contact details", () => {
    const contact: OrgSocialContact = {
      businessName: "Acme Travel",
      phone: "01234 567890",
      website: "acmetravel.example",
      instagramUrl: "https://www.instagram.com/acmetravel/",
    };

    const html = formatPostHTML(baseDeal, "Book now", "Great resort", contact);

    expect(html).toContain("To Book");
    expect(html).toContain("01234 567890");
    expect(html).toContain("acmetravel.example");
    expect(html).toContain("https://www.instagram.com/acmetravel/");
  });

  it("omits the contact block entirely when the org has no contact details configured", () => {
    const html = formatPostHTML(baseDeal, "Book now", "Great resort", noContact);

    expect(html).not.toContain("To Book");
    expect(html).not.toContain("Private message");
    expect(html).not.toContain("Pop in and see us");
  });

  it("never falls back to another tenant's hardcoded contact details", () => {
    const withContact = formatPostHTML(baseDeal, "Book now", "Great resort", {
      businessName: "Acme Travel",
      phone: "01234 567890",
      website: "acmetravel.example",
      instagramUrl: null,
    });
    const withoutContact = formatPostHTML(baseDeal, "Book now", "Great resort", noContact);

    for (const html of [withContact, withoutContact]) {
      expect(html).not.toContain("0191 594 7999");
      expect(html).not.toContain("tinastraveldeals.co.uk");
      expect(html).not.toContain("instagram.com/tinastravel");
    }
  });
});

describe("formatPostHTML layout", () => {
  const contact: OrgSocialContact = {
    businessName: "Test Travel",
    phone: "0191 594 7999",
    website: "tinastraveldeals.co.uk",
    instagramUrl: null,
  };

  it("has no hashtag line and no tour operator emoji", () => {
    const html = formatPostHTML(baseDeal, "Book now", "Great resort", contact);
    expect(html).not.toContain("#");
    expect(html).not.toContain("🏢");
  });

  it("puts the shortened tour operator before the To Book section", () => {
    const html = formatPostHTML(baseDeal, "Book now", "Great resort", contact);
    expect(html).toContain("Jet2<br>");
    expect(html).not.toContain("Jet2holidays");
    expect(html.indexOf("Jet2<br>")).toBeLessThan(html.indexOf("To Book"));
    expect(html.trimEnd().endsWith("<br>")).toBe(true);
  });

  it("renders the To Book block in the expected format", () => {
    const html = formatPostHTML(baseDeal, "Book now", "Great resort", contact);
    const block = html.slice(html.indexOf("To Book"));
    expect(block.split("\n").map((l) => l.trim()).filter(Boolean)).toEqual([
      "To Book<br>",
      "☎️ Call us on 0191 594 7999<br>",
      "💬 Private message<br>",
      "📍 Pop in and see us<br>",
      "🌐 Visit our website: tinastraveldeals.co.uk<br>",
    ]);
    expect(html).toContain("<br>To Book<br>");
  });

  it("omits the To Book block when no contact details are configured", () => {
    const html = formatPostHTML(baseDeal, "Book now", "Great resort", noContact);
    expect(html).not.toContain("To Book");
  });
});

describe("familySize", () => {
  it.each([
    [2, 1, 3],
    [2, 2, 4],
    [2, 0, null],
    [2, 3, null],
    [1, 1, null],
    [3, 1, null],
    [null, 1, null],
    [2, null, null],
    [undefined, undefined, null],
  ])("familySize(%s adults, %s children) = %s", (adults, children, expected) => {
    expect(familySize(adults, children)).toBe(expected);
  });
});

describe("formatPostHTML family pricing", () => {
  it.each([3, 4] as const)("renders the total with a Family of %i line and no pp", (size) => {
    const html = formatPostHTML({ ...baseDeal, price: "3952.48", familySize: size }, "Book now", "Great resort", noContact);
    expect(html).toContain(`💸 Total cost from £3952.48 for a Family of ${size}<br>`);
    expect(html).not.toContain("pp<br>");
  });

  it("keeps the per-person line when there is no family size", () => {
    const html = formatPostHTML({ ...baseDeal, price: "988.12", familySize: null }, "Book now", "Great resort", noContact);
    expect(html).toContain("💸 Total cost from £988.12pp<br>");
    expect(html).not.toContain("Family of");
  });
});

describe("socialPostService.generatePost family pricing", () => {
  const params = {
    quoteId: "quote-1",
    title: "Sunny Escape",
    destination: "Spain",
    nights: 7,
    salesPrice: "3952.48",
    pricePerPerson: "988.12",
    travelDate: "2026-08-01",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.repo.isTestTransactionForQuote.mockResolvedValue(false);
    mocks.repo.findOrgIdForQuote.mockResolvedValue(null);
    mocks.repo.findOrganizationBrandingById.mockResolvedValue(null);
    mocks.repo.create.mockImplementation(async (data: Record<string, unknown>) => data);
  });

  it("updates the existing deal instead of creating a second one", async () => {
    mocks.repo.findPassengerCountsForQuote.mockResolvedValue({ adults: 2, children: 0 });
    mocks.repo.findByQuoteId.mockResolvedValue({ id: "deal-1", quote_id: "quote-1", onlySocialsId: 9 });
    mocks.repo.update.mockImplementation(async (_id: string, data: Record<string, unknown>) => ({ id: "deal-1", ...data }));

    await socialPostService.generatePost(params, { orgId: null });

    expect(mocks.repo.create).not.toHaveBeenCalled();
    expect(mocks.repo.update).toHaveBeenCalledTimes(1);
    const [id, data] = mocks.repo.update.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe("deal-1");
    expect(data).not.toHaveProperty("onlySocialsId");
    expect(data).not.toHaveProperty("postSchedule");
    expect(data).toMatchObject({ title: "Sunny Escape", nights: 7, price: "988.12" });
  });

  it("creates a deal when none exists for the quote", async () => {
    mocks.repo.findPassengerCountsForQuote.mockResolvedValue({ adults: 2, children: 0 });
    mocks.repo.findByQuoteId.mockResolvedValue(undefined);
    await socialPostService.generatePost(params, { orgId: null });
    expect(mocks.repo.update).not.toHaveBeenCalled();
    expect(mocks.repo.create).toHaveBeenCalledTimes(1);
  });

  it("uses the total price and Family of 4 for 2 adults + 2 children", async () => {
    mocks.repo.findPassengerCountsForQuote.mockResolvedValue({ adults: 2, children: 2 });
    await socialPostService.generatePost(params, { orgId: null });
    const saved = mocks.repo.create.mock.calls[0][0] as { post: string; price: string };
    expect(saved.post).toContain("💸 Total cost from £3952.48 for a Family of 4<br>");
    expect(saved.price).toBe("3952.48");
  });

  it("includes the To Book block when the resolved org (creator fallback) has a phone", async () => {
    mocks.repo.findPassengerCountsForQuote.mockResolvedValue({ adults: 2, children: 0 });
    mocks.repo.findOrgIdForQuote.mockResolvedValue("org-creator");
    mocks.repo.findOrganizationBrandingById.mockResolvedValue({ name: "Acme", settings: { profile: { phone: "0123" } } });
    await socialPostService.generatePost(params, { orgId: null });
    expect(mocks.repo.findOrganizationBrandingById).toHaveBeenCalledWith("org-creator");
    const saved = mocks.repo.create.mock.calls[0][0] as { post: string };
    expect(saved.post).toContain("To Book");
    expect(saved.post).toContain("0123");
  });

  it("omits the To Book block when the org has no contact details", async () => {
    mocks.repo.findPassengerCountsForQuote.mockResolvedValue({ adults: 2, children: 0 });
    mocks.repo.findOrgIdForQuote.mockResolvedValue("org-creator");
    mocks.repo.findOrganizationBrandingById.mockResolvedValue({ name: "Acme", settings: {} });
    await socialPostService.generatePost(params, { orgId: null });
    const saved = mocks.repo.create.mock.calls[0][0] as { post: string };
    expect(saved.post).not.toContain("To Book");
  });

  it("keeps per-person pricing for non-family quotes", async () => {
    mocks.repo.findPassengerCountsForQuote.mockResolvedValue({ adults: 2, children: 0 });
    await socialPostService.generatePost(params, { orgId: null });
    const saved = mocks.repo.create.mock.calls[0][0] as { post: string; price: string };
    expect(saved.post).toContain("💸 Total cost from £988.12pp<br>");
    expect(saved.price).toBe("988.12");
  });

  it("falls back to per-person when a family quote has no salesPrice", async () => {
    mocks.repo.findPassengerCountsForQuote.mockResolvedValue({ adults: 2, children: 1 });
    await socialPostService.generatePost({ ...params, salesPrice: undefined }, { orgId: null });
    const saved = mocks.repo.create.mock.calls[0][0] as { post: string; price: string };
    expect(saved.post).toContain("£988.12pp<br>");
    expect(saved.post).not.toContain("Family of");
  });
});

describe("shortTourOperatorName", () => {
  it.each(["easyJet", "Easyjet", "easyJet holidays", "EasyJet Holidays"])("shortens %s to Ejet", (name) => {
    expect(shortTourOperatorName(name)).toBe("Ejet");
  });

  it.each(["Jet2Holidays", "Jet2 Holidays", "jet2holidays", "Jet2holidays.com", "Jet2"])("shortens %s to Jet2", (name) => {
    expect(shortTourOperatorName(name)).toBe("Jet2");
  });

  it("returns other names trimmed and unchanged", () => {
    expect(shortTourOperatorName("  TUI  ")).toBe("TUI");
  });
});

describe("socialPostService auto-upscale at schedule time", () => {
  const deal = { id: "deal-1", quote_id: "quote-1", post: "hello", onlySocialsId: "os-1" };
  const summary = {
    upscaled: [{ originalUrl: "https://a/1.jpg", resultUrl: "https://a/1-up.jpg", from: null, to: null }],
    skipped: [{ originalUrl: "https://a/2.jpg", reason: "failed" as const, message: "boom" }],
  };
  const keptFile = { originalname: "keep.jpg", mimetype: "image/jpeg" } as Express.Multer.File;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    mocks.repo.findById.mockResolvedValue(deal);
    mocks.repo.update.mockResolvedValue({ ...deal, onlySocialsId: "os-1" });
    mocks.repo.findOrgIdForQuote.mockResolvedValue(null);
    mocks.repo.findPrimaryAccommodationNameForQuote.mockResolvedValue(null);
    mocks.prepareImagesForPost.mockResolvedValue({
      imageUrls: ["https://a/1-up.jpg", "https://a/2.jpg"],
      files: [keptFile],
      ...summary,
    });
    mocks.uploadOnlySocialsMedia.mockResolvedValue({ id: "10" });
    mocks.uploadMediaFromUrl.mockResolvedValueOnce({ id: "11" }).mockResolvedValueOnce({ id: "12" });
    mocks.scheduleOnlySocialsPost.mockResolvedValue({ uuid: "os-1" });
    mocks.rescheduleOnlySocialsPost.mockResolvedValue({ uuid: "os-1" });
  });

  it("schedulePost uploads the prepared files/urls and returns the auto-upscale summary", async () => {
    const original = { originalname: "orig.jpg" } as Express.Multer.File;
    const result = await socialPostService.schedulePost(
      "deal-1", "2026-01-01T10:00:00Z", "2026-01-01T10:00:00", [5], [original], ["https://a/1.jpg", "https://a/2.jpg"],
      { orgId: null },
    );

    expect(mocks.prepareImagesForPost).toHaveBeenCalledWith(
      expect.objectContaining({ quoteId: "quote-1", imageUrls: ["https://a/1.jpg", "https://a/2.jpg"], files: [original] }),
    );
    expect(mocks.uploadOnlySocialsMedia).toHaveBeenCalledWith(keptFile);
    expect(mocks.uploadMediaFromUrl).toHaveBeenNthCalledWith(1, "https://a/1-up.jpg");
    expect(mocks.uploadMediaFromUrl).toHaveBeenNthCalledWith(2, "https://a/2.jpg");
    expect(mocks.scheduleOnlySocialsPost).toHaveBeenCalledWith("2026-01-01T10:00:00", "hello", [5, 10, 11, 12]);
    expect(result.autoUpscale).toEqual(summary);
  });

  it("reschedulePost uploads the prepared files/urls and returns the auto-upscale summary", async () => {
    const result = await socialPostService.reschedulePost(
      "deal-1", "2026-01-01T10:00:00Z", "2026-01-01T10:00:00", [], [], "new text", ["https://a/1.jpg", "https://a/2.jpg"],
      { orgId: null },
    );

    expect(mocks.uploadMediaFromUrl).toHaveBeenNthCalledWith(1, "https://a/1-up.jpg");
    expect(mocks.rescheduleOnlySocialsPost).toHaveBeenCalledWith("os-1", "2026-01-01T10:00:00", "new text", [10, 11, 12]);
    expect(result.autoUpscale).toEqual(summary);
  });
});

describe("buildOrgSocialContact phone fallback", () => {
  it("prefers settings.social.phone", () => {
    const c = buildOrgSocialContact({
      name: "Acme",
      settings: { social: { phone: "111" }, profile: { phone: "222" } },
    });
    expect(c.phone).toBe("111");
  });

  it("falls back to the trimmed settings.profile.phone", () => {
    const c = buildOrgSocialContact({ name: "Acme", settings: { profile: { phone: "  222  " } } });
    expect(c.phone).toBe("222");
  });

  it("is null when neither phone is set", () => {
    const c = buildOrgSocialContact({ name: "Acme", settings: { profile: { phone: "  " } } });
    expect(c.phone).toBeNull();
  });
});

describe("formatPostHTML line breaks", () => {
  it("is unchanged in meaning when normalised for OnlySocials, with no stray blanks for missing details", () => {
    const html = formatPostHTML({ ...baseDeal, boardBasis: null }, "Book now", "Why:<br>Great", noContact);
    const body = toOnlySocialsBody(html);
    expect(toOnlySocialsBody(body)).toBe(body);
    expect(body).toContain("🌙 7 Nights<br>\n✈️ Manchester");
    expect(body).toContain("<br>\n<br>\n");
    expect(body).not.toMatch(/\n\n/);
  });
});

describe("socialPostService shop/homeworker partition", () => {
  const SMM = {
    orgId: "org1", branchId: "b1", orgRole: "social_media_manager", orgRoles: ["social_media_manager"],
    userId: "u1", branchType: "shop", ownsHomeworkerBranch: false,
  } as never;

  beforeEach(() => {
    mocks.repo.findById.mockReset();
    mocks.repo.findByIdWithOrg.mockReset();
    mocks.repo.quoteBelongsToOrg.mockReset();
    mocks.repo.findByQuoteId.mockReset();
    mocks.repo.update.mockClear();
  });

  it("passes the caller scope to the quote check", async () => {
    mocks.repo.quoteBelongsToOrg.mockResolvedValue(true);
    mocks.repo.findByQuoteId.mockResolvedValue(null);
    await socialPostService.getTravelDealByQuoteId("q1", SMM);
    expect(mocks.repo.quoteBelongsToOrg).toHaveBeenCalledWith("q1", "org1", SMM);
  });

  it("hides a homeworker's quote from shop staff (404)", async () => {
    mocks.repo.quoteBelongsToOrg.mockResolvedValue(false);
    await expect(socialPostService.getTravelDealByQuoteId("q1", SMM)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("hides a deal whose quote is in a homeworker branch (404)", async () => {
    mocks.repo.findById.mockResolvedValue({ id: "d1", quote_id: "q1" });
    mocks.repo.findByIdWithOrg.mockResolvedValue({ id: "d1", orgId: "org1" });
    mocks.repo.quoteBelongsToOrg.mockResolvedValue(false);
    await expect(socialPostService.updateTravelDeal("d1", {}, SMM)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.repo.quoteBelongsToOrg).toHaveBeenCalledWith("q1", "org1", SMM);
    expect(mocks.repo.update).not.toHaveBeenCalled();
  });
});

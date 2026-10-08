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

import { formatPostHTML, socialPostService, type PostDeal } from "./social-post.service";
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

    const html = formatPostHTML(baseDeal, "Book now", "Great resort", ["#Travel"], contact);

    expect(html).toContain("To Book:");
    expect(html).toContain("01234 567890");
    expect(html).toContain("acmetravel.example");
    expect(html).toContain("https://www.instagram.com/acmetravel/");
  });

  it("omits the contact block entirely when the org has no contact details configured", () => {
    const html = formatPostHTML(baseDeal, "Book now", "Great resort", ["#Travel"], noContact);

    expect(html).not.toContain("To Book:");
    expect(html).not.toContain("Private message");
    expect(html).not.toContain("Pop in and see us");
  });

  it("never falls back to another tenant's hardcoded contact details", () => {
    const withContact = formatPostHTML(baseDeal, "Book now", "Great resort", ["#Travel"], {
      businessName: "Acme Travel",
      phone: "01234 567890",
      website: "acmetravel.example",
      instagramUrl: null,
    });
    const withoutContact = formatPostHTML(baseDeal, "Book now", "Great resort", ["#Travel"], noContact);

    for (const html of [withContact, withoutContact]) {
      expect(html).not.toContain("0191 594 7999");
      expect(html).not.toContain("tinastraveldeals.co.uk");
      expect(html).not.toContain("instagram.com/tinastravel");
    }
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

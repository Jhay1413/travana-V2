import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  prepareImagesForPost: vi.fn(),
  uploadMediaFromUrl: vi.fn(),
  uploadOnlySocialsMedia: vi.fn(),
  scheduleOnlySocialsPost: vi.fn(),
  rescheduleOnlySocialsPost: vi.fn(),
  fetchOnlySocialsPost: vi.fn(),
  listAccounts: vi.fn(),
  resolveDraftTargets: vi.fn(),
  repo: {
    findById: vi.fn(),
    update: vi.fn(),
    findOrgIdForQuote: vi.fn(),
    findPrimaryAccommodationNameForQuote: vi.fn(),
    findByIdWithOrg: vi.fn(),
    quoteBelongsToOrg: vi.fn(),
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
  fetchOnlySocialsPost: mocks.fetchOnlySocialsPost,
  LEGACY_DEFAULT_ACCOUNT_ID: 81085,
}));
vi.mock("../social-settings/social-settings.service", () => ({
  socialSettingsService: { listAccounts: mocks.listAccounts, resolveDraftTargets: mocks.resolveDraftTargets },
}));
vi.mock("../../utils/image-storage", () => ({
  s3KeyFromStoredUrl: () => null,
  publicImageKeyFromStoredUrl: () => null,
  isStoredProxyUrl: () => false,
  presignImageKey: vi.fn(),
}));
vi.mock("../usage/usage.service", () => ({ usageService: {} }));
vi.mock("../ai-embeddings/ai-embeddings.service", () => ({
  aiEmbeddingsService: { syncSource: vi.fn(), removeSourceById: vi.fn() },
}));

import { socialPostService } from "./social-post.service";
import { AppError } from "../../utils/error-handler";

const FB_TARGET = [{ accountId: 81085, platform: "facebook" }];
const FB_ACCOUNT = { id: 81085, name: "Apple Travel", username: null, image: null, platform: "facebook", authorized: true, selectable: true };

describe("socialPostService platform selection", () => {
  const deal = { id: "deal-1", quote_id: "quote-1", post: "hello", onlySocialsId: null, only_socials_targets: null };
  const SECOND_FB = { ...FB_ACCOUNT, id: 5, name: "Second Page" };
  const IG = { ...FB_ACCOUNT, id: 7, name: "Apple IG", platform: "instagram" };
  const IG_OFF = { ...IG, id: 8, name: "Locked IG", selectable: false, unavailableReason: "Instagram coming soon" };
  const FB_DEAD = { ...FB_ACCOUNT, id: 9, name: "Dead Page", authorized: false, selectable: false, unavailableReason: "Reconnect in OnlySocials" };
  const NO_UPSCALE = { imageUrls: [], files: [], upscaled: [], skipped: [] };
  const run = (accountIds: number[] | undefined, existing: number[] = [1]) =>
    socialPostService.schedulePost("deal-1", "2026-01-01T10:00:00Z", "2026-01-01T10:00:00", existing, [], [], { orgId: null }, undefined, accountIds);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    mocks.repo.findById.mockResolvedValue(deal);
    mocks.repo.update.mockImplementation(async (_id: string, data: object) => ({ ...deal, ...data }));
    mocks.repo.findOrgIdForQuote.mockResolvedValue(null);
    mocks.repo.findPrimaryAccommodationNameForQuote.mockResolvedValue(null);
    mocks.prepareImagesForPost.mockResolvedValue(NO_UPSCALE);
    mocks.scheduleOnlySocialsPost.mockResolvedValue({ uuid: "os-9" });
    mocks.rescheduleOnlySocialsPost.mockResolvedValue({ uuid: "os-9" });
    mocks.listAccounts.mockReset().mockResolvedValue({ configured: true, accounts: [FB_ACCOUNT, SECOND_FB, IG, IG_OFF, FB_DEAD] });
  });

  const expectNothingSent = () => {
    expect(mocks.scheduleOnlySocialsPost).not.toHaveBeenCalled();
    expect(mocks.rescheduleOnlySocialsPost).not.toHaveBeenCalled();
    expect(mocks.uploadOnlySocialsMedia).not.toHaveBeenCalled();
    expect(mocks.uploadMediaFromUrl).not.toHaveBeenCalled();
    expect(mocks.repo.update).not.toHaveBeenCalled();
  };

  it("asks for a fresh account list and schedules Facebook + Instagram together, persisting the targets", async () => {
    await run([81085, 7]);

    expect(mocks.listAccounts).toHaveBeenCalledWith(null, { force: true });
    const targets = [{ accountId: 81085, platform: "facebook" }, { accountId: 7, platform: "instagram" }];
    expect(mocks.scheduleOnlySocialsPost).toHaveBeenCalledWith("2026-01-01T10:00:00", "hello", [1], targets);
    expect(mocks.repo.update).toHaveBeenCalledWith("deal-1", expect.objectContaining({ onlySocialsId: "os-9", only_socials_targets: targets }));
  });

  it("rejects an empty selection with 400", async () => {
    await expect(run([])).rejects.toMatchObject({ statusCode: 400 });
    expectNothingSent();
  });

  it.each([
    ["an unknown or other-agency id", 424242, "Account 424242"],
    ["a disconnected account", 9, "Dead Page"],
    ["Instagram while the server flag is off", 8, "Locked IG"],
  ])("rejects %s with 422 and never calls OnlySocials", async (_label, id, name) => {
    await expect(run([81085, id])).rejects.toMatchObject({
      statusCode: 422,
      message: `${name} is disconnected or not available — reconnect it in OnlySocials or untick it`,
    });
    expect(mocks.prepareImagesForPost).not.toHaveBeenCalled();
    expectNothingSent();
  });

  it("refuses with 503 when OnlySocials credentials are missing", async () => {
    mocks.listAccounts.mockResolvedValue({ configured: false, accounts: [] });
    await expect(run([81085])).rejects.toMatchObject({ statusCode: 503 });
    expectNothingSent();
  });

  it("blocks Instagram with 0 images", async () => {
    await expect(run([7], [])).rejects.toMatchObject({ statusCode: 400, message: "Instagram posts need at least one image" });
    expect(mocks.scheduleOnlySocialsPost).not.toHaveBeenCalled();
  });

  it("checks the Instagram image minimum AFTER media resolution (silently dropped URL uploads)", async () => {
    mocks.prepareImagesForPost.mockResolvedValue({ imageUrls: ["https://a/1.jpg"], files: [], upscaled: [], skipped: [] });
    mocks.uploadMediaFromUrl.mockRejectedValue(new Error("fetch failed"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      socialPostService.schedulePost("deal-1", "2026-01-01T10:00:00Z", "2026-01-01T10:00:00", [], [], ["https://a/1.jpg"], { orgId: null }, undefined, [7]),
    ).rejects.toMatchObject({ statusCode: 400, message: "Instagram posts need at least one image" });
    expect(mocks.scheduleOnlySocialsPost).not.toHaveBeenCalled();
  });

  it("allows Facebook with 0 images", async () => {
    await run([81085], []);
    expect(mocks.scheduleOnlySocialsPost).toHaveBeenCalled();
  });

  it("blocks Instagram with more than 10 images", async () => {
    await expect(run([7], Array.from({ length: 11 }, (_, i) => i + 1))).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.scheduleOnlySocialsPost).not.toHaveBeenCalled();
  });

  it("blocks an Instagram caption over 2200 characters but not Facebook alone", async () => {
    mocks.repo.findById.mockResolvedValue({ ...deal, post: "x".repeat(2201) });
    await expect(run([7])).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.scheduleOnlySocialsPost).not.toHaveBeenCalled();

    await run([81085]);
    expect(mocks.scheduleOnlySocialsPost).toHaveBeenCalled();
  });

  it("falls back to the legacy Facebook account when schedule gets no accountIds and the deal has no targets", async () => {
    await run(undefined);
    expect(mocks.scheduleOnlySocialsPost).toHaveBeenCalledWith("2026-01-01T10:00:00", "hello", [1], FB_TARGET);
  });

  describe("reschedule fallback chain", () => {
    const scheduled = { ...deal, onlySocialsId: "os-1" };
    const reschedule = (accountIds?: number[]) =>
      socialPostService.reschedulePost("deal-1", "2026-01-01T10:00:00Z", "2026-01-01T10:00:00", [1], [], "text", [], { orgId: null }, undefined, accountIds);

    it("uses the accountIds in the request first", async () => {
      mocks.repo.findById.mockResolvedValue({ ...scheduled, only_socials_targets: [{ accountId: 5, platform: "facebook" }] });
      await reschedule([81085]);
      expect(mocks.rescheduleOnlySocialsPost).toHaveBeenCalledWith("os-1", "2026-01-01T10:00:00", "text", [1], FB_TARGET);
    });

    it("then the stored targets", async () => {
      const stored = [{ accountId: 5, platform: "facebook" }, { accountId: 7, platform: "instagram" }];
      mocks.repo.findById.mockResolvedValue({ ...scheduled, only_socials_targets: stored });
      await reschedule();
      expect(mocks.rescheduleOnlySocialsPost).toHaveBeenCalledWith("os-1", "2026-01-01T10:00:00", "text", [1], stored);
      expect(mocks.repo.update).toHaveBeenCalledWith("deal-1", expect.objectContaining({ only_socials_targets: stored }));
    });

    it("then the legacy account", async () => {
      mocks.repo.findById.mockResolvedValue({ ...scheduled, only_socials_targets: null });
      await reschedule();
      expect(mocks.rescheduleOnlySocialsPost).toHaveBeenCalledWith("os-1", "2026-01-01T10:00:00", "text", [1], FB_TARGET);
    });

    it("rejects a stored account that has since been disconnected (422) before calling OnlySocials", async () => {
      mocks.repo.findById.mockResolvedValue({ ...scheduled, only_socials_targets: [{ accountId: 9, platform: "facebook" }] });
      await expect(reschedule()).rejects.toMatchObject({ statusCode: 422 });
      expect(mocks.rescheduleOnlySocialsPost).not.toHaveBeenCalled();
    });
  });

  describe("updateTravelDeal (PATCH whitelist)", () => {
    const patch = (body: object, scope: object = { orgId: null }) => socialPostService.updateTravelDeal("deal-1", body as never, scope as never);

    beforeEach(() => {
      mocks.resolveDraftTargets.mockReset().mockResolvedValue([{ accountId: 81085, platform: "facebook" }, { accountId: 7, platform: "instagram" }]);
    });

    it("drops onlySocialsId, quote_id and postSchedule smuggled into the body", async () => {
      await patch({ post: "new", onlySocialsId: "evil", quote_id: "other", postSchedule: "2020-01-01", id: "x" });
      expect(mocks.repo.update).toHaveBeenCalledWith("deal-1", { post: "new" });
      expect(mocks.resolveDraftTargets).not.toHaveBeenCalled();
    });

    it("stores accountIds as targets on an unscheduled draft using the allow-list check, never the live list", async () => {
      await patch({ accountIds: [81085, 7] });
      expect(mocks.resolveDraftTargets).toHaveBeenCalledWith(null, [81085, 7]);
      expect(mocks.listAccounts).not.toHaveBeenCalled();
      expect(mocks.repo.update).toHaveBeenCalledWith("deal-1", {
        only_socials_targets: [{ accountId: 81085, platform: "facebook" }, { accountId: 7, platform: "instagram" }],
      });
    });

    it("always saves the text, then raises the accounts error with a message that says the text was saved", async () => {
      mocks.resolveDraftTargets.mockRejectedValue(new AppError("Account 8 is not enabled for this agency", 422));
      await expect(patch({ post: "keep me", accountIds: [8] })).rejects.toMatchObject({
        statusCode: 422,
        message: "Your text was saved, but the accounts were not: Account 8 is not enabled for this agency",
      });
      expect(mocks.repo.update).toHaveBeenCalledWith("deal-1", { post: "keep me" });
    });

    it("an OnlySocials outage on the accounts part (502) still keeps the text", async () => {
      mocks.resolveDraftTargets.mockRejectedValue(new AppError("Couldn't load connected accounts", 502));
      await expect(patch({ post: "keep me", accountIds: [81085] })).rejects.toMatchObject({ statusCode: 502 });
      expect(mocks.repo.update).toHaveBeenCalledWith("deal-1", { post: "keep me" });
    });

    it("accounts-only request that fails writes nothing", async () => {
      mocks.resolveDraftTargets.mockRejectedValue(new AppError("Account 8 is not enabled for this agency", 422));
      await expect(patch({ accountIds: [8] })).rejects.toMatchObject({ statusCode: 422, message: expect.stringContaining("The accounts were not saved") });
      expect(mocks.repo.update).not.toHaveBeenCalled();
    });

    it("refuses to change accounts on an already scheduled post but still saves the text", async () => {
      mocks.repo.findById.mockResolvedValue({ ...deal, onlySocialsId: "os-1" });
      await expect(patch({ post: "t", accountIds: [81085] })).rejects.toMatchObject({ statusCode: 400 });
      expect(mocks.repo.update).toHaveBeenCalledWith("deal-1", { post: "t" });
    });

    describe("text edit on a scheduled post is pushed to OnlySocials first", () => {
      const future = new Date(Date.now() + 3 * 24 * 3600 * 1000);
      const scheduled = { ...deal, onlySocialsId: "os-1", postSchedule: future, only_socials_targets: [{ accountId: 5, platform: "facebook" }, { accountId: 7, platform: "instagram" }] };
      const remote = {
        date: "2026-12-01",
        time: "09:30",
        versions: [{ is_original: true, content: [{ body: "old", media: [{ id: 11 }, { id: 12 }] }] }],
      };

      beforeEach(() => {
        mocks.repo.findById.mockResolvedValue(scheduled);
        mocks.fetchOnlySocialsPost.mockReset().mockResolvedValue(remote);
      });

      it("keeps the OnlySocials date/time, accounts and media, and only then saves the text", async () => {
        const order: string[] = [];
        mocks.rescheduleOnlySocialsPost.mockImplementation(async () => {
          order.push("onlysocials");
          return { uuid: "os-1" };
        });
        mocks.repo.update.mockImplementation(async (_id: string, data: object) => {
          order.push("local");
          return { ...scheduled, ...data };
        });
        await patch({ post: "new text" });
        expect(mocks.rescheduleOnlySocialsPost).toHaveBeenCalledWith(
          "os-1",
          "2026-12-01T09:30",
          "new text",
          [11, 12],
          [{ accountId: 5, platform: "facebook" }, { accountId: 7, platform: "instagram" }],
        );
        expect(order).toEqual(["onlysocials", "local"]);
        expect(mocks.repo.update).toHaveBeenCalledWith("deal-1", expect.objectContaining({ post: "new text" }));
      });

      it("uses the legacy account when the post has no stored targets", async () => {
        mocks.repo.findById.mockResolvedValue({ ...scheduled, only_socials_targets: null });
        await patch({ post: "t" });
        expect(mocks.rescheduleOnlySocialsPost).toHaveBeenCalledWith("os-1", "2026-12-01T09:30", "t", [11, 12], FB_TARGET);
      });

      it("an OnlySocials failure saves nothing and says nothing was changed", async () => {
        mocks.rescheduleOnlySocialsPost.mockRejectedValue(new AppError("OnlySocials reschedule error: boom", 500));
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        await expect(patch({ post: "new text" })).rejects.toMatchObject({
          statusCode: 502,
          message: "Couldn't update the scheduled post on Facebook/Instagram — nothing was changed",
        });
        expect(mocks.repo.update).not.toHaveBeenCalled();
      });

      it("failing to read the post from OnlySocials also saves nothing", async () => {
        mocks.fetchOnlySocialsPost.mockRejectedValue(new AppError("down", 500));
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        await expect(patch({ post: "new text" })).rejects.toMatchObject({ statusCode: 502 });
        expect(mocks.rescheduleOnlySocialsPost).not.toHaveBeenCalled();
        expect(mocks.repo.update).not.toHaveBeenCalled();
      });

      it("a stored account that is no longer allowed is refused before OnlySocials is touched", async () => {
        mocks.repo.findById.mockResolvedValue({ ...scheduled, only_socials_targets: [{ accountId: 9, platform: "facebook" }] });
        await expect(patch({ post: "t" })).rejects.toMatchObject({ statusCode: 422, message: expect.stringContaining("nothing was changed") });
        expect(mocks.fetchOnlySocialsPost).not.toHaveBeenCalled();
        expect(mocks.repo.update).not.toHaveBeenCalled();
      });

      it("an already posted post (schedule in the past) is saved locally only", async () => {
        mocks.repo.findById.mockResolvedValue({ ...scheduled, postSchedule: new Date(Date.now() - 3600 * 1000) });
        await patch({ post: "t" });
        expect(mocks.fetchOnlySocialsPost).not.toHaveBeenCalled();
        expect(mocks.rescheduleOnlySocialsPost).not.toHaveBeenCalled();
        expect(mocks.repo.update).toHaveBeenCalledWith("deal-1", { post: "t" });
      });

      it("a draft is saved locally only", async () => {
        mocks.repo.findById.mockResolvedValue(deal);
        await patch({ post: "t" });
        expect(mocks.rescheduleOnlySocialsPost).not.toHaveBeenCalled();
        expect(mocks.repo.update).toHaveBeenCalledWith("deal-1", { post: "t" });
      });

      it("a request without text never calls OnlySocials", async () => {
        mocks.resolveDraftTargets.mockResolvedValue([]);
        await patch({});
        expect(mocks.rescheduleOnlySocialsPost).not.toHaveBeenCalled();
      });
    });

    it("a platform admin editing another agency's draft is checked against THAT agency, not the one they are acting in", async () => {
      mocks.repo.findByIdWithOrg.mockResolvedValue({ id: "deal-1", quote_id: "quote-1", orgId: "org-B" });
      const admin = { orgId: "org-A", orgRole: "platform_admin", orgRoles: ["platform_admin"], userId: "u1" };
      await patch({ accountIds: [81085] }, admin);
      expect(mocks.resolveDraftTargets).toHaveBeenCalledWith("org-B", [81085]);
    });

    it("agency users are checked against their own org", async () => {
      mocks.repo.findByIdWithOrg.mockResolvedValue({ id: "deal-1", quote_id: "quote-1", orgId: "org-A" });
      mocks.repo.quoteBelongsToOrg.mockResolvedValue(true);
      const agent = { orgId: "org-A", orgRole: "agent", orgRoles: ["agent"], userId: "u1", branchId: "b1", branchType: "shop", ownsHomeworkerBranch: false };
      await patch({ accountIds: [81085] }, agent);
      expect(mocks.resolveDraftTargets).toHaveBeenCalledWith("org-A", [81085]);
    });
  });

  describe("platform admin on another agency's post", () => {
    it("schedules against the post's own agency allow-list", async () => {
      mocks.repo.findByIdWithOrg.mockResolvedValue({ id: "deal-1", quote_id: "quote-1", orgId: "org-B" });
      const admin = { orgId: "org-A", orgRole: "platform_admin", orgRoles: ["platform_admin"], userId: "u1" };
      await socialPostService.schedulePost("deal-1", "2026-01-01T10:00:00Z", "2026-01-01T10:00:00", [1], [], [], admin as never, undefined, [81085]);
      expect(mocks.listAccounts).toHaveBeenCalledWith("org-B", { force: true });
    });
  });

  describe("Instagram pre-checks run before any paid or external work", () => {
    const expectNoSideEffects = () => {
      expect(mocks.prepareImagesForPost).not.toHaveBeenCalled();
      expect(mocks.uploadOnlySocialsMedia).not.toHaveBeenCalled();
      expect(mocks.uploadMediaFromUrl).not.toHaveBeenCalled();
      expect(mocks.scheduleOnlySocialsPost).not.toHaveBeenCalled();
      expect(mocks.rescheduleOnlySocialsPost).not.toHaveBeenCalled();
    };
    const urls = (n: number) => Array.from({ length: n }, (_, i) => `https://a/${i}.jpg`);

    it("12 images: no upscale, no upload", async () => {
      await expect(
        socialPostService.schedulePost("deal-1", "2026-01-01T10:00:00Z", "2026-01-01T10:00:00", [1, 2], [], urls(10), { orgId: null }, undefined, [IG.id]),
      ).rejects.toMatchObject({ statusCode: 400 });
      expectNoSideEffects();
    });

    it("a 2500 character caption: no upscale, no upload (schedule)", async () => {
      mocks.repo.findById.mockResolvedValue({ ...deal, post: "x".repeat(2500) });
      await expect(run([IG.id])).rejects.toMatchObject({ statusCode: 400 });
      expectNoSideEffects();
    });

    it("zero images: no upscale (schedule)", async () => {
      await expect(run([IG.id], [])).rejects.toMatchObject({ statusCode: 400 });
      expectNoSideEffects();
    });

    it("reschedule checks the caption it is about to send, before any work", async () => {
      mocks.repo.findById.mockResolvedValue({ ...deal, onlySocialsId: "os-1" });
      await expect(
        socialPostService.reschedulePost("deal-1", "2026-01-01T10:00:00Z", "2026-01-01T10:00:00", [1], [], "y".repeat(2500), [], { orgId: null }, undefined, [IG.id]),
      ).rejects.toMatchObject({ statusCode: 400 });
      expectNoSideEffects();
    });

    it("Facebook-only is not held to the Instagram limits", async () => {
      mocks.repo.findById.mockResolvedValue({ ...deal, post: "x".repeat(2500) });
      await run([81085], []);
      expect(mocks.scheduleOnlySocialsPost).toHaveBeenCalled();
    });
  });

  describe("reschedule without a picker explains an unusable saved account", () => {
    const scheduled = { ...deal, onlySocialsId: "os-1" };
    const reschedule = () =>
      socialPostService.reschedulePost("deal-1", "2026-01-01T10:00:00Z", "2026-01-01T10:00:00", [1], [], "text", [], { orgId: null });

    it("uses the account's own reason and points to the post", async () => {
      mocks.repo.findById.mockResolvedValue({ ...scheduled, only_socials_targets: [{ accountId: IG_OFF.id, platform: "instagram" }] });
      await expect(reschedule()).rejects.toMatchObject({
        statusCode: 422,
        message: "Locked IG: Instagram coming soon. Open the post to change its accounts.",
      });
    });

    it("says not enabled for this agency when the id is missing from the allow-list (legacy account excluded)", async () => {
      mocks.repo.findById.mockResolvedValue({ ...scheduled, only_socials_targets: null });
      mocks.listAccounts.mockResolvedValue({ configured: true, accounts: [SECOND_FB] });
      await expect(reschedule()).rejects.toMatchObject({
        statusCode: 422,
        message: "Account 81085: not enabled for this agency. Open the post to change its accounts.",
      });
    });
  });

  describe("getPostMedia", () => {
    it("reads the original version, not just versions[0]", async () => {
      mocks.repo.findById.mockResolvedValue({ ...deal, onlySocialsId: "os-1" });
      mocks.fetchOnlySocialsPost.mockResolvedValue({
        versions: [
          { account_id: 7, is_original: false, content: [{ body: "ig version", media: [{ id: 2 }] }] },
          { account_id: 81085, is_original: true, content: [{ body: "original", media: [{ id: 1 }] }] },
        ],
      });
      const result = await socialPostService.getPostMedia("deal-1", { orgId: null });
      expect(result.postContent).toBe("original");
      expect(result.media).toEqual([{ id: 1 }]);
    });
  });
});

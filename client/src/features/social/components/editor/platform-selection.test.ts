import { describe, expect, it } from "vitest";
import type { SocialAccount } from "../../api/social-settings.api";
import {
  LEGACY_ACCOUNT_ID,
  defaultAccountIds,
  quickScheduleAccountIds,
  platformsSentence,
  scheduleBlockReason,
  seedSelection,
  selectedPlatforms,
  selectionSignature,
  toggleAccount,
} from "./platform-selection";

const acct = (over: Partial<SocialAccount>): SocialAccount => ({
  id: 1, name: "A", username: null, image: null, platform: "facebook", authorized: true, selectable: true, ...over,
});
const FB = acct({ id: LEGACY_ACCOUNT_ID, name: "Apple Travel" });
const FB2 = acct({ id: 5, name: "Second" });
const IG = acct({ id: 7, name: "IG", platform: "instagram" });
const IG_OFF = acct({ id: 8, name: "IG locked", platform: "instagram", selectable: false, unavailableReason: "Instagram coming soon" });
const DEAD = acct({ id: 9, name: "Dead", authorized: false, selectable: false, unavailableReason: "Reconnect in OnlySocials" });
const ALL = [FB, FB2, IG, IG_OFF, DEAD];

describe("seedSelection", () => {
  it("ticks every selectable account for a new post", () => {
    expect(seedSelection({ accounts: ALL, stored: null, hasOnlySocialsPost: false })).toEqual([LEGACY_ACCOUNT_ID, 5, 7]);
  });
  it("uses the saved targets, dropping accounts that are no longer selectable", () => {
    const stored = [{ accountId: 5, platform: "facebook" }, { accountId: 9, platform: "facebook" }, { accountId: 8, platform: "instagram" }];
    expect(seedSelection({ accounts: ALL, stored, hasOnlySocialsPost: true })).toEqual([5]);
  });
  it("seeds only the legacy page for a legacy post that is already scheduled or posted", () => {
    expect(seedSelection({ accounts: ALL, stored: null, hasOnlySocialsPost: true })).toEqual([LEGACY_ACCOUNT_ID]);
    expect(seedSelection({ accounts: ALL, stored: [], hasOnlySocialsPost: true })).toEqual([LEGACY_ACCOUNT_ID]);
  });
  it("seeds nothing when the legacy page is not available to the agency", () => {
    expect(seedSelection({ accounts: [FB2, IG], stored: null, hasOnlySocialsPost: true })).toEqual([]);
  });
  it("seeds nothing while the account list is empty", () => {
    expect(seedSelection({ accounts: [], stored: null, hasOnlySocialsPost: false })).toEqual([]);
  });
});

describe("selection helpers", () => {
  it("toggles an id in and out", () => {
    expect(toggleAccount([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggleAccount([1, 2], 1)).toEqual([2]);
  });
  it("fingerprints regardless of order", () => {
    expect(selectionSignature([7, 1])).toBe(selectionSignature([1, 7]));
    expect(selectionSignature([1])).not.toBe(selectionSignature([1, 7]));
  });
  it("lists distinct platforms, Facebook first", () => {
    expect(selectedPlatforms(ALL, [7, 5, LEGACY_ACCOUNT_ID])).toEqual(["facebook", "instagram"]);
    expect(selectedPlatforms(ALL, [7])).toEqual(["instagram"]);
    expect(selectedPlatforms(ALL, [])).toEqual([]);
  });
  it("words the subtitle by platform", () => {
    expect(platformsSentence(["facebook"])).toBe("Posts to Facebook.");
    expect(platformsSentence(["facebook", "instagram"])).toBe("Posts to Facebook and Instagram.");
    expect(platformsSentence([])).toBe("Pick where this post goes.");
  });
});

describe("scheduleBlockReason", () => {
  const base = { accounts: ALL, imageCount: 3, captionLength: 100 };
  it("blocks an empty selection", () => {
    expect(scheduleBlockReason({ ...base, ids: [] })).toMatch(/at least one account/);
  });
  it("lets Facebook go out with no images", () => {
    expect(scheduleBlockReason({ ...base, ids: [LEGACY_ACCOUNT_ID], imageCount: 0 })).toBeNull();
  });
  it("blocks Instagram without an image, with too many, or with a long caption", () => {
    expect(scheduleBlockReason({ ...base, ids: [7], imageCount: 0 })).toMatch(/at least one image/);
    expect(scheduleBlockReason({ ...base, ids: [7], imageCount: 11 })).toMatch(/up to 10 images/);
    expect(scheduleBlockReason({ ...base, ids: [7, LEGACY_ACCOUNT_ID], captionLength: 2201 })).toMatch(/2200/);
  });
  it("allows Instagram within limits", () => {
    expect(scheduleBlockReason({ ...base, ids: [7], imageCount: 10, captionLength: 2200 })).toBeNull();
  });
});

describe("defaultAccountIds", () => {
  it("takes every selectable account", () => {
    expect(defaultAccountIds(ALL, 2)).toEqual([LEGACY_ACCOUNT_ID, 5, 7]);
  });
  it("leaves Instagram out when there are more images than it allows", () => {
    expect(defaultAccountIds(ALL, 11)).toEqual([LEGACY_ACCOUNT_ID, 5]);
    expect(defaultAccountIds(ALL, 10)).toEqual([LEGACY_ACCOUNT_ID, 5, 7]);
  });
  it("leaves Instagram out when there is no image", () => {
    expect(defaultAccountIds(ALL, 0)).toEqual([LEGACY_ACCOUNT_ID, 5]);
  });
});

describe("quickScheduleAccountIds", () => {
  it("sends nothing for a draft with saved accounts, so an FB-only draft never also goes to Instagram", () => {
    expect(quickScheduleAccountIds([{ accountId: LEGACY_ACCOUNT_ID, platform: "facebook" }], ALL, 3)).toBeUndefined();
  });
  it("sends the defaults when nothing is saved", () => {
    expect(quickScheduleAccountIds(null, ALL, 3)).toEqual([LEGACY_ACCOUNT_ID, 5, 7]);
    expect(quickScheduleAccountIds([], ALL, 0)).toEqual([LEGACY_ACCOUNT_ID, 5]);
  });
  it("sends nothing while the account list is not loaded or empty", () => {
    expect(quickScheduleAccountIds(null, undefined, 3)).toBeUndefined();
    expect(quickScheduleAccountIds(null, [], 3)).toBeUndefined();
  });
});

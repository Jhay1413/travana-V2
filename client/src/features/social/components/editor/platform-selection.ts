import type { SocialAccount } from "../../api/social-settings.api";
import type { PostPlatform } from "../grid/card-fields";

/** The Facebook Page every post used before accounts became selectable. */
export const LEGACY_ACCOUNT_ID = 81085;
export const INSTAGRAM_MAX_IMAGES = 10;
export const INSTAGRAM_MAX_CAPTION = 2200;

const PLATFORM_ORDER: PostPlatform[] = ["facebook", "instagram"];

export interface StoredTarget {
  accountId: number;
  platform: string;
}

interface SeedInput {
  accounts: SocialAccount[];
  /** Targets saved on the post when it was scheduled (or on the draft); null for legacy posts. */
  stored: StoredTarget[] | null | undefined;
  /** True when the post is already on OnlySocials (scheduled or posted). */
  hasOnlySocialsPost: boolean;
}

/**
 * Accounts ticked when the editor opens. Saved targets win; a legacy post that is already
 * out went to the single Facebook Page; a new post starts with every selectable account ticked.
 */
export function seedSelection({ accounts, stored, hasOnlySocialsPost }: SeedInput): number[] {
  const selectable = accounts.filter((a) => a.selectable).map((a) => a.id);
  if (stored && stored.length > 0) return stored.map((t) => t.accountId).filter((id) => selectable.includes(id));
  if (hasOnlySocialsPost) return selectable.filter((id) => id === LEGACY_ACCOUNT_ID);
  return selectable;
}

export function toggleAccount(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/** Order-insensitive fingerprint, for the unsaved-changes check. */
export function selectionSignature(ids: number[]): string {
  return [...ids].sort((a, b) => a - b).join(",");
}

/** Distinct platforms of the ticked accounts, Facebook first. */
export function selectedPlatforms(accounts: SocialAccount[], ids: number[]): PostPlatform[] {
  const picked = accounts.filter((a) => ids.includes(a.id));
  return PLATFORM_ORDER.filter((platform) => picked.some((a) => a.platform === platform));
}

export function platformsSentence(platforms: PostPlatform[]): string {
  if (platforms.length === 0) return "Pick where this post goes.";
  const names = platforms.map((p) => (p === "facebook" ? "Facebook" : "Instagram"));
  return `Posts to ${names.join(" and ")}.`;
}

interface BlockInput {
  accounts: SocialAccount[];
  ids: number[];
  imageCount: number;
  /** Caption length as the server counts it (see onlySocialsPlainLength). */
  captionLength: number;
}

/** Why Schedule must stay disabled, or null when the selection can go out. Mirrors the server checks. */
export function scheduleBlockReason({ accounts, ids, imageCount, captionLength }: BlockInput): string | null {
  if (ids.length === 0) return "Pick at least one account to post to.";
  if (!selectedPlatforms(accounts, ids).includes("instagram")) return null;
  if (imageCount < 1) return "Instagram needs at least one image. Add an image or untick Instagram.";
  if (imageCount > INSTAGRAM_MAX_IMAGES) return `Instagram allows up to ${INSTAGRAM_MAX_IMAGES} images. Remove ${imageCount - INSTAGRAM_MAX_IMAGES}.`;
  if (captionLength > INSTAGRAM_MAX_CAPTION) {
    return `Instagram captions are limited to ${INSTAGRAM_MAX_CAPTION} characters (this one is ${captionLength}).`;
  }
  return null;
}

/**
 * Accounts for the quick Schedule dialog, which has no picker: every selectable account,
 * except Instagram when it has no image or more than Instagram allows (it would be refused).
 */
export function defaultAccountIds(accounts: SocialAccount[], imageCount: number): number[] {
  return accounts.filter((a) => a.selectable && (a.platform !== "instagram" || (imageCount > 0 && imageCount <= INSTAGRAM_MAX_IMAGES))).map((a) => a.id);
}

/**
 * Accounts the quick Schedule dialog sends. A draft with saved accounts sends none (the server reuses them);
 * otherwise the defaults. Undefined lets the server use the saved or legacy account.
 */
export function quickScheduleAccountIds(
  saved: StoredTarget[] | null | undefined,
  accounts: SocialAccount[] | undefined,
  imageCount: number,
): number[] | undefined {
  if (saved && saved.length > 0) return undefined;
  const ids = accounts ? defaultAccountIds(accounts, imageCount) : [];
  return ids.length > 0 ? ids : undefined;
}

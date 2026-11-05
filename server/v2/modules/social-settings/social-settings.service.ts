import type { OrgSocialSettings } from "@shared/schema";
import { AppError } from "../../utils/error-handler";
import {
  getOnlySocialsChannelInfo,
  isInstagramEnabled,
  isOnlySocialsConfigured,
  listOnlySocialsAccounts,
  LEGACY_DEFAULT_ACCOUNT_ID,
} from "../../utils/only-socials";
import type { OnlySocialsAccount } from "../social-post/social-post.types";
import { socialSettingsRepository } from "./social-settings.repository";
import type {
  SocialAccountsResult,
  SocialAccountView,
  SocialAllowListView,
  SocialChannelInfo,
  SocialSettingsInput,
  SocialSettingsView,
} from "./social-settings.types";

const DEFAULTS = {
  defaultViewLink: true,
  defaultPriceBadge: true,
  timeShortcuts: ["09:00", "12:30", "19:00"],
  timezone: "Europe/London",
};

function toView(orgId: string, row: OrgSocialSettings): SocialSettingsView {
  return {
    orgId,
    defaultViewLink: row.defaultViewLink,
    defaultPriceBadge: row.defaultPriceBadge,
    timeShortcuts: row.timeShortcuts,
    timezone: row.timezone,
    isDefault: false,
  };
}

/** Returns the canonical IANA name (europe/london -> Europe/London) or null if unknown. */
function normaliseTimeZone(timeZone: string): string | null {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

function toAccountView(account: OnlySocialsAccount): SocialAccountView {
  const base = {
    id: account.id,
    name: account.name,
    username: account.username,
    image: account.image,
    platform: account.platform,
    authorized: account.authorized,
  };
  if (!account.authorized) return { ...base, selectable: false, unavailableReason: "Reconnect in OnlySocials" };
  if (account.platform === "instagram" && !isInstagramEnabled()) {
    return { ...base, selectable: false, unavailableReason: "Instagram coming soon" };
  }
  if (account.platform === "other") return { ...base, selectable: false, unavailableReason: "Not supported yet" };
  return { ...base, selectable: true };
}

/** Null/empty allow-list = the agency only sees the legacy account, exactly as before accounts were selectable. */
function effectiveAllowList(row: OrgSocialSettings | null): number[] {
  const ids = row?.allowedAccountIds;
  return ids && ids.length > 0 ? ids : [LEGACY_DEFAULT_ACCOUNT_ID];
}

export const socialSettingsService = {
  /**
   * Accounts the agency may post to, from the live OnlySocials list. Missing credentials is a
   * normal "not configured" state, not an error. Pass force before scheduling for a fresh list.
   */
  async listAccounts(orgId: string | null, opts: { force?: boolean } = {}): Promise<SocialAccountsResult> {
    if (!isOnlySocialsConfigured()) return { configured: false, accounts: [] };
    const row = orgId ? await socialSettingsRepository.findByOrg(orgId) : null;
    const allowed = new Set(effectiveAllowList(row));
    const live = await listOnlySocialsAccounts({ force: opts.force });
    return { configured: true, accounts: live.filter((a) => allowed.has(a.id)).map(toAccountView) };
  },

  /**
   * Accounts for the editor. A platform admin editing a post passes its id so the list is the post's agency's,
   * not the one they are currently acting in; everyone else always gets their own agency's list.
   */
  async listAccountsFor(scope: { orgId: string; orgRole: string }, dealId: string | undefined): Promise<SocialAccountsResult> {
    if (dealId && scope.orgRole === "platform_admin") {
      const dealOrg = await socialSettingsRepository.findOrgIdForDeal(dealId);
      if (dealOrg) return this.listAccounts(dealOrg);
    }
    return this.listAccounts(scope.orgId);
  },

  /**
   * Draft save: checks the ids against the agency allow-list only and looks up platforms from the cached
   * list. No forced refresh and no connection check; schedule/reschedule do the strict live check.
   */
  async resolveDraftTargets(orgId: string | null, accountIds: number[]): Promise<{ accountId: number; platform: "facebook" | "instagram" }[]> {
    if (accountIds.length === 0) throw new AppError("Choose at least one account to post to", 400);
    if (!isOnlySocialsConfigured()) throw new AppError("OnlySocials is not set up for this workspace", 503);
    const row = orgId ? await socialSettingsRepository.findByOrg(orgId) : null;
    const allowed = new Set(effectiveAllowList(row));
    const notAllowed = accountIds.find((id) => !allowed.has(id));
    if (notAllowed !== undefined) throw new AppError(`Account ${notAllowed} is not enabled for this agency`, 422);
    const live = await listOnlySocialsAccounts();
    const byId = new Map(live.map((a) => [a.id, a]));
    return Array.from(new Set(accountIds)).map((id) => {
      const account = byId.get(id);
      if (!account) throw new AppError(`Account ${id} is no longer in OnlySocials`, 422);
      return { accountId: id, platform: account.platform === "instagram" ? "instagram" : "facebook" };
    });
  },

  /** Platform admin: every workspace account, plus the org's explicit allow-list. */
  async getAllowList(orgId: string): Promise<SocialAllowListView> {
    if (!(await socialSettingsRepository.orgExists(orgId))) throw new AppError("Organization not found", 404);
    const row = await socialSettingsRepository.findByOrg(orgId);
    if (!isOnlySocialsConfigured()) return { configured: false, accounts: [], allowedAccountIds: row?.allowedAccountIds ?? [] };
    const live = await listOnlySocialsAccounts();
    return { configured: true, accounts: live.map(toAccountView), allowedAccountIds: row?.allowedAccountIds ?? [] };
  },

  /** Platform admin: replace the org's allow-list. Every id must exist in the live workspace list. */
  async setAllowList(orgId: string, accountIds: number[], userId: string | null): Promise<SocialAllowListView> {
    if (!(await socialSettingsRepository.orgExists(orgId))) throw new AppError("Organization not found", 404);
    if (!isOnlySocialsConfigured()) throw new AppError("OnlySocials is not configured", 400);
    const unique = Array.from(new Set(accountIds));
    const live = await listOnlySocialsAccounts({ force: true });
    const known = new Set(live.map((a) => a.id));
    // Ids already stored may have left the workspace: keep or remove them, but never newly add one.
    const stored = new Set((await socialSettingsRepository.findByOrg(orgId))?.allowedAccountIds ?? []);
    const unknown = unique.filter((id) => !known.has(id) && !stored.has(id));
    if (unknown.length > 0) throw new AppError(`Unknown OnlySocials account id(s): ${unknown.join(", ")}`, 400);
    const row = await socialSettingsRepository.setAllowedAccountIds(orgId, unique.length > 0 ? unique : null, userId);
    return { configured: true, accounts: live.map(toAccountView), allowedAccountIds: row.allowedAccountIds ?? [] };
  },

  async get(orgId: string): Promise<SocialSettingsView> {
    const row = await socialSettingsRepository.findByOrg(orgId);
    if (!row) return { orgId, ...DEFAULTS, timeShortcuts: [...DEFAULTS.timeShortcuts], isDefault: true };
    return toView(orgId, row);
  },

  async update(orgId: string, input: SocialSettingsInput, userId: string | null): Promise<SocialSettingsView> {
    // Whitelist: never forward unexpected keys (e.g. orgId, createdAt) to the repository.
    const data: SocialSettingsInput = {};
    if (input.defaultViewLink !== undefined) data.defaultViewLink = input.defaultViewLink;
    if (input.defaultPriceBadge !== undefined) data.defaultPriceBadge = input.defaultPriceBadge;
    if (input.timeShortcuts) data.timeShortcuts = Array.from(new Set(input.timeShortcuts)).sort();
    if (input.timezone !== undefined) {
      const tz = normaliseTimeZone(input.timezone);
      if (!tz) throw new AppError("Unknown time zone", 400);
      data.timezone = tz;
    }
    const row = await socialSettingsRepository.upsert(orgId, data, userId);
    return toView(orgId, row);
  },

  getChannel(): SocialChannelInfo {
    return getOnlySocialsChannelInfo();
  },
};

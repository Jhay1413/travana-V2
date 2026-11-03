import type { OrgSocialSettings } from "@shared/schema";
import { AppError } from "../../utils/error-handler";
import { getOnlySocialsChannelInfo } from "../../utils/only-socials";
import { socialSettingsRepository } from "./social-settings.repository";
import type { SocialChannelInfo, SocialSettingsInput, SocialSettingsView } from "./social-settings.types";

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

export const socialSettingsService = {
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

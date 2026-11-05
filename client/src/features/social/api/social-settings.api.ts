import axiosClient from "@/api/client/axios-client";

export interface SocialSettings {
  orgId: string;
  defaultViewLink: boolean;
  defaultPriceBadge: boolean;
  /** "HH:mm" quick-pick times for scheduling. */
  timeShortcuts: string[];
  timezone: string;
  /** True when the org has not saved any settings yet and defaults are served. */
  isDefault: boolean;
}

export interface SocialSettingsInput {
  defaultViewLink?: boolean;
  defaultPriceBadge?: boolean;
  timeShortcuts?: string[];
  timezone?: string;
}

export interface SocialChannelInfo {
  provider: "onlysocials";
  accountId: number;
  workspaceConfigured: boolean;
  apiKeyConfigured: boolean;
  label: string;
}

export type SocialPlatform = "facebook" | "instagram" | "other";

/** One OnlySocials account an agency may (or may not yet) post to. */
export interface SocialAccount {
  id: number;
  name: string;
  username: string | null;
  image: string | null;
  platform: SocialPlatform;
  authorized: boolean;
  selectable: boolean;
  unavailableReason?: string;
}

export interface SocialAccountsResult {
  /** False when OnlySocials credentials are missing on the server. */
  configured: boolean;
  accounts: SocialAccount[];
}

/** Platform-admin view: every workspace account plus the agency allow-list. */
export interface SocialAllowList extends SocialAccountsResult {
  allowedAccountIds: number[];
}

/** Used until the settings query resolves. */
export const DEFAULT_SOCIAL_SETTINGS: SocialSettings = {
  orgId: "",
  defaultViewLink: true,
  defaultPriceBadge: true,
  timeShortcuts: ["09:00", "12:30", "19:00"],
  timezone: "Europe/London",
  isDefault: true,
};

export const socialSettingsApi = {
  get: async (): Promise<SocialSettings> => {
    const { data: res } = await axiosClient.get<SocialSettings>("/api/v2/social-settings");
    return res;
  },

  update: async (data: SocialSettingsInput): Promise<SocialSettings> => {
    const { data: res } = await axiosClient.put<SocialSettings>("/api/v2/social-settings", data);
    return res;
  },

  /** `dealId` lets a platform admin editing another agency's post see that agency's accounts; others are unaffected. */
  getAccounts: async (dealId?: string): Promise<SocialAccountsResult> => {
    const { data: res } = await axiosClient.get<SocialAccountsResult>("/api/v2/social-settings/accounts", { params: dealId ? { dealId } : undefined });
    return res;
  },

  getChannel: async (): Promise<SocialChannelInfo> => {
    const { data: res } = await axiosClient.get<SocialChannelInfo>("/api/v2/social-settings/channel");
    return res;
  },
};

export const socialAccountAdminApi = {
  get: async (orgId: string): Promise<SocialAllowList> => {
    const { data: res } = await axiosClient.get<SocialAllowList>(`/api/v2/platform-admin/organizations/${orgId}/social-accounts`);
    return res;
  },

  set: async (orgId: string, accountIds: number[]): Promise<SocialAllowList> => {
    const { data: res } = await axiosClient.put<SocialAllowList>(`/api/v2/platform-admin/organizations/${orgId}/social-accounts`, { accountIds });
    return res;
  },
};

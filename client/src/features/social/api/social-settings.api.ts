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

  getChannel: async (): Promise<SocialChannelInfo> => {
    const { data: res } = await axiosClient.get<SocialChannelInfo>("/api/v2/social-settings/channel");
    return res;
  },
};

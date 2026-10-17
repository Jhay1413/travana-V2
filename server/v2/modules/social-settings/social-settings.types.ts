export interface SocialSettingsInput {
  defaultViewLink?: boolean;
  defaultPriceBadge?: boolean;
  timeShortcuts?: string[];
  timezone?: string;
}

export interface SocialSettingsView {
  orgId: string;
  defaultViewLink: boolean;
  defaultPriceBadge: boolean;
  timeShortcuts: string[];
  timezone: string;
  /** True when the org has no saved row and these are the built-in defaults. */
  isDefault: boolean;
}

export interface SocialChannelInfo {
  provider: "onlysocials";
  accountId: number;
  workspaceConfigured: boolean;
  apiKeyConfigured: boolean;
  label: string;
}

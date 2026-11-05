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

/** What the picker shows for each OnlySocials account an agency may use. */
export interface SocialAccountView {
  id: number;
  name: string;
  username: string | null;
  image: string | null;
  platform: "facebook" | "instagram" | "other";
  authorized: boolean;
  selectable: boolean;
  unavailableReason?: string;
}

export interface SocialAccountsResult {
  configured: boolean;
  accounts: SocialAccountView[];
}

/** Platform-admin view of an agency's allow-list: every workspace account plus which are allowed. */
export interface SocialAllowListView {
  configured: boolean;
  accounts: SocialAccountView[];
  /** Explicit allow-list; empty = the agency falls back to the legacy account only. */
  allowedAccountIds: number[];
}

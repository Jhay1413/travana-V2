import { useQuery } from "@tanstack/react-query";
import { socialAccountAdminApi, socialSettingsApi, type SocialAccountsResult, type SocialAllowList, type SocialChannelInfo, type SocialSettings } from "./social-settings.api";

export const socialSettingsKeys = {
  all: ["socialSettings"] as const,
  settings: () => [...socialSettingsKeys.all, "settings"] as const,
  accounts: (dealId?: string) => [...socialSettingsKeys.all, "accounts", dealId ?? "own"] as const,
  channel: () => [...socialSettingsKeys.all, "channel"] as const,
};

export function useSocialSettings() {
  return useQuery<SocialSettings>({
    queryKey: socialSettingsKeys.settings(),
    queryFn: () => socialSettingsApi.get(),
  });
}

export function useSocialChannel() {
  return useQuery<SocialChannelInfo>({
    queryKey: socialSettingsKeys.channel(),
    queryFn: () => socialSettingsApi.getChannel(),
  });
}

const ACCOUNTS_STALE_MS = 5 * 60 * 1000;

/** The OnlySocials accounts this agency may post to (server caches the live list for ~5 minutes too). */
export function useSocialAccounts(enabled = true, dealId?: string) {
  return useQuery<SocialAccountsResult>({
    queryKey: socialSettingsKeys.accounts(dealId),
    queryFn: () => socialSettingsApi.getAccounts(dealId),
    staleTime: ACCOUNTS_STALE_MS,
    enabled,
  });
}

/** Platform admin: every workspace account and which ones an agency may use. */
export function useSocialAllowList(orgId: string) {
  return useQuery<SocialAllowList>({
    queryKey: [...socialSettingsKeys.all, "allow-list", orgId] as const,
    queryFn: () => socialAccountAdminApi.get(orgId),
    enabled: !!orgId,
  });
}

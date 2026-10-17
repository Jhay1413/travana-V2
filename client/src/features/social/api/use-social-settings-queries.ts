import { useQuery } from "@tanstack/react-query";
import { socialSettingsApi, type SocialChannelInfo, type SocialSettings } from "./social-settings.api";

export const socialSettingsKeys = {
  all: ["socialSettings"] as const,
  settings: () => [...socialSettingsKeys.all, "settings"] as const,
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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { socialAccountAdminApi, socialSettingsApi, type SocialSettingsInput } from "./social-settings.api";
import { socialSettingsKeys } from "./use-social-settings-queries";

export function useUpdateSocialSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SocialSettingsInput) => socialSettingsApi.update(data),
    onSuccess: (settings) => {
      queryClient.setQueryData(socialSettingsKeys.settings(), settings);
    },
  });
}

export function useSetSocialAllowList(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountIds: number[]) => socialAccountAdminApi.set(orgId, accountIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: socialSettingsKeys.all });
    },
  });
}

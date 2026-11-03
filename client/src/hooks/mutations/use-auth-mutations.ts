import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/api";
import { authKeys } from "@/hooks/queries";
import { useAuthStore } from "@/stores/auth-store";
import { clearAllOnboardingDrafts } from "@/lib/onboarding-drafts";
import { clearAllTargetsDrafts } from "@/lib/targets-drafts";

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
    onSuccess: (user) => {
      queryClient.setQueryData(authKeys.currentUser(), user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      queryClient.setQueryData(authKeys.currentUser(), null);
      queryClient.clear();
      // Drop the persisted profile so the optimistic store can't flash the
      // logged-out user on the next load.
      useAuthStore.getState().clear();
      // Saved onboarding answers belong to the signed-in person, not the browser.
      clearAllOnboardingDrafts(typeof window === "undefined" ? null : window.localStorage);
      clearAllTargetsDrafts(typeof window === "undefined" ? null : window.localStorage);
      authApi.logout();
    },
  });
}

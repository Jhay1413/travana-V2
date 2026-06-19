import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/api";
import { authKeys } from "@/hooks/queries";
import { useAuthStore } from "@/stores/auth-store";

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
      authApi.logout();
    },
  });
}

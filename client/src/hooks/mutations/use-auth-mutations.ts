import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/api";
import { authKeys } from "@/hooks/queries";

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
    mutationFn: async () => authApi.logout(),
    onSuccess: () => {
      queryClient.setQueryData(authKeys.currentUser(), null);
    },
  });
}

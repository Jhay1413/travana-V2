import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/api";
import { authKeys } from "@/hooks/queries";

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => authApi.logout(),
    onSuccess: () => {
      queryClient.setQueryData(authKeys.currentUser(), null);
    },
  });
}

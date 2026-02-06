import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/api";
import type { AuthUser } from "@/types/auth";

export const authKeys = {
  all: ["auth"] as const,
  currentUser: () => [...authKeys.all, "currentUser"] as const,
};

export function useCurrentUser() {
  return useQuery<AuthUser | null>({
    queryKey: authKeys.currentUser(),
    queryFn: authApi.getCurrentUser,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}

import { useCurrentUser } from "@/hooks/queries";
import { useLogout } from "@/hooks/mutations";

export function useAuth() {
  const { data: user, isLoading } = useCurrentUser();
  const logoutMutation = useLogout();

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}

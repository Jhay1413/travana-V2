import { useLogout } from "@/hooks/mutations";
import { useAuthStore } from "@/stores/auth-store";

// Reads the global auth store (hydrated by useAuthSync from the backend) instead
// of running its own session query, so the 28+ call sites share one validated
// source of truth without each triggering a check.
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const logoutMutation = useLogout();

  return {
    user,
    // Only block the UI when we genuinely know nothing yet (no persisted user and
    // the first backend validation hasn't resolved). A persisted user renders
    // optimistically while it revalidates in the background.
    isLoading: status === "unknown" && !user,
    isAuthenticated: status === "authenticated" || (status === "unknown" && !!user),
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}

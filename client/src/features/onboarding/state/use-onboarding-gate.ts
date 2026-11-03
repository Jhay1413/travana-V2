import { useRole } from "@/hooks/use-role";
import { useAuthStore } from "@/stores/auth-store";
import { canRunOnboarding } from "../lib/access";
import { hasOnboardingBypass } from "../lib/bypass";
import { isStateLoadFailure } from "../lib/gate";
import { useOnboardingState } from "../api/use-onboarding-queries";

/**
 * Whether the signed-in user should be sent to the wizard. Only org admins are ever asked
 * (the endpoint is org-admin only); a failed lookup never blocks the app.
 */
export function useOnboardingGate() {
  const { orgRole } = useRole();
  const userId = useAuthStore((s) => s.user?.id ?? "");
  const isOrgAdmin = canRunOnboarding(orgRole);
  const query = useOnboardingState({ enabled: isOrgAdmin });
  return {
    isOrgAdmin,
    isLoading: isOrgAdmin && query.isLoading,
    isError: isOrgAdmin && isStateLoadFailure(query),
    isPending: isOrgAdmin && query.data?.status === "pending",
    bypassed: typeof window !== "undefined" && hasOnboardingBypass(window.sessionStorage, userId),
    state: query.data,
  };
}

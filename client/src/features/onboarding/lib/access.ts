import type { OrgRole } from "@/types/auth/auth.types";

/**
 * Who may run onboarding. The server guards every /onboarding route with requireOrgRole(['org_admin']),
 * which checks the caller's single PRIMARY role (not the full role list), so the client uses the same
 * primary role (`useRole().orgRole`) for the route guard, the redirect gate and the /state call.
 */
export function canRunOnboarding(primaryOrgRole: OrgRole | null | undefined): boolean {
  return primaryOrgRole === "org_admin";
}

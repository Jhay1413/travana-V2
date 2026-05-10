import { useCallback } from "react";
import { useCurrentUser } from "./queries";
import type { Role, OrgRole } from "@/types/auth/auth.types";
import { can as canPerm, canAccessModule, type Module, type Action } from "@/lib/permissions";

function normalizeRole(raw?: string): Role {
  if (!raw) return "Agent";
  const lower = raw.toLowerCase();
  if (lower === "platformadmin" || lower === "platform_admin" || lower === "platform admin") return "PlatformAdmin";
  if (lower === "owner" || lower === "agency_owner" || lower === "agency owner") return "Admin";
  if (lower === "admin") return "Admin";
  if (lower === "manager") return "Manager";
  if (lower === "homeworker") return "Homeworker";
  if (lower === "referer" || lower === "referral_agent" || lower === "referral agent") return "Referer";
  return "Agent";
}

function deriveOrgRoleFromRole(role: Role): OrgRole {
  switch (role) {
    case "PlatformAdmin": return "platform_admin";
    case "Admin": return "org_admin";
    case "Manager": return "branch_manager";
    case "Homeworker": return "homeworker";
    case "Referer": return "referral_agent";
    default: return "agent";
  }
}

function roleFromOrgRole(orgRole: OrgRole | null | undefined): Role | null {
  switch (orgRole) {
    case "platform_admin": return "PlatformAdmin";
    case "org_admin":      return "Admin";
    case "branch_manager": return "Manager";
    case "agent":          return "Agent";
    case "homeworker":     return "Homeworker";
    case "referral_agent": return "Referer";
    default:               return null;
  }
}

export function useRole() {
  const { data: user } = useCurrentUser();

  const orgRole: OrgRole = (user?.orgRole as OrgRole | undefined) ?? deriveOrgRoleFromRole(normalizeRole(user?.role));
  const role: Role = roleFromOrgRole(orgRole) ?? normalizeRole(user?.role);

  const can = useCallback(
    (action: Action, mod: Module, scope: "own" | "any" = "any") => canPerm(role, action, mod, scope),
    [role]
  );
  const canAccess = useCallback((mod: Module) => canAccessModule(role, mod), [role]);

  return { role, orgRole, can, canAccess };
}

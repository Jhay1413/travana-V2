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
  if (lower === "socialmediamanager" || lower === "social_media_manager" || lower === "social media manager") return "SocialMediaManager";
  return "Agent";
}

function deriveOrgRoleFromRole(role: Role): OrgRole {
  switch (role) {
    case "PlatformAdmin": return "platform_admin";
    case "Admin": return "org_admin";
    case "Manager": return "branch_manager";
    case "Homeworker": return "homeworker";
    case "Referer": return "referral_agent";
    case "SocialMediaManager": return "social_media_manager";
    default: return "agent";
  }
}

function roleFromOrgRole(orgRole: OrgRole | null | undefined): Role | null {
  switch (orgRole) {
    case "platform_admin":       return "PlatformAdmin";
    case "org_admin":            return "Admin";
    case "branch_manager":       return "Manager";
    case "agent":                return "Agent";
    case "homeworker":           return "Homeworker";
    case "referral_agent":       return "Referer";
    case "social_media_manager": return "SocialMediaManager";
    default:                     return null;
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

/**
 * Multi-role aware companion to useRole(). Returns the FULL set of org-level
 * roles the user holds in their current org (the union of user_org_roles +
 * any active branch_members.orgRole), plus the derived primary.
 *
 * Existing call sites that only care about the primary role should keep using
 * useRole(). New code that wants union-aware behavior (e.g. merged nav,
 * "does the user have at least one of these roles?") should use useRoles().
 */
export function useRoles() {
  const { data: user } = useCurrentUser();

  // Prefer the explicit array from the backend; fall back to a singleton from
  // the primary role for any path that hasn't been migrated to return orgRoles
  // yet (e.g. older cached payloads).
  const primary: OrgRole | null =
    (user?.orgRole as OrgRole | undefined) ?? null;

  const roles: OrgRole[] =
    user?.orgRoles && user.orgRoles.length > 0
      ? (user.orgRoles as OrgRole[])
      : primary
        ? [primary]
        : [];

  return {
    roles,
    primary,
    hasRole:    (r: OrgRole)    => roles.includes(r),
    hasAnyRole: (rs: OrgRole[]) => rs.some((r) => roles.includes(r)),
  };
}

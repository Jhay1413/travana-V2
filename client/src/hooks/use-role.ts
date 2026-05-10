import { useCallback, useEffect, useState } from "react";
import { useCurrentUser } from "./queries";
import type { Role, OrgRole } from "@/types/auth/auth.types";
import { can as canPerm, canAccessModule, type Module, type Action } from "@/lib/permissions";

const ROLE_KEY = "apple-travel-role-preview";

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

export function useRole() {
  const { data: user } = useCurrentUser();
  const actualRole: Role = normalizeRole(user?.role);
  const actualOrgRole: OrgRole = user?.orgRole ?? deriveOrgRoleFromRole(actualRole);

  const [rolePreview, setRolePreview] = useState<Role | null>(() => {
    const saved = sessionStorage.getItem(ROLE_KEY);
    if (saved) return saved as Role;
    return "Agent";
  });

  useEffect(() => {
    const handler = () => {
      const saved = sessionStorage.getItem(ROLE_KEY);
      setRolePreview((saved as Role) || "Agent");
    };
    window.addEventListener("role-preview-updated", handler);
    return () => window.removeEventListener("role-preview-updated", handler);
  }, []);

  const role: Role = rolePreview || actualRole;
  const orgRole: OrgRole = rolePreview ? deriveOrgRoleFromRole(rolePreview) : actualOrgRole;

  const setRole = useCallback((r: Role) => {
    sessionStorage.setItem(ROLE_KEY, r);
    setRolePreview(r);
    try { window.dispatchEvent(new Event("role-preview-updated")); } catch {}
  }, []);

  const can = useCallback(
    (action: Action, mod: Module, scope: "own" | "any" = "any") => canPerm(role, action, mod, scope),
    [role]
  );
  const canAccess = useCallback((mod: Module) => canAccessModule(role, mod), [role]);

  return { role, orgRole, setRole, actualRole, actualOrgRole, can, canAccess };
}

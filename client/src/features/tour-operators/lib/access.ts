import type { OrgRole } from "@/types/auth/auth.types";

const WRITERS: OrgRole[] = ["platform_admin", "org_admin", "branch_manager"];

/** Mirrors the server: writers see plain passwords and can change the list. */
export function operatorAccess(orgRole: OrgRole | null | undefined): { canWrite: boolean; canSeePasswords: boolean } {
  const ok = !!orgRole && WRITERS.includes(orgRole);
  return { canWrite: ok, canSeePasswords: ok };
}

/** The breadcrumb root for each role. */
export function breadcrumbFor(orgRole: OrgRole | null | undefined): { label: string; href: string } {
  if (orgRole === "org_admin" || orgRole === "platform_admin") return { label: "Admin Dashboard", href: "/agency/overview" };
  if (orgRole === "branch_manager") return { label: "Dashboard", href: "/branch-overview" };
  return { label: "Home", href: "/agent-overview" };
}

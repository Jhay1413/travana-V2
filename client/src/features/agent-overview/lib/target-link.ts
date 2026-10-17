import type { OrgRole } from "@/types/auth/auth.types";

/**
 * Where the current user can set targets, if anywhere, from their primary role (the one
 * route guards use). Agency admins use the agency targets page and branch managers the
 * branch one; homeworkers set their own on My targets; everyone else gets no link.
 */
export function targetHrefForRole(role: OrgRole | null | undefined): string | null {
  if (role === "org_admin" || role === "platform_admin") return "/agency/targets";
  if (role === "branch_manager") return "/branch/targets";
  if (role === "homeworker") return "/my-targets";
  return null;
}

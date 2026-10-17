import type { Request } from "express";
import { getUserId } from "./get-user-id";

export type OrgRole =
  | "platform_admin"
  | "org_admin"
  | "branch_manager"
  | "agent"
  | "homeworker"
  | "referral_agent"
  | "social_media_manager";

/**
 * Per-request scope.
 *
 * Two role fields:
 * - `orgRole` (primary, highest-ranked) — use for ROLE-BASED DATA SCOPING
 *   ("an agent only sees their own clients"). The primary reflects the most
 *   privileged identity the user has and therefore the broadest data view
 *   they're entitled to.
 * - `orgRoles` (full union) — use for PERMISSION ALLOWLISTS ("does this user
 *   have ANY of these capabilities?"). Prefer this when checking whether an
 *   action is permitted.
 *
 * Do NOT swap one for the other casually:
 *   - `orgRoles.includes('agent')` returns true for an org_admin+agent combo,
 *     which would WRONGLY apply agent-scoped filtering and hide their org-wide view.
 *   - `orgRole === 'branch_manager'` returns false for an org_admin who also
 *     happens to be a branch_manager, which would correctly skip the
 *     branch-only restrictions because they have admin privilege.
 */
export interface Scope {
  orgId: string;
  branchId: string | null;
  orgRole: OrgRole;
  orgRoles: OrgRole[];
  userId: string | null;
  /** Partition of the caller's active branch; null when they have none. */
  branchType: "shop" | "homeworker" | null;
  /** True only when the caller is inside a homeworker branch they own. */
  ownsHomeworkerBranch: boolean;
}

export function getScope(req: Request): Scope {
  return {
    orgId: req.orgId,
    branchId: req.branchId,
    orgRole: (req.orgRole || "agent") as OrgRole,
    orgRoles: (req.orgRoles ?? (req.orgRole ? [req.orgRole] : [])) as OrgRole[],
    userId: getUserId(req),
    branchType: req.branchType ?? null,
    ownsHomeworkerBranch: req.ownsHomeworkerBranch === true,
  };
}

/**
 * Does the caller hold the homeworker role at all? Checks the full role union,
 * not just the primary: homeworker ranks below agent, so a legacy user holding
 * {homeworker, agent} has primary 'agent' and would otherwise slip through.
 */
export function holdsHomeworkerRole(scope: Pick<Scope, "orgRole"> & { orgRoles?: OrgRole[] }): boolean {
  return scope.orgRole === "homeworker" || (scope.orgRoles ?? []).includes("homeworker");
}

/** Permission allowlist: does the user have ANY of these roles? */
export function hasAnyRole(userRoles: OrgRole[] | undefined, allowed: OrgRole[]): boolean {
  if (!userRoles || userRoles.length === 0) return false;
  return userRoles.some((r) => allowed.includes(r));
}

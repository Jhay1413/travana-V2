import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";
import type { AgentProfileAccess } from "./agent-profile.types";

/**
 * Who may open an agent profile, and how widely. Applied by every endpoint:
 * - no organisation in scope: 403 (a platform admin must be acting inside one);
 * - org_admin / platform_admin: any member of the organisation;
 * - branch_manager: only members of their own branch (needs a branch context).
 */
export function resolveAccess(scope: Scope): AgentProfileAccess {
  if (!scope.orgId) throw new AppError("Select an organisation first", 403);
  const isAdmin = scope.orgRole === "org_admin" || scope.orgRole === "platform_admin";
  if (isAdmin) return { orgId: scope.orgId, branchId: null, isAdmin: true, canSeePay: true };
  if (!scope.branchId) throw new AppError("No branch context", 403);
  return { orgId: scope.orgId, branchId: scope.branchId, isAdmin: false, canSeePay: false };
}

/**
 * The subject must have a membership row in the organisation (active or not) and, for a branch
 * manager, one in the manager's branch. Anything else is "not found", never "forbidden", so the
 * endpoint cannot be used to probe who exists elsewhere.
 */
export function assertSubject(access: AgentProfileAccess, memberships: { branchId: string }[]): void {
  if (memberships.length === 0) throw new AppError("Agent not found", 404);
  if (!access.isAdmin && !memberships.some((m) => m.branchId === access.branchId)) {
    throw new AppError("Agent not found", 404);
  }
}

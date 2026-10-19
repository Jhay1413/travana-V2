import type { Scope } from "../../utils/scope";
import { agentProfileRepository } from "./agent-profile.repository";
import { assertSubject, resolveAccess } from "./agent-profile.access";
import type {
  AgentProfileAccess,
  AgentProfileComparator,
  DealFilter,
  MembershipRow,
} from "./agent-profile.types";

/** Everything an endpoint needs once access to the subject has been proven. */
export interface SubjectContext {
  access: AgentProfileAccess;
  userId: string;
  /** The subject's memberships the viewer may see (a branch manager sees only their own branch). */
  memberships: MembershipRow[];
  /** Earliest membership of the subject anywhere in the organisation (a date only is ever shown). */
  earliestJoinedAt: Date | null;
  /** Deal filter for the subject's own figures. */
  subjectFilter: DealFilter;
  /** Deal filter for the comparator: the organisation for admins, the manager's branch otherwise. */
  comparatorFilter: DealFilter;
}

/**
 * Resolves the caller's access, loads the subject's memberships and fails with 403/404 before any
 * data is read. Shared by every endpoint.
 */
export async function loadSubjectContext(scope: Scope, userId: string): Promise<SubjectContext> {
  const access = resolveAccess(scope);
  const all = await agentProfileRepository.listMemberships(userId, access.orgId);
  assertSubject(access, all);
  const memberships = access.isAdmin ? all : all.filter((m) => m.branchId === access.branchId);
  const branchId = access.branchId ?? undefined;
  return {
    access,
    userId,
    memberships,
    earliestJoinedAt: all.reduce<Date | null>((min, m) => (min === null || m.joinedAt < min ? m.joinedAt : min), null),
    subjectFilter: { orgId: access.orgId, branchId, userId },
    comparatorFilter: { orgId: access.orgId, branchId },
  };
}

/**
 * Who the figures are compared with. NOTE (accepted risk): the window comparator is defined through
 * client_table.org_id while the monthly comparator uses the targets actuals (branch/org by
 * transaction branch), so the two can differ slightly for deals with no client or a moved branch.
 */
export async function resolveComparator(ctx: SubjectContext): Promise<AgentProfileComparator> {
  if (!ctx.access.isAdmin) {
    const branch = ctx.memberships.find((m) => m.branchId === ctx.access.branchId);
    return { scope: "branch", label: branch?.branchName ?? "Your branch" };
  }
  const name = await agentProfileRepository.findOrganisationName(ctx.access.orgId);
  return { scope: "organisation", label: name ?? "Your agency" };
}

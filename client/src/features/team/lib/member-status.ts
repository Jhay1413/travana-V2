import type { OrgMember } from "@/features/organization/api/organization.api";
import type { MemberStatus } from "../types";
import { isMemberSuspended } from "./role-helpers";

export function memberStatus(m: OrgMember): MemberStatus {
  return isMemberSuspended(m) ? "suspended" : "active";
}

export function isSelf(m: OrgMember, currentUserId: string | null | undefined): boolean {
  return !!currentUserId && m.user.id === currentUserId;
}

export function isHomeworkerMember(m: OrgMember): boolean {
  return m.user.orgRole === "homeworker";
}

/** An admin or branch manager who also holds the agent role (shown read-only as "Also sells"). */
export function alsoSells(m: OrgMember): boolean {
  const primary = m.user.orgRole;
  if (primary !== "org_admin" && primary !== "branch_manager") return false;
  return (m.roles ?? []).includes("agent");
}

export function activeBranches(m: OrgMember): OrgMember["branches"] {
  return m.branches.filter((b) => b.isActive);
}

/** Status word shown next to the dot: never colour alone. */
export const STATUS_WORD: Record<MemberStatus | "invited", string> = {
  active: "Active",
  suspended: "Suspended",
  invited: "Invited",
};

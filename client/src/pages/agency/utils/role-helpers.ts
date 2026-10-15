import type { OrgMember } from "@/features/organization/api/organization.api";

export const ASSIGNABLE_ROLES = [
  { value: "org_admin",            label: "Owner / Admin" },
  { value: "branch_manager",       label: "Branch Manager" },
  { value: "agent",                label: "Agent" },
  { value: "homeworker",           label: "Homeworker" },
  { value: "social_media_manager", label: "Social Media Manager" },
  { value: "referral_agent",       label: "Referral Agent" },
] as const;

export function roleLabel(orgRole: string | null | undefined): string {
  return ASSIGNABLE_ROLES.find((r) => r.value === orgRole)?.label ?? "Agent";
}

export function isMemberSuspended(m: OrgMember): boolean {
  if (m.user.banned) return true;
  if (m.branches.length === 0) return false;
  return m.branches.every((b) => !b.isActive);
}

export const HOMEWORKER_ROLE_LOCK_HINT = "Homeworkers are invite-only; archive instead";

/**
 * Options for a member's role dropdown. Homeworker is invite-only, so it is only
 * listed for members who already are homeworkers (where the control is disabled).
 */
export function roleOptionsForMember(currentRole: string | null | undefined): Array<{ value: string; label: string }> {
  return currentRole === "homeworker"
    ? [...ASSIGNABLE_ROLES]
    : ASSIGNABLE_ROLES.filter((r) => r.value !== "homeworker");
}

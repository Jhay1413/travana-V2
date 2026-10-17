import type { InviteBodyFor, InviteOrgRole } from "@/features/invite/api/invite.api";

export type InviteRoleValue = InviteOrgRole;
export type InviteBody = InviteBodyFor<InviteOrgRole>;

export interface InviteFormValues<R extends InviteOrgRole = InviteOrgRole> {
  email: string;
  orgRole: R;
  branchId: string;
  profitSharePercent: string;
  displayName: string;
}

/**
 * Shapes the invite POST body. Homeworkers carry no branchId (the server creates
 * their branch) and optionally a share and display name; every other role needs a branch.
 */
export function buildInviteBody<R extends InviteOrgRole>(v: InviteFormValues<R>): InviteBodyFor<R> {
  const email = v.email.trim();
  if (v.orgRole === "homeworker") {
    const share = v.profitSharePercent.trim();
    const name = v.displayName.trim();
    const body: InviteBodyFor<"homeworker"> = {
      email,
      orgRole: "homeworker",
      ...(share ? { profitSharePercent: share } : {}),
      ...(name ? { displayName: name } : {}),
    };
    return body as InviteBodyFor<R>;
  }
  const body = { email, orgRole: v.orgRole, branchId: v.branchId };
  return body as InviteBodyFor<R>;
}

export const MAX_NAME_LENGTH = 120;

/** Mirrors the server: display/branch names are trimmed and at most 120 characters. */
export function isValidName(name: string): boolean {
  const n = name.trim();
  return n.length > 0 && n.length <= MAX_NAME_LENGTH;
}

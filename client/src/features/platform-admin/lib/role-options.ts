export const HOMEWORKER_INVITE_ONLY_HINT = "Homeworkers are invite-only; archive instead";

/**
 * Roles that can be added to a user. 'homeworker' is never addable (invite-only);
 * referral_agent and internal roles stay mutually exclusive.
 */
export function addableRoles<R extends string>(
  current: readonly R[],
  all: readonly R[],
  internal: ReadonlySet<R>,
): R[] {
  const has = new Set(current);
  const hasReferral = current.includes("referral_agent" as R);
  const hasInternal = current.some((r) => internal.has(r));
  return all.filter((r) => {
    if (r === ("homeworker" as R)) return false;
    if (has.has(r)) return false;
    if (r === ("referral_agent" as R) && hasInternal) return false;
    if (internal.has(r) && hasReferral) return false;
    return true;
  });
}

/** Homeworker membership is managed through the homeworkers feature, not role editing. */
export function isHomeworkerLocked(current: readonly string[]): boolean {
  return current.includes("homeworker");
}

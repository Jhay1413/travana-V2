/** Prefix of user.banReason written when an admin removes a member from Teams & Roles. */
export const REMOVED_REASON_PREFIX = 'Removed by ';

/** True for a login deactivated by Remove (banned with the "Removed by ..." reason). */
export function isRemovedUser(user: { banned?: boolean | null; banReason?: string | null }): boolean {
  return Boolean(user.banned) && (user.banReason ?? '').startsWith(REMOVED_REASON_PREFIX);
}

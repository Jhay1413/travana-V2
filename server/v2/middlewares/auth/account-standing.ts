import type { Request, Response } from 'express';

export type AccountBlockCode = 'ACCOUNT_SUSPENDED' | 'ACCOUNT_DEACTIVATED';

export interface AccountBlock {
  code: AccountBlockCode;
  message: string;
}

export interface AccountStandingUser {
  banned?: boolean | null;
  role?: string | null;
  inviteToken?: string | null;
}

/** Membership counts across all of a user's branch_members rows. */
export interface MembershipStanding {
  total: number;
  active: number;
}

export const DEACTIVATED_BLOCK: AccountBlock = {
  code: 'ACCOUNT_DEACTIVATED',
  message: 'Your account has been deactivated. Contact your agency admin.',
};

export const SUSPENDED_BLOCK: AccountBlock = {
  code: 'ACCOUNT_SUSPENDED',
  message: 'Your account has been suspended. Contact your agency admin.',
};

/**
 * Single source of truth for "may this account use the app?".
 *  - banned (deactivated or removed) is refused first, platform admins included;
 *  - platform admins are otherwise always allowed (impersonation is unchanged);
 *  - a pending invite is allowed (its membership is inactive until accepted);
 *  - has memberships but none active = suspended;
 *  - no memberships at all = legacy / unassigned user, allowed.
 * `standing` may be null when the caller has not loaded it (only the ban check applies).
 */
export function accountBlock(
  user: AccountStandingUser,
  standing: MembershipStanding | null,
): AccountBlock | null {
  if (user.banned) return DEACTIVATED_BLOCK;
  if (user.role === 'platform_admin') return null;
  if (user.inviteToken != null) return null;
  if (standing && standing.total > 0 && standing.active === 0) return SUSPENDED_BLOCK;
  return null;
}

/**
 * Ends a blocked session: logs out, destroys the session row, clears the cookie
 * and answers 401 with the block code (the client's 401 handler re-checks auth).
 * Errors while tearing down are ignored; the response is always sent.
 */
export function rejectBlockedSession(req: Request, res: Response, block: AccountBlock): void {
  const finish = () => {
    res.clearCookie('connect.sid');
    res.status(401).json({ message: block.message, code: block.code });
  };
  const destroy = () => {
    if (req.session) req.session.destroy(() => finish());
    else finish();
  };
  if (typeof req.logout === 'function') req.logout(() => destroy());
  else destroy();
}

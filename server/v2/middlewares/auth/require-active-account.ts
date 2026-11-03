import type { Request, Response, NextFunction } from 'express';
import { authStorage } from './storage';
import { getUserId } from '../../utils/get-user-id';
import { isOrgSuspendedFor, rejectBlockedSession, rejectOrgSuspended } from './account-standing';
import { resolveAccountBlock } from './resolve-account-block';
import { branchMemberRepository } from '../../modules/branch-member/branch-member.repository';
import { organizationRepository } from '../../modules/organization/organization.repository';

/**
 * For routes behind isAuthenticated that do not go through orgBranchScope (the
 * /api/auth self-service handlers): a deactivated or suspended account loses its
 * session instead of changing its password, profile or avatar, and staff of a
 * suspended organisation get 403 ORG_SUSPENDED (session kept, so unsuspending
 * restores access at once). Platform admins are exempt from the org check.
 * Same order as orgBranchScope: the account block first, then the org check.
 */
export async function requireActiveAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const dbUser = await authStorage.getUser(userId);
    if (!dbUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const isPlatformAdmin = dbUser.role === 'platform_admin';
    const membership = isPlatformAdmin ? null : await branchMemberRepository.findActiveContextByUserId(userId);

    const block = await resolveAccountBlock(dbUser, Boolean(membership));
    if (block) {
      rejectBlockedSession(req, res, block);
      return;
    }

    if (!isPlatformAdmin) {
      const orgId = membership?.orgId ?? dbUser.orgId ?? null;
      if (orgId) {
        const orgIsActive = membership ? membership.orgIsActive : (await organizationRepository.findById(orgId))?.isActive;
        if (isOrgSuspendedFor(dbUser, orgIsActive)) {
          rejectOrgSuspended(res);
          return;
        }
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

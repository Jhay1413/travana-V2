import { Request, Response, NextFunction } from 'express';
import { authStorage } from './auth/storage';
import { branchMemberRepository } from '../modules/branch-member/branch-member.repository';
import { userOrgRolesRepository } from '../modules/user-org-roles/user-org-roles.repository';
import { primaryRole } from '../modules/user-org-roles/user-org-roles.service';
import { getUserId } from '../../utils/get-user-id';
import { accountBlock, rejectBlockedSession } from './auth/account-standing';
import { resolveAccountBlock } from './auth/resolve-account-block';

export async function orgBranchScope(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionUser = (req as any).user;
  const userId = getUserId(req) ?? sessionUser?.userId ?? sessionUser?.id;

  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const dbUser = await authStorage.getUser(userId);
  if (!dbUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  // Banned (deactivated or removed) accounts are refused before anything else,
  // platform admins included. Their session is destroyed so the cookie is dead.
  const banBlock = accountBlock(dbUser, null);
  if (banBlock) {
    rejectBlockedSession(req, res, banBlock);
    return;
  }

  if (dbUser.role === 'platform_admin') {
    // Impersonating: scope the request to the target org as if we were an org_admin there.
    // This makes tenant services apply org filtering instead of the cross-tenant
    // short-circuit (e.g. booking.service.ts effectiveOrgId).
    const impersonateOrgId = req.session?.impersonateOrgId;
    if (impersonateOrgId) {
      req.orgId    = impersonateOrgId;
      req.branchId = null;
      req.orgRoles = ['org_admin'];
      req.orgRole  = 'org_admin';
      req.branchType = null;
      req.ownsHomeworkerBranch = false;
      return next();
    }

    req.orgId    = '';
    req.branchId = null;
    req.orgRoles = ['platform_admin'];
    req.orgRole  = 'platform_admin';
    req.branchType = null;
    req.ownsHomeworkerBranch = false;
    return next();
  }

  const membership = await branchMemberRepository.findActiveContextByUserId(userId);

  // Suspension = memberships exist but none is active. The standing query only runs
  // when there is no active context, so the normal request pays nothing extra.
  const block = await resolveAccountBlock(dbUser, Boolean(membership));
  if (block) {
    rejectBlockedSession(req, res, block);
    return;
  }

  const orgId      = membership?.orgId ?? dbUser.orgId ?? null;

  if (!orgId) {
    res.status(403).json({ message: 'No organisation context' });
    return;
  }

  // Effective roles = junction-table set ∪ active branch membership role.
  // Fall back to legacy user.orgRole if the junction is somehow empty (backfill
  // should have prevented this, but stay defensive for edge cases).
  const fromJunction = await userOrgRolesRepository.findRolesByUserAndOrg(userId, orgId);
  const roleSet      = new Set<string>(fromJunction);
  if (membership?.orgRole) roleSet.add(membership.orgRole);
  if (roleSet.size === 0 && dbUser.orgRole) roleSet.add(dbUser.orgRole);

  const roles = Array.from(roleSet);
  req.orgId    = orgId;
  req.branchId = membership?.branchId ?? null;
  req.branchType = membership ? (membership.branchType === 'homeworker' ? 'homeworker' : 'shop') : null;
  req.ownsHomeworkerBranch = membership?.branchType === 'homeworker' && membership.ownerUserId === userId;
  req.orgRoles = roles;
  req.orgRole  = primaryRole(roles) ?? (dbUser.orgRole ?? '');
  return next();
}

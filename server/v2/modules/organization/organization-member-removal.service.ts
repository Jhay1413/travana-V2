import { AppError } from '../../utils/error-handler';
import type { RequestActor } from '../../utils/request-actor';
import { REMOVED_REASON_PREFIX, isRemovedUser } from '../../utils/removed-user';
import { branchMemberRepository } from '../branch-member/branch-member.repository';
import { userRepository } from '../user/user.repository';
import { userAccessService } from '../user/user-access.service';
import { userOrgRolesRepository } from '../user-org-roles/user-org-roles.repository';
import { organizationAuditService } from './organization-audit.service';
import { organizationMemberRemovalRepository } from './organization-member-removal.repository';
import type { MemberWorkload, RemoveMemberResult } from './organization.types';

export interface RemoveMemberInput {
  newOwnerId?: string;
}

const OWNER_ROLES = ['org_admin', 'branch_manager', 'agent'];

function totalWork(w: MemberWorkload): number {
  return w.openDeals + w.openTasks + w.openTickets + w.clients;
}

async function roleUnion(userId: string, orgId: string, primary: string | null): Promise<string[]> {
  const junction = await userOrgRolesRepository.findRolesByUserAndOrg(userId, orgId);
  return primary ? [...junction, primary] : junction;
}

async function findMemberInOrg(orgId: string, userId: string) {
  const target = await userRepository.findById(userId);
  if (!target || target.orgId !== orgId) {
    throw new AppError('Member not found in this organisation', 404);
  }
  return target;
}

/** Validates the person taking over and returns the branch deals will move into. */
async function resolveNewOwner(orgId: string, removedId: string, newOwnerId: string): Promise<string> {
  if (newOwnerId === removedId) {
    throw new AppError('Choose someone other than the person being removed', 400);
  }
  const owner = await userRepository.findById(newOwnerId);
  if (!owner || owner.orgId !== orgId || owner.role === 'platform_admin' || owner.banned || owner.inviteToken) {
    throw new AppError('The new owner must be an active member of this organisation', 400);
  }
  const roles = await roleUnion(newOwnerId, orgId, owner.orgRole ?? null);
  if (roles.includes('homeworker') || !roles.some((r) => OWNER_ROLES.includes(r))) {
    throw new AppError('Homeworkers, referral partners and social media managers cannot take over work', 400);
  }
  const ctx = await branchMemberRepository.findActiveContextByUserIdInOrg(newOwnerId, orgId);
  if (!ctx || ctx.branchType === 'homeworker') {
    throw new AppError('The new owner needs an active branch', 400);
  }
  return ctx.branchId;
}

export const organizationMemberRemovalService = {
  async getWorkload(orgId: string, userId: string): Promise<MemberWorkload> {
    await findMemberInOrg(orgId, userId);
    return organizationMemberRemovalRepository.countWorkload(orgId, userId);
  },

  /**
   * Remove = hand over open work, then deactivate (history is kept). The data
   * change is one DB transaction; sessions are deleted only after it commits.
   */
  async remove(orgId: string, userId: string, input: RemoveMemberInput, actor: RequestActor): Promise<RemoveMemberResult> {
    if (actor.userId === userId) throw new AppError('You cannot remove yourself', 400);

    const target = await findMemberInOrg(orgId, userId);
    if (target.role === 'platform_admin') throw new AppError('Platform admins cannot be removed', 400);
    if (isRemovedUser(target)) throw new AppError('This member has already been removed', 409);
    if (target.banned) throw new AppError('This user is deactivated by a platform admin', 409);
    if (target.inviteToken) throw new AppError('Revoke the invite instead', 400);

    const roles = await roleUnion(userId, orgId, target.orgRole ?? null);
    if (roles.includes('homeworker')) throw new AppError('Homeworkers are archived, not removed', 400);

    const workload = await organizationMemberRemovalRepository.countWorkload(orgId, userId);
    let newOwnerId: string | null = null;
    let newOwnerBranchId: string | null = null;
    if (totalWork(workload) > 0) {
      if (!input.newOwnerId) {
        throw new AppError('Choose who takes over their open work', 400);
      }
      newOwnerBranchId = await resolveNewOwner(orgId, userId, input.newOwnerId);
      newOwnerId = input.newOwnerId;
    }

    const actorUser = await userRepository.findById(actor.userId);
    const actorName = actorUser?.name?.trim() || 'an admin';

    const moved = await organizationMemberRemovalRepository.reassignAndDeactivate({
      orgId,
      userId,
      newOwnerId,
      newOwnerBranchId,
      banReason: `${REMOVED_REASON_PREFIX}${actorName}`,
    });

    // Committed: now (and only now) kill their sessions in the session store's database.
    const sessionsDeleted = await userAccessService.revokeAccess(userId);
    await organizationAuditService.record({
      actor,
      action: 'member.remove',
      orgId,
      targetUserId: userId,
      metadata: { newOwnerId, moved, sessionsDeleted },
    });

    return { userId, moved };
  },
};

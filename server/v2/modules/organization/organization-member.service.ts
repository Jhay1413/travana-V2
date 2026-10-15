import { AppError } from '../../utils/error-handler';
import { branchMemberRepository } from '../branch-member/branch-member.repository';
import { branchRepository } from '../branch/branch.repository';
import { userRepository } from '../user/user.repository';
import { homeworkerService } from '../homeworker/homeworker.service';
import { userOrgRolesRepository } from '../user-org-roles/user-org-roles.repository';
import { assertNoHomeworkerRoleChange, HOMEWORKER_INVITE_ONLY_MESSAGE } from '../../utils/homeworker-role';

const ALLOWED_ORG_ROLES = ['org_admin', 'branch_manager', 'agent', 'homeworker', 'referral_agent', 'social_media_manager'] as const;
type OrgRole = (typeof ALLOWED_ORG_ROLES)[number];

function assertRole(role: string): asserts role is OrgRole {
  if (!ALLOWED_ORG_ROLES.includes(role as OrgRole)) {
    throw new AppError(`Invalid org role: ${role}`, 400);
  }
}

async function findMemberInOrg(userId: string, orgId: string) {
  const target = await userRepository.findById(userId);
  if (!target || target.orgId !== orgId) {
    throw new AppError('Member not found in this organisation', 404);
  }
  return target;
}

/** Full role union: junction rows plus the primary role (catches a legacy {agent, homeworker} user). */
async function loadRoleUnion(userId: string, orgId: string, primary: string | null): Promise<string[]> {
  const junction = await userOrgRolesRepository.findRolesByUserAndOrg(userId, orgId);
  return primary ? [...junction, primary] : junction;
}

export const orgMemberService = {
  async list(orgId: string) {
    return branchMemberRepository.listOrgMembersWithBranches(orgId);
  },

  async updateRole(orgId: string, userId: string, newRole: string, actingUserId: string | null) {
    assertRole(newRole);
    if (actingUserId === userId && newRole !== 'org_admin') {
      throw new AppError('You cannot demote yourself', 400);
    }

    const target = await findMemberInOrg(userId, orgId);
    assertNoHomeworkerRoleChange(await loadRoleUnion(userId, orgId, target.orgRole ?? null), newRole);
    await branchMemberRepository.setOrgRoleAtomic(orgId, userId, newRole);

    return { userId, orgRole: newRole };
  },

  async setSuspended(orgId: string, userId: string, suspended: boolean, actingUserId: string | null) {
    if (actingUserId === userId) {
      throw new AppError('You cannot suspend your own account', 400);
    }

    await findMemberInOrg(userId, orgId);
    // An archived homeworker is offboarded: reactivating would restore access to a closed branch.
    if (!suspended) await homeworkerService.assertNotArchived(orgId, userId);
    await branchMemberRepository.setActiveForUser(orgId, userId, !suspended);
    return { userId, suspended };
  },

  async assignToBranch(orgId: string, userId: string, branchId: string, role?: string) {
    const target = await findMemberInOrg(userId, orgId);
    const branch = await branchRepository.findById(branchId, orgId);
    if (!branch) throw new AppError('Branch not found', 404);

    // Homeworker branches are created by invite and hold only their owner.
    if (branch.branchType === 'homeworker') {
      throw new AppError(HOMEWORKER_INVITE_ONLY_MESSAGE, 400);
    }

    const existing = await branchMemberRepository.findByUserAndBranch(userId, branchId);
    if (existing) {
      throw new AppError('Member is already assigned to this branch', 409);
    }

    const orgRole = role ?? target.orgRole ?? 'agent';
    assertRole(orgRole);
    // A membership row must never carry a different role than the user's own, or the
    // auth-time role union would grant both; and a homeworker owns exactly one branch.
    assertNoHomeworkerRoleChange(await loadRoleUnion(userId, orgId, target.orgRole ?? null), orgRole);
    if (orgRole === 'homeworker') {
      throw new AppError(HOMEWORKER_INVITE_ONLY_MESSAGE, 400);
    }
    return branchMemberRepository.create({ orgId, branchId, userId, orgRole, isActive: true });
  },

  async unassignFromBranch(orgId: string, userId: string, branchId: string) {
    const branch = await branchRepository.findById(branchId, orgId);
    if (!branch) throw new AppError('Branch not found', 404);

    await branchMemberRepository.removeFromBranch(branchId, userId);
  },
};

import { AppError } from '../../utils/error-handler';
import { branchMemberRepository } from '../branch-member/branch-member.repository';
import { branchRepository } from '../branch/branch.repository';
import { userRepository } from '../user/user.repository';

const ALLOWED_ORG_ROLES = ['org_admin', 'branch_manager', 'agent', 'homeworker', 'referral_agent'] as const;
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

export const orgMemberService = {
  async list(orgId: string) {
    return branchMemberRepository.listOrgMembersWithBranches(orgId);
  },

  async updateRole(orgId: string, userId: string, newRole: string, actingUserId: string | null) {
    assertRole(newRole);
    if (actingUserId === userId && newRole !== 'org_admin') {
      throw new AppError('You cannot demote yourself', 400);
    }

    await findMemberInOrg(userId, orgId);
    await branchMemberRepository.setOrgRoleAtomic(orgId, userId, newRole);

    return { userId, orgRole: newRole };
  },

  async setSuspended(orgId: string, userId: string, suspended: boolean, actingUserId: string | null) {
    if (actingUserId === userId) {
      throw new AppError('You cannot suspend your own account', 400);
    }

    await findMemberInOrg(userId, orgId);
    await branchMemberRepository.setActiveForUser(orgId, userId, !suspended);
    return { userId, suspended };
  },

  async assignToBranch(orgId: string, userId: string, branchId: string, role?: string) {
    const target = await findMemberInOrg(userId, orgId);
    const branch = await branchRepository.findById(branchId, orgId);
    if (!branch) throw new AppError('Branch not found', 404);

    const existing = await branchMemberRepository.findByUserAndBranch(userId, branchId);
    if (existing) {
      throw new AppError('Member is already assigned to this branch', 409);
    }

    const orgRole = role ?? target.orgRole ?? 'agent';
    assertRole(orgRole);
    return branchMemberRepository.create({ orgId, branchId, userId, orgRole, isActive: true });
  },

  async unassignFromBranch(orgId: string, userId: string, branchId: string) {
    const branch = await branchRepository.findById(branchId, orgId);
    if (!branch) throw new AppError('Branch not found', 404);

    await branchMemberRepository.removeFromBranch(branchId, userId);
  },
};

import { AppError } from '../../utils/error-handler';
import { branchRepository, type Tx } from './branch.repository';
import { planService } from '../plan/plan.service';
import type { InsertBranch } from '@shared/schema';
import { holdsHomeworkerRole, type Scope } from '../../utils/scope';
import { branchMemberRepository } from '../branch-member/branch-member.repository';

// branchType, ownerUserId and profitSharePercent are never client-editable here.
type BranchInput = Partial<
  Omit<InsertBranch, 'organizationId' | 'branchType' | 'ownerUserId' | 'profitSharePercent'>
>;

const ADMIN_ROLES = ['org_admin', 'platform_admin'];
const EDITABLE_FIELDS = [
  'name', 'code', 'address', 'phone', 'email', 'openingPattern', 'bankHolidaysOpen', 'openingHours', 'isDefault', 'isActive',
] as const;
// Homeworker branches: name and contact fields only (archive is a separate action).
const HOMEWORKER_EDITABLE_FIELDS = ['name', 'address', 'phone', 'email', 'openingPattern', 'bankHolidaysOpen', 'openingHours'] as const;

function isAdmin(scope: Pick<Scope, 'orgRole' | 'orgRoles'>): boolean {
  return [scope.orgRole, ...(scope.orgRoles ?? [])].some((r) => ADMIN_ROLES.includes(r));
}

function pickFields(data: BranchInput, fields: readonly (keyof BranchInput)[]): BranchInput {
  const out: Record<string, unknown> = {};
  for (const key of fields) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  return out as BranchInput;
}

export const branchService = {
  /** Shop branches by default; homeworker branches are listed for org admins only (403 otherwise). */
  async list(scope: Pick<Scope, 'orgId' | 'orgRole' | 'orgRoles'> & { userId?: string | null }, type: 'shop' | 'homeworker' = 'shop') {
    if (type === 'homeworker' && !isAdmin(scope)) {
      throw new AppError('You do not have permission to list homeworker branches', 403);
    }
    // A homeworker sees only their own branch, never the org's shop branches.
    if (holdsHomeworkerRole(scope)) {
      const context = scope.userId ? await branchMemberRepository.findActiveContextByUserId(scope.userId) : undefined;
      if (!context || context.orgId !== scope.orgId) return [];
      const own = await branchRepository.findById(context.branchId, scope.orgId);
      return own ? [own] : [];
    }
    return branchRepository.findAllByOrg(scope.orgId, type);
  },

  /**
   * Throws 404 unless the branch exists and belongs to `orgId`. A null/empty
   * orgId (platform admin) may use any existing branch.
   */
  async assertBranchInOrg(branchId: string, orgId: string | null): Promise<void> {
    const branchOrgId = await branchRepository.findOrgIdById(branchId);
    if (!branchOrgId || (orgId && branchOrgId !== orgId)) {
      throw new AppError('Branch not found', 404);
    }
  },

  /** A homeworker branch is visible to org admins and its owner only (404 for everyone else). */
  async getById(id: string, scope: Pick<Scope, 'orgId' | 'orgRole' | 'orgRoles' | 'userId'>) {
    const branch = await branchRepository.findById(id, scope.orgId);
    if (!branch) throw new AppError('Branch not found', 404);
    if (branch.branchType === 'homeworker') {
      const isOwner = !!scope.userId && branch.ownerUserId === scope.userId;
      if (!isAdmin(scope) && !isOwner) throw new AppError('Branch not found', 404);
    }
    return branch;
  },

  /** Pass `tx` to create inside a caller-held transaction; other callers are unaffected. */
  async create(data: BranchInput, orgId: string, tx?: Tx) {
    if (!data.name?.trim()) throw new AppError('Branch name is required', 400);

    if (tx) await planService.assertCanAddBranch(orgId, tx);
    else await planService.assertCanAddBranch(orgId);

    const existingCount = tx ? await branchRepository.countByOrg(orgId, tx) : await branchRepository.countByOrg(orgId);
    const shouldBeDefault = data.isDefault === true || existingCount === 0;

    return branchRepository.createAtomic(
      {
        organizationId: orgId,
        name: data.name!.trim(),
        code: data.code ?? null,
        address: data.address ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        openingPattern: data.openingPattern ?? null,
        bankHolidaysOpen: data.bankHolidaysOpen ?? false,
        openingHours: data.openingHours ?? [],
        isDefault: shouldBeDefault,
        isActive: data.isActive ?? true,
      } as InsertBranch,
      shouldBeDefault,
      ...(tx ? [tx] : []),
    );
  },

  async update(id: string, data: BranchInput, orgId: string) {
    const existing = await branchRepository.findById(id, orgId);
    if (!existing) throw new AppError('Branch not found', 404);

    let patch: BranchInput;
    if (existing.branchType === 'homeworker') {
      if (data.isDefault !== undefined || data.isActive !== undefined) {
        throw new AppError('Archive the homeworker instead', 400);
      }
      patch = pickFields(data, HOMEWORKER_EDITABLE_FIELDS);
    } else {
      patch = pickFields(data, EDITABLE_FIELDS);
    }

    if (Object.keys(patch).length === 0) return existing;

    const updated = await branchRepository.updateAtomic(id, patch, orgId, patch.isDefault === true);
    if (!updated) throw new AppError('Branch not found', 404);
    return updated;
  },

  async remove(id: string, orgId: string) {
    const existing = await branchRepository.findById(id, orgId);
    if (!existing) throw new AppError('Branch not found', 404);
    if (existing.branchType === 'homeworker') {
      throw new AppError('Archive the homeworker instead', 400);
    }

    const total = await branchRepository.countByOrg(orgId);
    if (total <= 1) {
      throw new AppError('You must keep at least one branch', 400);
    }
    if (existing.isDefault) {
      throw new AppError('Set another branch as default before deleting this one', 400);
    }

    await branchRepository.remove(id, orgId);
  },
};

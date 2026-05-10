import { db } from '../../config/database';
import { AppError } from '../../utils/error-handler';
import { branchRepository } from './branch.repository';
import type { InsertBranch } from '@shared/schema';

type BranchInput = Partial<Omit<InsertBranch, 'organizationId'>>;

export const branchService = {
  async list(orgId: string) {
    return branchRepository.findAllByOrg(orgId);
  },

  async getById(id: string, orgId: string) {
    const branch = await branchRepository.findById(id, orgId);
    if (!branch) throw new AppError('Branch not found', 404);
    return branch;
  },

  async create(data: BranchInput, orgId: string) {
    if (!data.name?.trim()) throw new AppError('Branch name is required', 400);

    const existingCount = await branchRepository.countByOrg(orgId);
    const shouldBeDefault = data.isDefault === true || existingCount === 0;

    return db.transaction(async (tx) => {
      const created = await branchRepository.create(
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
        tx,
      );
      if (shouldBeDefault) {
        await branchRepository.clearDefaultExcept(orgId, created.id, tx);
      }
      return created;
    });
  },

  async update(id: string, data: BranchInput, orgId: string) {
    const existing = await branchRepository.findById(id, orgId);
    if (!existing) throw new AppError('Branch not found', 404);

    return db.transaction(async (tx) => {
      const updated = await branchRepository.update(id, data, orgId, tx);
      if (!updated) throw new AppError('Branch not found', 404);
      if (data.isDefault === true) {
        await branchRepository.clearDefaultExcept(orgId, id, tx);
      }
      return updated;
    });
  },

  async remove(id: string, orgId: string) {
    const existing = await branchRepository.findById(id, orgId);
    if (!existing) throw new AppError('Branch not found', 404);

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

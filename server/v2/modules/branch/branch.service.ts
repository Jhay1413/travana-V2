import { AppError } from '../../utils/error-handler';
import { branchRepository } from './branch.repository';

export const branchService = {
  async list(orgId: string) {
    return branchRepository.findAllByOrg(orgId);
  },
  async getById(id: string, orgId: string) {
    const branch = await branchRepository.findById(id, orgId);
    if (!branch) throw new AppError('Branch not found', 404);
    return branch;
  },
  async create(data: any, orgId: string) {
    return branchRepository.create({ ...data, organization_id: orgId });
  },
  async update(id: string, data: any, orgId: string) {
    const branch = await branchRepository.update(id, data, orgId);
    if (!branch) throw new AppError('Branch not found', 404);
    return branch;
  },
  async remove(id: string, orgId: string) {
    await branchRepository.remove(id, orgId);
  },
};

import { AppError } from '../../utils/error-handler';
import { organizationRepository } from './organization.repository';

export const organizationService = {
  async list() {
    return organizationRepository.findAll();
  },
  async getById(id: string) {
    const org = await organizationRepository.findById(id);
    if (!org) throw new AppError('Organization not found', 404);
    return org;
  },
  async create(data: any) {
    return organizationRepository.create(data);
  },
  async update(id: string, data: any) {
    const org = await organizationRepository.update(id, data);
    if (!org) throw new AppError('Organization not found', 404);
    return org;
  },
  async remove(id: string) {
    await organizationRepository.remove(id);
  },
};

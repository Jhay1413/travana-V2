import { AppError } from '../../utils/error-handler';
import { platformAdminRepository } from './platform-admin.repository';

export const platformAdminService = {
  async listOrganizations() {
    return platformAdminRepository.findAllOrgs();
  },
  async getOrganization(id: string) {
    const org = await platformAdminRepository.findOrgById(id);
    if (!org) throw new AppError('Organization not found', 404);
    return org;
  },
  async suspend(id: string) {
    await platformAdminRepository.setActive(id, false);
  },
  async activate(id: string) {
    await platformAdminRepository.setActive(id, true);
  },
  async changePlan(id: string, plan: string, seatLimit?: number) {
    await platformAdminRepository.updatePlan(id, plan, seatLimit);
  },
};

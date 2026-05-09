import { db } from '../../config/database';

export const platformAdminRepository = {
  async findAllOrgs() {
    return [];
  },
  async findOrgById(_id: string) {
    return null;
  },
  async setActive(_id: string, _isActive: boolean) {},
  async updatePlan(_id: string, _plan: string, _seatLimit?: number) {},
};

import { db } from '../../config/database';

export const inviteRepository = {
  async findAllByOrg(_orgId: string) {
    return [];
  },
  async findByToken(_token: string) {
    return null;
  },
  async create(_data: any) {
    return null;
  },
  async revoke(_id: string, _orgId: string) {},
};

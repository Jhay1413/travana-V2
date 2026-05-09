import { db } from '../../config/database';
// TODO: import { branches } from '@shared/schema' once schema is added

export const branchRepository = {
  async findAllByOrg(_orgId: string) {
    return [];
  },
  async findById(_id: string, _orgId: string) {
    return null;
  },
  async create(_data: any) {
    return null;
  },
  async update(_id: string, _data: any, _orgId: string) {
    return null;
  },
  async remove(_id: string, _orgId: string) {},
};

import { db } from '../../config/database';
// TODO: import { organization } from '@shared/schema' once schema is added

export const organizationRepository = {
  async findAll() {
    // TODO: return db.select().from(organization);
    return [];
  },
  async findById(_id: string) {
    return null;
  },
  async create(_data: any) {
    return null;
  },
  async update(_id: string, _data: any) {
    return null;
  },
  async remove(_id: string) {},
};

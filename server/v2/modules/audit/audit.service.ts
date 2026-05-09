import { auditRepository } from './audit.repository';

export const auditService = {
  async findAll() {
    return auditRepository.findAll();
  },

  async createEntry(entry: any) {
    return auditRepository.create(entry);
  },
};

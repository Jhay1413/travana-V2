import { hrRepository } from './hr.repository';
import { AppError } from '../../utils/error-handler';

export const hrService = {
  async listEmployees() {
    return hrRepository.listEmployees();
  },

  async getEmployee(id: string) {
    const row = await hrRepository.getEmployee(id);
    if (!row) throw new AppError('Employee not found', 404);
    return row;
  },

  async updateEmployee(id: string, patch: any) {
    const row = await hrRepository.updateEmployee(id, patch);
    if (!row) throw new AppError('Employee not found', 404);
    return row;
  },

  async listReminders() {
    return hrRepository.listReminders();
  },
};

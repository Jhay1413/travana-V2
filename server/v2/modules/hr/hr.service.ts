import { hrRepository } from './hr.repository';
import { AppError } from '../../utils/error-handler';
import type { Scope } from '../../utils/scope';

function effectiveOrgId(scope: Scope): string | null {
  return scope.orgRole === 'platform_admin' ? null : (scope.orgId || null);
}

export const hrService = {
  async listEmployees(scope: Scope) {
    return hrRepository.listEmployees(effectiveOrgId(scope));
  },

  async getEmployee(id: string, scope: Scope) {
    const row = await hrRepository.getEmployee(id, effectiveOrgId(scope));
    if (!row) throw new AppError('Employee not found', 404);
    return row;
  },

  async updateEmployee(id: string, patch: any, scope: Scope) {
    const row = await hrRepository.updateEmployee(id, patch, effectiveOrgId(scope));
    if (!row) throw new AppError('Employee not found', 404);
    return row;
  },

  async listReminders(scope: Scope) {
    return hrRepository.listReminders(effectiveOrgId(scope));
  },
};

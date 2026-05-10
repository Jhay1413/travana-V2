import { auditRepository } from './audit.repository';
import type { Scope } from '../../utils/scope';

function effectiveOrgId(scope: Scope): string | null {
  return scope.orgRole === 'platform_admin' ? null : (scope.orgId || null);
}

export const auditService = {
  async findAll(scope: Scope) {
    return auditRepository.findAll(effectiveOrgId(scope));
  },

  async createEntry(entry: any) {
    return auditRepository.create(entry);
  },
};

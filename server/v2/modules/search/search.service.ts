import type { Scope } from '../../utils/scope';
import { searchRepository } from './search.repository';

export interface GlobalSearchOptions {
  orgId: string | null;
  limit?: number;
}

export const searchService = {
  async globalSearch(q: string, scope: Scope, limit = 15) {
    const orgId = scope.orgRole === 'platform_admin' ? null : scope.orgId;
    return searchRepository.globalSearch(q, { orgId, limit });
  },
};

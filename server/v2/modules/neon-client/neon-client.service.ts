import { neonClientRepository, type NeonClientImport } from './neon-client.repository';
import { clientRepository } from '../client/client.repository';
import { AppError } from '../../utils/error-handler';
import type { NeonClient, InsertClientTable } from '@shared/schema';
import type { Scope } from '../../utils/scope';

export const neonClientService = {
  async listNeonClientsPaginated(
    page: number,
    limit: number,
    search: string | undefined,
    scope: Scope,
  ): Promise<{ clients: NeonClient[]; total: number; page: number; limit: number; totalPages: number }> {
    const result = await neonClientRepository.findPaginated(page, limit, search, scope);
    return {
      ...result,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  },

  async getNeonClientById(id: string, scope: Scope): Promise<NeonClient> {
    const client = await neonClientRepository.findById(id, scope);
    if (!client) throw new AppError('Neon client not found', 404);
    return client;
  },

  async createNeonClient(data: InsertClientTable, scope: Scope): Promise<NeonClient> {
    return neonClientRepository.create(data, scope);
  },

  /** Candidate clients matching a contact's phone/email, for link suggestions. */
  async findMatches(opts: { phone?: string | null; email?: string | null }, scope: Scope): Promise<NeonClient[]> {
    return neonClientRepository.findMatches(opts, scope);
  },

  async updateNeonClient(id: string, data: Partial<InsertClientTable>, scope: Scope): Promise<NeonClient> {
    const client = await neonClientRepository.update(id, data, scope);
    if (!client) throw new AppError('Neon client not found', 404);
    return client;
  },

  async deleteNeonClient(id: string, scope: Scope): Promise<void> {
    const removed = await neonClientRepository.remove(id, scope);
    if (!removed) throw new AppError('Neon client not found', 404);
  },

  async bulkImportClients(clients: NeonClientImport[], scope: Scope) {
    if (!clients.length) throw new AppError('No clients to import', 400);
    return neonClientRepository.bulkInsert(clients, scope);
  },

  /**
   * Merge a duplicate (source) client into a surviving (target) client. Reassigns
   * all of the source's records to the target and soft-archives the source. Both
   * clients must be within the caller's tenant scope.
   */
  async mergeClients(sourceId: string, targetId: string, scope: Scope): Promise<NeonClient> {
    if (sourceId === targetId) {
      throw new AppError('Cannot merge a client into itself', 400);
    }

    // Scope-enforced fetch: an out-of-scope client reads as 404.
    const [source, target] = await Promise.all([
      neonClientRepository.findById(sourceId, scope),
      neonClientRepository.findById(targetId, scope),
    ]);
    if (!source) throw new AppError('Source client not found', 404);
    if (!target) throw new AppError('Target client not found', 404);

    if (source.status === 'merged') {
      throw new AppError('Source client has already been merged', 400);
    }
    if (target.status === 'merged') {
      throw new AppError('Target client has already been merged into another client', 400);
    }
    if (source.orgId !== target.orgId) {
      throw new AppError('Clients must belong to the same organization', 400);
    }

    return clientRepository.mergeAtomic(source, target, scope.userId);
  },
};

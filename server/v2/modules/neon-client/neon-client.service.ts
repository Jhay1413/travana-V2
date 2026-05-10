import { neonClientRepository, type NeonClientWithId } from './neon-client.repository';
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

  async updateNeonClient(id: string, data: Partial<InsertClientTable>, scope: Scope): Promise<NeonClient> {
    const client = await neonClientRepository.update(id, data, scope);
    if (!client) throw new AppError('Neon client not found', 404);
    return client;
  },

  async deleteNeonClient(id: string, scope: Scope): Promise<void> {
    const removed = await neonClientRepository.remove(id, scope);
    if (!removed) throw new AppError('Neon client not found', 404);
  },

  async bulkImportClients(clients: NeonClientWithId[], scope: Scope) {
    if (!clients.length) throw new AppError('No clients to import', 400);
    return neonClientRepository.bulkUpsert(clients, scope);
  },
};

import { neonClientRepository, type NeonClientWithId } from './neon-client.repository';
import { AppError } from '../../utils/error-handler';
import type { NeonClient, InsertClientTable } from '@shared/schema';

export const neonClientService = {
  async listNeonClientsPaginated(
    page: number,
    limit: number,
    search?: string,
  ): Promise<{ clients: NeonClient[]; total: number; page: number; limit: number; totalPages: number }> {
    const result = await neonClientRepository.findPaginated(page, limit, search);
    return {
      ...result,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  },

  async getNeonClientById(id: string): Promise<NeonClient> {
    const client = await neonClientRepository.findById(id);
    if (!client) throw new AppError('Neon client not found', 404);
    return client;
  },

  async createNeonClient(data: InsertClientTable): Promise<NeonClient> {
    return neonClientRepository.create(data);
  },

  async updateNeonClient(id: string, data: Partial<InsertClientTable>): Promise<NeonClient> {
    const client = await neonClientRepository.update(id, data);
    if (!client) throw new AppError('Neon client not found', 404);
    return client;
  },

  async deleteNeonClient(id: string): Promise<void> {
    await neonClientRepository.remove(id);
  },

  async bulkImportClients(clients: NeonClientWithId[]) {
    if (!clients.length) throw new AppError('No clients to import', 400);
    return neonClientRepository.bulkUpsert(clients);
  },
};

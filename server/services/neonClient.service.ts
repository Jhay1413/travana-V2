import { neonClientRepository, type NeonClientWithId } from "../repositories/neonClient.repository";
import { AppError } from "../utils/error-handler";
import type { NeonClient, InsertClientTable } from "../types/neonClient";

export const neonClientService = {
  async listNeonClients(): Promise<NeonClient[]> {
    return await neonClientRepository.findAll();
  },

  async getNeonClientById(id: string): Promise<NeonClient> {
    const client = await neonClientRepository.findById(id);
    if (!client) {
      throw new AppError("Neon client not found", 404);
    }
    return client;
  },

  async createNeonClient(data: InsertClientTable): Promise<NeonClient> {
    const client = await neonClientRepository.create(data);
    return client;
  },

  async updateNeonClient(id: string, data: Partial<InsertClientTable>): Promise<NeonClient> {
    const client = await neonClientRepository.update(id, data);
    if (!client) {
      throw new AppError("Neon client not found", 404);
    }
    return client;
  },

  async deleteNeonClient(id: string): Promise<void> {
    await neonClientRepository.remove(id);
  },

  async bulkImportClients(clients: NeonClientWithId[]) {
    if (!clients.length) {
      throw new AppError("No clients to import", 400);
    }
    return await neonClientRepository.bulkUpsert(clients);
  },
};

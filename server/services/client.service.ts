import { clientRepository } from "../repositories/client.repository";
import { AppError } from "../utils/error-handler";
import type { Client, InsertClient } from "../types/client";

export const clientService = {
  async listClients(): Promise<Client[]> {
    return await clientRepository.findAll();
  },

  async getClientById(id: string): Promise<Client> {
    const client = await clientRepository.findById(id);
    if (!client) {
      throw new AppError("Client not found", 404);
    }
    return client;
  },

  async createClient(data: InsertClient): Promise<Client> {
    const client = await clientRepository.create(data);
    return client;
  },

  async updateClient(id: string, data: Partial<InsertClient>): Promise<Client> {
    const client = await clientRepository.update(id, data);
    if (!client) {
      throw new AppError("Client not found", 404);
    }
    return client;
  },

  async deleteClient(id: string): Promise<void> {
    await clientRepository.remove(id);
  },
};

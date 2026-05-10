import { clientRepository } from "./client.repository";
import { AppError } from "../../utils/error-handler";
import type { Client, InsertClient } from "./client.types";
import type { Scope } from "../../utils/scope";

export const clientService = {
  async listClients(scope: Scope): Promise<Client[]> {
    return await clientRepository.findAll(scope);
  },

  async getClientById(id: string, scope: Scope): Promise<Client> {
    const client = await clientRepository.findById(id, scope);
    if (!client) {
      throw new AppError("Client not found", 404);
    }
    return client;
  },

  async createClient(data: InsertClient, scope: Scope): Promise<Client> {
    return await clientRepository.create(data, scope);
  },

  async updateClient(id: string, data: Partial<InsertClient>, scope: Scope): Promise<Client> {
    const client = await clientRepository.update(id, data, scope);
    if (!client) {
      throw new AppError("Client not found", 404);
    }
    return client;
  },

  async deleteClient(id: string, scope: Scope): Promise<void> {
    const removed = await clientRepository.remove(id, scope);
    if (!removed) {
      throw new AppError("Client not found", 404);
    }
  },
};

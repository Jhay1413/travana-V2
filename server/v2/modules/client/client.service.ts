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

  /**
   * Merge a duplicate (source) client into a surviving (target) client: reassign
   * all of the source's records to the target and soft-archive the source.
   * Both clients must be within the caller's tenant scope.
   */
  async mergeClients(sourceId: string, targetId: string, scope: Scope): Promise<Client> {
    if (sourceId === targetId) {
      throw new AppError("Cannot merge a client into itself", 400);
    }

    // Scope-enforced fetch: an out-of-scope / not-owned client reads as 404.
    const [source, target] = await Promise.all([
      clientRepository.findById(sourceId, scope),
      clientRepository.findById(targetId, scope),
    ]);
    if (!source) throw new AppError("Source client not found", 404);
    if (!target) throw new AppError("Target client not found", 404);

    if (source.status === "merged") {
      throw new AppError("Source client has already been merged", 400);
    }
    if (target.status === "merged") {
      throw new AppError("Target client has already been merged into another client", 400);
    }
    if (source.orgId !== target.orgId) {
      throw new AppError("Clients must belong to the same organization", 400);
    }

    return await clientRepository.mergeAtomic(source, target, scope.userId);
  },
};

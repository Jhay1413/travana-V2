import { isPhoneChanged, isValidPhoneNumber, PHONE_ERROR_MESSAGE, withNormalizedPhone } from "@shared/phone";
import { clientRepository } from "./client.repository";
import { AppError } from "../../utils/error-handler";
import type { Client, InsertClient } from "./client.types";
import { CLIENT_DELETE_ROLES } from "../../utils/client-delete-roles";
import type { Scope } from "../../utils/scope";
import { stripOwnershipFields } from "../../utils/ownership-fields";
import { branchRepository } from "../branch/branch.repository";
import { stripSystemManagedFields, assertValidReferrer } from "../neon-client/neon-client.guards";

export { CLIENT_DELETE_ROLES };

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

  /**
   * Read for the client page. Admins (CLIENT_DELETE_ROLES) may also open a soft-deleted
   * client, read-only (the row carries deletedAt); everyone else gets 404 as before.
   */
  async viewClientById(id: string, scope: Scope): Promise<Client> {
    const client = await clientRepository.findById(id, scope);
    if (client) return client;
    if (CLIENT_DELETE_ROLES.includes(scope.orgRole)) {
      const deleted = await clientRepository.findByIdIncludingDeleted(id, scope);
      if (deleted) return deleted;
    }
    throw new AppError("Client not found", 404);
  },

  async createClient(data: InsertClient, scope: Scope): Promise<Client> {
    const clean = withNormalizedPhone(stripSystemManagedFields(data));
    await assertValidReferrer(null, clean.referredByClientId, scope);
    return await clientRepository.create(clean, scope);
  },

  async updateClient(id: string, data: Partial<InsertClient>, scope: Scope): Promise<Client> {
    const stripped = stripSystemManagedFields(data);
    const current = await clientRepository.findById(id, scope);
    if (!current) throw new AppError("Client not found", 404);
    // The UK phone rule applies only when the phone is new or changed (legacy numbers stay saveable).
    const phoneChanged = isPhoneChanged(stripped.phoneNumber, current.phoneNumber);
    if (phoneChanged && !isValidPhoneNumber(stripped.phoneNumber)) throw new AppError(PHONE_ERROR_MESSAGE, 400);
    const clean = phoneChanged ? withNormalizedPhone(stripped) : stripped;
    if (clean.referredByClientId) {
      await assertValidReferrer(id, clean.referredByClientId, scope, current.referredByClientId);
    }
    const safe = await stripOwnershipFields(clean, scope, async (b, o) => !!(await branchRepository.findById(b, o)));
    const client = await clientRepository.update(id, safe, scope);
    if (!client) {
      throw new AppError("Client not found", 404);
    }
    return client;
  },

  /**
   * Soft delete (admin only): hides the client from lists, search and pickers and
   * stops portal access; its deals stay. Never hard-deletes.
   */
  async deleteClient(id: string, scope: Scope): Promise<void> {
    if (!CLIENT_DELETE_ROLES.includes(scope.orgRole)) {
      throw new AppError("You do not have permission to delete clients", 403);
    }
    // Scope-enforced fetch: an out-of-scope client reads as 404.
    const client = await clientRepository.findByIdIncludingDeleted(id, scope);
    if (!client) throw new AppError("Client not found", 404);
    if (client.deletedAt) throw new AppError("This client has already been deleted", 409);
    if (client.status === "merged") {
      throw new AppError("This client has been merged into another client and cannot be deleted", 400);
    }
    const done = await clientRepository.softDelete(id, scope, scope.userId);
    if (!done) throw new AppError("Client not found", 404);
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

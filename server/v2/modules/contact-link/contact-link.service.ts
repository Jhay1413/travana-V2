import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";
import { neonClientService } from "../neon-client/neon-client.service";
import { contactLinkRepository } from "./contact-link.repository";
import type { ClientContactLink, ContactLinkStatus, CreateClientFromContactInput } from "./contact-link.types";
import type { InsertClientTable, NeonClient } from "@shared/schema";

// Business logic for linking a SendSeven contact to a CRM client. Owns the link
// table (via its repository) and delegates all client reads/writes to the
// neon-client module so client tenant-scoping stays in one place.

export const contactLinkService = {
  // Current link + suggestions for one contact. `match` carries the contact's
  // phone/email (the inbox already has them) so we can suggest without calling
  // SendSeven. Suggestions are only computed when nothing is linked yet.
  async getStatus(
    contactId: string,
    match: { phone?: string | null; email?: string | null },
    scope: Scope,
  ): Promise<ContactLinkStatus> {
    const row = await contactLinkRepository.findByContact(scope.orgId, contactId);

    let linkedClient: NeonClient | null = null;
    if (row) {
      // A linked client that's since been deleted/out-of-scope reads as unlinked.
      linkedClient = await neonClientService.getNeonClientById(row.clientId, scope).catch(() => null);
    }

    const suggestions = linkedClient ? [] : await neonClientService.findMatches(match, scope);
    return { contactId, linkedClient, suggestions };
  },

  // Reverse view for the client dashboard: the SendSeven contact this client is
  // linked to, or a null contactId when the client has no inbox presence.
  async getByClient(clientId: string, scope: Scope): Promise<ClientContactLink> {
    // Scope-enforced existence check: out-of-scope client reads as 404.
    await neonClientService.getNeonClientById(clientId, scope);
    const row = await contactLinkRepository.findByClient(scope.orgId, clientId);
    return {
      clientId,
      contactId: row?.sendsevenContactId ?? null,
      linkedAt: row ? row.linkedAt.toISOString() : null,
    };
  },

  async link(contactId: string, clientId: string, scope: Scope): Promise<NeonClient> {
    // Scope-enforced existence check: out-of-scope client reads as 404.
    const client = await neonClientService.getNeonClientById(clientId, scope);
    await contactLinkRepository.link(scope.orgId, contactId, clientId, scope.userId);
    return client;
  },

  async createAndLink(contactId: string, input: CreateClientFromContactInput, scope: Scope): Promise<NeonClient> {
    const data: InsertClientTable = {
      title: input.title ?? null,
      firstName: input.firstName,
      surename: input.surename,
      phoneNumber: input.phoneNumber,
      email: input.email?.trim() ? input.email.trim() : null,
    } as InsertClientTable;

    const client = await neonClientService.createNeonClient(data, scope);
    await contactLinkRepository.link(scope.orgId, contactId, client.id, scope.userId);
    return client;
  },

  async unlink(contactId: string, scope: Scope): Promise<void> {
    await contactLinkRepository.deleteByContact(scope.orgId, contactId);
  },
};

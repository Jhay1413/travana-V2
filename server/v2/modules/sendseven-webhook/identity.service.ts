import { contactLinkRepository } from "../contact-link/contact-link.repository";
import { neonClientService } from "../neon-client/neon-client.service";
import type { Scope } from "../../utils/scope";
import type { InsertClientTable } from "@shared/schema";

// A system (non-user) scope for background work — org-wide access, no branch/user
// restriction. Used by the webhook worker which has no request/user.
export function systemScope(orgId: string): Scope {
  return { orgId, branchId: null, orgRole: "org_admin", orgRoles: ["org_admin"], userId: null };
}

export interface WebhookContact {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

// Resolves an EXISTING CRM client for a SendSeven contact: existing link →
// phone/email match (auto-link the first hit). Returns the client id, or null if
// the contact isn't known yet (the AI then collects details — see the worker).
// Does NOT create a client (that only happens once the customer gives details).
export async function resolveExistingClient(orgId: string, contact: WebhookContact): Promise<string | null> {
  if (!contact.id) return null;

  const existing = await contactLinkRepository.findByContact(orgId, contact.id);
  if (existing) return existing.clientId;

  const matches = await neonClientService.findMatches({ phone: contact.phone, email: contact.email }, systemScope(orgId));
  if (matches.length > 0) {
    await contactLinkRepository.link(orgId, contact.id, matches[0].id, null);
    return matches[0].id;
  }
  return null;
}

// Creates a client from details the AI collected in the chat, then links it to
// the contact. Also matches an existing client by the given phone/email first, to
// avoid duplicates. Returns the client id.
export async function createAndLinkClient(
  orgId: string,
  contactId: string,
  details: { fullName: string; phone: string; email?: string | null },
): Promise<string> {
  const scope = systemScope(orgId);

  const matches = await neonClientService.findMatches({ phone: details.phone, email: details.email }, scope);
  if (matches.length > 0) {
    await contactLinkRepository.link(orgId, contactId, matches[0].id, null);
    return matches[0].id;
  }

  const parts = details.fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || details.fullName.trim();
  const surename = parts.slice(1).join(" ") || "—";
  const data: InsertClientTable = {
    firstName,
    surename,
    phoneNumber: details.phone,
    email: details.email?.trim() ? details.email.trim() : null,
  } as InsertClientTable;

  const client = await neonClientService.createNeonClient(data, scope);
  await contactLinkRepository.link(orgId, contactId, client.id, null);
  return client.id;
}

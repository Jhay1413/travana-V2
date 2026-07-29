import type { NeonClient } from "@shared/schema";

// The link status for a single SendSeven contact: the linked client (if any) plus
// suggested clients matched by phone/email when nothing is linked yet.
export interface ContactLinkStatus {
  contactId: string;
  linkedClient: NeonClient | null;
  suggestions: NeonClient[];
}

// The reverse view: which SendSeven contact (if any) a CRM client is linked to.
export interface ClientContactLink {
  clientId: string;
  contactId: string | null;
  linkedAt: string | null;
}

// Payload to create a brand-new client from an unmatched SendSeven contact.
export interface CreateClientFromContactInput {
  title?: string | null;
  firstName: string;
  surename: string;
  phoneNumber: string;
  email?: string | null;
}

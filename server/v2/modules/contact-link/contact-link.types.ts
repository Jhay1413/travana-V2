import type { NeonClient } from "@shared/schema";

/** How `suggestions` were found. "contact" = matched on phone or email, which is
 *  near-certain. "name" = same first and last name only, which is a guess the UI
 *  must label as such — two clients can share a name. */
export type SuggestionMatchType = "contact" | "name";

// The link status for a single SendSeven contact: the linked client (if any) plus
// suggested clients when nothing is linked yet.
export interface ContactLinkStatus {
  contactId: string;
  linkedClient: NeonClient | null;
  suggestions: NeonClient[];
  suggestionMatch: SuggestionMatchType;
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

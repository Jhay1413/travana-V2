import { contactLinkRepository } from "../contact-link/contact-link.repository";
import { neonClientService } from "../neon-client/neon-client.service";
import type { Scope } from "../../utils/scope";
import type { InsertClientTable, NeonClient } from "@shared/schema";

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

// Digits-only comparison on the last 8 digits — the same tail the client
// repository matches on. Lets the worker tell whether a customer corrected the
// number they gave or is standing by the one that conflicted.
export function samePhoneNumber(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = (a ?? "").replace(/\D/g, "");
  const db = (b ?? "").replace(/\D/g, "");
  if (da.length < 7 || db.length < 7) return false;
  return da.slice(-8) === db.slice(-8);
}

// Pulls the first phone-number-looking token out of free text. Used to capture a
// traveller's number from a plain reply ("his number is 09355152084") without
// depending on the model to echo it back in a structured field every turn.
// Requires 10–15 digits so it won't grab a budget ("1000"), a date, or "4 nights".
// It ALSO requires a plausible phone SHAPE — a leading "+" (international), a
// leading "0" (UK/local trunk prefix), or common phone separators (space,
// hyphen, dot, parens) — so a bare contiguous digit run like a booking
// reference ("the ref is 12345678901") isn't mistaken for a phone number.
export function extractPhoneNumber(text: string): string | null {
  const candidates = (text || "").match(/[+(]?\d[\d\s().-]{7,}\d/g);
  if (!candidates) return null;
  for (const raw of candidates) {
    const c = raw.trim();
    const digits = c.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) continue;
    const hasSeparator = /[\s().-]/.test(c);
    if (!c.startsWith("+") && !c.startsWith("0") && !hasSeparator) continue;
    return c;
  }
  return null;
}

function normalizeNameToken(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

// True when the name the customer typed is consistent with a client record:
// EVERY token they gave must appear in the client's first/surname. So "John"
// matches "John Smith", and "John Smith" matches "John Smith", but "John Doe"
// does NOT match "John Smith" — this guards against linking two different Johns.
function nameMatchesClient(providedName: string, client: NeonClient): boolean {
  const tokens = providedName.trim().split(/\s+/).map(normalizeNameToken).filter(Boolean);
  if (!tokens.length) return false;
  const clientTokens = new Set([normalizeNameToken(client.firstName), normalizeNameToken(client.surename)].filter(Boolean));
  if (!clientTokens.size) return false;
  return tokens.every((t) => clientTokens.has(t));
}

// Human-readable name for a client, dropping the "—" placeholder surname we seed
// when a client was created from a single name.
export function clientDisplayName(client: Pick<NeonClient, "title" | "firstName" | "surename">): string {
  const name = [client.title, client.firstName, client.surename].filter((p) => p && p !== "—").join(" ").trim();
  return name || "an existing client";
}

// Outcome of resolving the name + phone a customer gave during onboarding.
export type OnboardingResolution =
  | { status: "resolved"; clientId: string }
  // The phone is already on file for one or more OTHER clients and none of them
  // share the name the customer gave — surface the names so the worker can ask
  // the customer to confirm the number rather than hijacking someone's record.
  | { status: "phone_conflict"; existingNames: string[] };

// Creates a brand-new client from the given details, WITHOUT linking a contact or
// matching an existing record. The building block for the link/no-link variants.
// `extra` merges in caller-specific columns (e.g. the internal test flow's TEST
// badge / createdBy) so every driver shares this one creation path.
export async function insertClient(
  orgId: string,
  details: { fullName: string; phone: string; email?: string | null },
  extra?: Partial<InsertClientTable>,
): Promise<string> {
  const parts = details.fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || details.fullName.trim();
  const surename = parts.slice(1).join(" ") || "—";
  const data: InsertClientTable = {
    firstName,
    surename,
    phoneNumber: details.phone,
    email: details.email?.trim() ? details.email.trim() : null,
    ...(extra ?? {}),
  } as InsertClientTable;

  const client = await neonClientService.createNeonClient(data, systemScope(orgId));
  return client.id;
}

// Name-aware resolution of a client from a name + phone, WITHOUT touching any
// contact link (the resolved person may not be the one messaging — e.g. a
// traveller someone is enquiring for):
//   • one phone shared by several clients → pick the one whose name matches;
//   • phone on file under a different name only → phone_conflict (ask to confirm);
//   • no match at all → create a new client under the name they gave.
export async function resolveOrCreateByDetails(
  orgId: string,
  details: { fullName: string; phone: string; email?: string | null },
  extra?: Partial<InsertClientTable>,
): Promise<OnboardingResolution> {
  const matches = await neonClientService.findMatches({ phone: details.phone, email: details.email }, systemScope(orgId));

  if (matches.length > 0) {
    const named = matches.find((m) => nameMatchesClient(details.fullName, m));
    if (named) return { status: "resolved", clientId: named.id };
    const existingNames = Array.from(new Set(matches.map((m) => clientDisplayName(m))));
    return { status: "phone_conflict", existingNames };
  }

  return { status: "resolved", clientId: await insertClient(orgId, details, extra) };
}

// Resolves the client for a just-onboarded contact from the name + phone the AI
// collected in the chat, and LINKS the resolved/created client to the SendSeven
// contact (the contact is the person messaging). See resolveOrCreateByDetails
// for the name-aware matching rules.
export async function resolveClientForOnboarding(
  orgId: string,
  contactId: string,
  details: { fullName: string; phone: string; email?: string | null },
): Promise<OnboardingResolution> {
  const resolution = await resolveOrCreateByDetails(orgId, details);
  if (resolution.status === "resolved") {
    await contactLinkRepository.link(orgId, contactId, resolution.clientId, null);
  }
  return resolution;
}

// Forces creation of a NEW client from the given details and links it, WITHOUT
// folding the customer into any existing phone/email match. Used once a customer
// has confirmed a shared/reused number is genuinely theirs — we must not attach
// them to the other client's record.
export async function createNewClientAndLink(
  orgId: string,
  contactId: string,
  details: { fullName: string; phone: string; email?: string | null },
): Promise<string> {
  const clientId = await insertClient(orgId, details);
  await contactLinkRepository.link(orgId, contactId, clientId, null);
  return clientId;
}

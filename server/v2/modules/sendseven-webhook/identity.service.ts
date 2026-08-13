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

// The same lookup with NO writes — no contact link is created. For callers
// that must stay side-effect-free (the composer's "AI reply" suggestion), and
// for the case that matters most there: a conversation the live AI never
// processed has no clientId on our state row, yet the contact IS linked to a
// CRM client. Reading only the state row made the suggestion ask a known
// customer for their phone number again.
export async function findExistingClientReadOnly(orgId: string, contact: WebhookContact): Promise<string | null> {
  if (!contact.id) return null;
  try {
    const existing = await contactLinkRepository.findByContact(orgId, contact.id);
    if (existing) return existing.clientId;
    const matches = await neonClientService.findMatches({ phone: contact.phone, email: contact.email }, systemScope(orgId));
    return matches[0]?.id ?? null;
  } catch (err) {
    console.error(`[identity] read-only client lookup failed for contact ${contact.id}:`, err);
    return null;
  }
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

// Last-resort identity recovery: the conversation has no CRM link, but the
// customer already TYPED their phone number earlier in the chat — commonly
// while a human agent was handling it, before the AI ever saw the thread. We
// link to whichever client already holds that number, so the bot never asks
// again for a number it has already been given.
//
// Scans INBOUND (customer) messages ONLY, and this is load-bearing: our own
// outbound messages routinely contain the AGENCY's number ("call me back on
// 0191 594 7999"), and matching on that would attach the conversation to
// whichever client happens to hold the office number.
//
// Newest-first so the most recently stated number wins, and a number matching
// no client is skipped (rather than aborting) so an older, known number is
// still found. Returns null when nothing usable is present — the caller then
// falls back to the normal onboarding ask.
export async function resolveClientFromTranscript(
  orgId: string,
  contactId: string | null,
  messages: Array<{ direction?: string; text?: string | null; created_at?: string | null }>,
): Promise<{ clientId: string; phone: string } | null> {
  const inbound = messages
    .filter((m) => m.direction === "inbound" && m.text?.trim())
    .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""))
    .reverse();

  const tried = new Set<string>();
  for (const message of inbound) {
    const phone = extractPhoneNumber(message.text ?? "");
    if (!phone) continue;
    const key = phone.replace(/\D/g, "");
    if (tried.has(key)) continue;
    tried.add(key);

    let matches: NeonClient[] = [];
    try {
      matches = await neonClientService.findMatches({ phone }, systemScope(orgId));
    } catch (err) {
      console.error(`[identity] phone lookup failed while recovering identity from the transcript:`, err);
      continue;
    }
    if (!matches.length) continue;
    // Link the SendSeven contact too, so later turns resolve instantly via the
    // link rather than re-scanning the transcript. Best-effort: we already know
    // the client, so a failed link must not lose that.
    if (contactId) {
      try {
        await contactLinkRepository.link(orgId, contactId, matches[0].id, null);
      } catch (err) {
        console.error(`[identity] contact link failed after recovering identity from the transcript:`, err);
      }
    }
    return { clientId: matches[0].id, phone };
  }
  return null;
}

function normalizeNameToken(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

// Every whitespace-separated word across the given name parts, normalized. Each
// FIELD is split, not just taken whole: plenty of client records were imported
// with the full name sitting in `firstName` ("Jimmy Buoy") and the "—"
// placeholder in `surename`, and treating that as one token made it impossible
// to ever match the two words the customer types.
function nameTokens(...parts: Array<string | null | undefined>): Set<string> {
  const out = new Set<string>();
  for (const part of parts) {
    for (const word of (part ?? "").split(/\s+/)) {
      const norm = normalizeNameToken(word);
      if (norm) out.add(norm);
    }
  }
  return out;
}

// True when the name the customer typed is consistent with a client record:
// EVERY token they gave must appear in the client's first/surname. So "John"
// matches "John Smith", and "John Smith" matches "John Smith", but "John Doe"
// does NOT match "John Smith" — this guards against linking two different Johns.
//
// Deliberately EXACT, not fuzzy: "jimmy" does not match "James", nor "Buoy"
// "Bouy". A near miss makes a separate client (flagged for an agent to merge)
// rather than risking attaching someone to a stranger's record and history.
function nameMatchesClient(providedName: string, client: NeonClient): boolean {
  const tokens = [...nameTokens(providedName)];
  if (!tokens.length) return false;
  const clientTokens = nameTokens(client.firstName, client.surename);
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
// Always resolves to a client — a phone clash is never a dead end.
export interface OnboardingResolution {
  status: "resolved";
  clientId: string;
  // Display names of the OTHER clients already holding this phone number. When
  // non-empty, `clientId` is a BRAND-NEW client created under the name the
  // customer gave — we never fold them into someone else's record on a phone
  // match alone.
  //
  // This is an INTERNAL signal only. The customer is never told their number
  // was recognised: it reads as an accusation, it discloses who is in the CRM,
  // and it stalls a live sales conversation over data hygiene. Callers surface
  // it to staff instead (see the enquiry note) so an agent can verify and merge.
  duplicatePhoneNames?: string[];
}

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
//   • phone on file under a different name only → create a NEW client under the
//     name they gave and report the clash in `duplicatePhoneNames` for staff;
//   • no match at all → create a new client under the name they gave.
//
// Households and businesses genuinely share numbers, and names get typed as
// nicknames or misspelled, so a phone match with no name match is far more often
// a new-but-related person than a mistake worth interrogating the customer over.
export async function resolveOrCreateByDetails(
  orgId: string,
  details: { fullName: string; phone: string; email?: string | null },
  extra?: Partial<InsertClientTable>,
): Promise<OnboardingResolution> {
  const matches = await neonClientService.findMatches({ phone: details.phone, email: details.email }, systemScope(orgId));

  const named = matches.find((m) => nameMatchesClient(details.fullName, m));
  if (named) return { status: "resolved", clientId: named.id };

  const clientId = await insertClient(orgId, details, extra);
  if (matches.length === 0) return { status: "resolved", clientId };

  return {
    status: "resolved",
    clientId,
    duplicatePhoneNames: Array.from(new Set(matches.map((m) => clientDisplayName(m)))),
  };
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
  await contactLinkRepository.link(orgId, contactId, resolution.clientId, null);
  return resolution;
}

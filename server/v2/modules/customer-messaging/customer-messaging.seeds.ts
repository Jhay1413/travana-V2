// What the SMS templates page seeds for every agency that opens it (the "Portal Login" row of DEFAULT_TEMPLATES in
// sms/sms.controller.ts). Kept here, not imported from the controller, so a service never depends on a controller;
// customer-messaging.seeds.test.ts reads the controller and fails if the two ever drift apart.

/** The seeded body of the "Portal Login" SMS template (category portal_login). Signed with the agency's own name. */
export const SEEDED_PORTAL_LOGIN_BODY =
  "Hi {{first_name}}, your client portal is ready. Log in here: {{portal_link}} (use your email and the PIN we shared). - {{company_name}}";

/** What that body was before agencies were signed by name: rows seeded then still end with a fixed agency name. */
const LEGACY_SEEDED_PORTAL_LOGIN_BODY =
  "Hi {{first_name}}, your client portal is ready. Log in here: {{portal_link}} (use your email and the PIN we shared). - Tina's Travel";

/** The fixed agency name the OLD seeded templates end with. It must never go out in a customer message from another agency. */
export const SEEDED_SIGNATURE = /tina'?s\s+travel/i;

/** The seeded signature as the end of a body: " - Tina's Travel" (with or without the apostrophe, any case or spacing). */
const SEEDED_SIGNATURE_AT_END = /\s+-\s*tina'?s\s+travel\s*$/i;

const normalise = (text: string): string => text.replace(/\s+/g, " ").trim().toLowerCase();

/** Is this body still the seeded default (ignoring case and spacing)? An agency that never edited it has this. */
export function isSeededPortalLoginBody(body: string): boolean {
  const n = normalise(body);
  return n === normalise(SEEDED_PORTAL_LOGIN_BODY) || n === normalise(LEGACY_SEEDED_PORTAL_LOGIN_BODY);
}

/**
 * Rows seeded before the signature became {{company_name}} still end with " - Tina's Travel", whichever agency owns them.
 * At send time (before the merge) that ending is swapped for the sending agency's own name, or dropped when the agency's
 * name is unknown. An agency that really is called Tina's Travel, and any body that does not end that way, is unchanged.
 */
export function withAgencySignature(body: string, agencyName: string | null | undefined): string {
  if (!SEEDED_SIGNATURE_AT_END.test(body)) return body;
  const name = (agencyName ?? "").trim();
  if (normalise(name).replace(/'/g, "") === "tinas travel") return body;
  return body.replace(SEEDED_SIGNATURE_AT_END, name ? " - {{company_name}}" : "");
}

// What the SMS templates page seeds for every agency that opens it (the "Portal Login" row of DEFAULT_TEMPLATES in
// sms/sms.controller.ts). Kept here, not imported from the controller, so a service never depends on a controller;
// customer-messaging.seeds.test.ts reads the controller and fails if the two ever drift apart.

/** The seeded body of the "Portal Login" SMS template (category portal_login). */
export const SEEDED_PORTAL_LOGIN_BODY =
  "Hi {{first_name}}, your client portal is ready. Log in here: {{portal_link}} (use your email and the PIN we shared). - Tina's Travel";

/** The fixed agency name the seeded templates end with. It must never go out in a customer message from the staff send. */
export const SEEDED_SIGNATURE = /tina'?s\s+travel/i;

const normalise = (text: string): string => text.replace(/\s+/g, " ").trim().toLowerCase();

/** Is this body still the seeded default (ignoring case and spacing)? An agency that never edited it has this. */
export function isSeededPortalLoginBody(body: string): boolean {
  return normalise(body) === normalise(SEEDED_PORTAL_LOGIN_BODY);
}

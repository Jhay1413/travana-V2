// Agency slug as it appears in a portal URL (?org=). Mirrors the server's pattern
// (server/v2/modules/portal/portal-org-slug.ts) so a junk value is never stored or sent.

const PORTAL_ORG_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const PORTAL_ORG_SLUG_MAX_LENGTH = 100;

/** Trimmed, lower-cased slug, or null when the value is not a usable slug. */
export function normalizeOrgSlug(raw: string | null | undefined): string | null {
  const slug = raw?.trim().toLowerCase();
  if (!slug || slug.length > PORTAL_ORG_SLUG_MAX_LENGTH) return null;
  return PORTAL_ORG_SLUG_PATTERN.test(slug) ? slug : null;
}

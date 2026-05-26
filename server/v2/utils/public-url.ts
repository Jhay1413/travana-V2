/**
 * Resolve the public, externally-reachable base URL for this server.
 * Falls back through several env vars so links work in prod, on Replit,
 * and locally — in that order of preference.
 *
 * Returns "" if nothing is configured; callers should treat that as a
 * misconfiguration (empty base = broken link in emails/SMS).
 */
export function getPublicBaseUrl(): string {
  const candidates = [
    process.env.PUBLIC_BASE_URL,
    process.env.APP_URL,
    process.env.REPLIT_URL,
    process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null,
    process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]?.trim()}`
      : null,
  ];
  for (const c of candidates) {
    if (c) return c.replace(/\/$/, "");
  }
  return "";
}

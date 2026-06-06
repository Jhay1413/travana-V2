/**
 * Resolve the public, externally-reachable base URL for this server.
 * Falls back through several env vars so links work in prod, on Replit,
 * and locally — in that order of preference.
 *
 * Returns "" if nothing is configured; callers should treat that as a
 * misconfiguration (empty base = broken link in emails/SMS).
 */
export function getPublicBaseUrl(): string {
  const isDeployment = Boolean(
    process.env.REPLIT_DEPLOYMENT || process.env.REPLIT_DEPLOYMENT_ID,
  );

  const replitDomains = process.env.REPLIT_DOMAINS
    ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]?.trim()}`
    : null;
  const replitDevDomain = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : null;

  // Explicit overrides always win (custom domains, etc.).
  // In a deployment, prefer the live REPLIT_DOMAINS over the dev/preview
  // domain so links in SMS/emails point at production. In dev, prefer the
  // workspace dev domain.
  const candidates = [
    process.env.PUBLIC_BASE_URL,
    process.env.APP_URL,
    process.env.REPLIT_URL,
    ...(isDeployment ? [replitDomains, replitDevDomain] : [replitDevDomain, replitDomains]),
  ];
  for (const c of candidates) {
    if (c) return c.replace(/\/$/, "");
  }
  return "";
}

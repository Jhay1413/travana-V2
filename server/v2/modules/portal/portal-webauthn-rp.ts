import { resolveLinkBase } from '../../utils/link-base';

export interface WebauthnRp {
  /** Relying-party id: the bare hostname the credential is bound to. */
  rpID: string;
  /** Exact origin the browser must report in clientDataJSON. */
  origin: string;
  /**
   * Two-host set-up only: every origin a ceremony may come from (the portal host and the staff host, while both are in
   * use). Verification accepts any of them and nothing else. Absent with one host, where `origin` is the only one.
   */
  origins?: string[];
}

export interface WebauthnRpInput {
  /** Configured public URL (BASE_URL / PUBLIC_BASE_URL / APP_URL / Replit domains), "" when none. */
  configured: string;
  /** Origin of the calling browser (Origin header, else protocol + host). */
  requestOrigin: string | null;
  isProduction: boolean;
  /** Origin of the portal host (PORTAL_BASE_URL) when the portal has its own host, else null/absent. */
  portalOrigin?: string | null;
  /** Origin of the staff site; only used together with `portalOrigin`. */
  staffOrigin?: string | null;
}

function originOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Two hosts. A credential is bound to its RP ID. When the portal host is the staff hostname or a subdomain of it, the RP ID
 * is the STAFF hostname (a page may use a registrable parent as its RP ID), so a Face ID set up on the staff host before the
 * move keeps working on the portal host. When the portal host is unrelated, the RP ID is the portal hostname and old
 * credentials simply fail there (the customer sets Face ID up again). Both origins are accepted while both may be in use.
 */
function resolveTwoHostRp(portalOrigin: string, staffOrigin: string): WebauthnRp {
  const portalHost = new URL(portalOrigin).hostname;
  const staffHost = new URL(staffOrigin).hostname;
  const underStaff = portalHost === staffHost || portalHost.endsWith(`.${staffHost}`);
  return { rpID: underStaff ? staffHost : portalHost, origin: portalOrigin, origins: [portalOrigin, staffOrigin] };
}

/**
 * Decides the RP ID and expected origin using the same rule as email links:
 * production trusts only the configured public URL; elsewhere the request's own
 * origin wins (so the dev workspace host works with no code change) and the
 * configured URL is the fallback. Returns null when the resulting URL is unusable
 * (e.g. a configured value with no scheme) so callers can fail generically.
 */
export function resolveWebauthnRp(input: WebauthnRpInput): WebauthnRp | null {
  const portalOrigin = originOf(input.portalOrigin);
  const staffOrigin = originOf(input.staffOrigin);
  if (portalOrigin && staffOrigin && portalOrigin !== staffOrigin) {
    // Production never looks at the request. Elsewhere the two-host rule applies only to a request from one of the two
    // configured origins (the two-host test set-up); any other origin keeps today's request-origin behaviour below.
    const fromKnownOrigin = [portalOrigin, staffOrigin].includes(originOf(input.requestOrigin) ?? '');
    if (input.isProduction || fromKnownOrigin) return resolveTwoHostRp(portalOrigin, staffOrigin);
  }
  const base = resolveLinkBase({
    configured: input.configured || null,
    requestOrigin: input.requestOrigin,
    isProduction: input.isProduction,
  });
  try {
    const url = new URL(base);
    // A value like "example.com" (no scheme) parses oddly or throws; only real web origins are usable.
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname) return null;
    return { rpID: url.hostname, origin: url.origin };
  } catch {
    return null;
  }
}

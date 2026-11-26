import { resolveLinkBase } from '../../utils/link-base';

export interface WebauthnRp {
  /** Relying-party id: the bare hostname the credential is bound to. */
  rpID: string;
  /** Exact origin the browser must report in clientDataJSON. */
  origin: string;
}

export interface WebauthnRpInput {
  /** Configured public URL (BASE_URL / PUBLIC_BASE_URL / APP_URL / Replit domains), "" when none. */
  configured: string;
  /** Origin of the calling browser (Origin header, else protocol + host). */
  requestOrigin: string | null;
  isProduction: boolean;
}

/**
 * Decides the RP ID and expected origin using the same rule as email links:
 * production trusts only the configured public URL; elsewhere the request's own
 * origin wins (so the dev workspace host works with no code change) and the
 * configured URL is the fallback. Returns null when the resulting URL is unusable
 * (e.g. a configured value with no scheme) so callers can fail generically.
 */
export function resolveWebauthnRp(input: WebauthnRpInput): WebauthnRp | null {
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

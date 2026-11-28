import { looksLikeQuoteToken } from "../../utils/quote-token";
import { toPortalBranding } from "../portal/portal-branding.service";
import { blockFor } from "../quote/quote-public.service";
import { pageMetaRepository } from "./page-meta.repository";
import type { PageMeta } from "./page-meta.types";

export const NEUTRAL_TITLE = "Your holiday portal";
export const NEUTRAL_DESCRIPTION = "Sign in to see your holidays.";
export const QUOTE_DESCRIPTION = "Open to see the details.";

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 500;
const QUOTE_PATH = /^\/view-quote\/([^/]+)\/?$/;

const cache = new Map<string, { meta: PageMeta; expires: number }>();

/** Test hook. */
export function resetPageMetaCache(): void {
  cache.clear();
}

export function neutralMeta(): PageMeta {
  return { title: NEUTRAL_TITLE, description: NEUTRAL_DESCRIPTION, imageUrl: null };
}

/** `origin` turns a site-relative logo path into an absolute address; with none, a relative logo is left out. */
function logoAddress(logoUrl: string | null, origin: string): string | null {
  if (!logoUrl) return null;
  if (/^https?:\/\//i.test(logoUrl)) return logoUrl;
  return origin ? `${origin}${logoUrl}` : null;
}

/**
 * Only the agency's name and logo, and only for a quote the public link would open right now. A blocked (booked,
 * unavailable, deleted client) or unknown token gets the neutral head: no agency, no quote.
 */
async function quoteMeta(token: string, origin: string): Promise<PageMeta> {
  const state = await pageMetaRepository.findAccessByToken(token);
  if (!state || blockFor(state)) return neutralMeta();
  const branding = toPortalBranding({ name: state.agencyName ?? "", logoUrl: state.agencyLogoUrl, brandColor: null, settings: state.agencySettings });
  if (!branding.name) return neutralMeta();
  return { title: `${branding.name} — your holiday quote`, description: QUOTE_DESCRIPTION, imageUrl: logoAddress(branding.logoUrl, origin) };
}

export const pageMetaService = {
  /**
   * The head for a customer-facing page, or null when the page keeps the app's own tags. `lookupAllowed` is asked only when a database read is needed, and says no when
   * the caller is over its rate limit: such a request gets the neutral head and costs no database read.
   */
  async forPath(pathname: string, opts: { origin: string; lookupAllowed: () => boolean; now?: number }): Promise<PageMeta | null> {
    if (pathname === "/portal" || pathname.startsWith("/portal/")) return neutralMeta();
    const match = QUOTE_PATH.exec(pathname);
    if (!match) return null;

    let token: string;
    try {
      token = decodeURIComponent(match[1] ?? "");
    } catch {
      return neutralMeta();
    }
    if (!looksLikeQuoteToken(token)) return neutralMeta();

    const now = opts.now ?? Date.now();
    const hit = cache.get(token);
    if (hit && hit.expires > now) return hit.meta;
    if (!opts.lookupAllowed()) return neutralMeta();

    let meta: PageMeta;
    try {
      meta = await quoteMeta(token, opts.origin);
    } catch (err) {
      // A lookup failure never breaks the page: it just gets the neutral head (and is not cached).
      console.error("[page-meta] lookup failed; serving the neutral head:", err);
      return neutralMeta();
    }
    if (cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
    cache.set(token, { meta, expires: now + CACHE_TTL_MS });
    return meta;
  },
};

import { portalRepository, type PortalDealRow } from './portal.repository';
import { verifyPortalToken } from './portal-auth';
import { normalizeOrgSlug } from './portal-org-slug';
import type {
  DealFiltersInput,
  ListDealsInput,
  PortalDealDto,
  PortalDealFiltersDto,
} from './portal.types';

// How long a deal stays live on the portal. A deal added longer ago than this is
// expired and must not appear in any portal list — Latest Deals, the Deals page,
// or For You. One constant so those three can't drift apart.
export const PORTAL_DEAL_WINDOW_DAYS = 7;

const DEALS_LIMIT = 50;
const FOR_YOU_LIMIT = 20;

interface DealsAudience {
  /** Verified portal client, or null when the caller has no usable session. */
  clientId: string | null;
  /** The agency whose deals may be shown, or null — in which case nothing is. */
  orgId: string | null;
}

/**
 * Decides whose deals a request may see. Fails closed:
 *  - a valid portal session scopes to the client's own agency (a client with no
 *    agency, or one that no longer exists, sees nothing — the slug is NOT a way around it);
 *  - without a session, an active agency slug scopes to that agency;
 *  - neither -> no agency, so callers return an empty list, never every agency's deals.
 * A client id is only ever taken from a verified token.
 */
async function resolveAudience(authorizationHeader: string | undefined, orgSlug: string | undefined): Promise<DealsAudience> {
  const payload = authorizationHeader?.startsWith('Bearer ')
    ? verifyPortalToken(authorizationHeader.slice(7))
    : null;

  if (payload?.clientId) {
    const client = await portalRepository.findClientOrg(payload.clientId);
    return { clientId: payload.clientId, orgId: client?.orgId ?? null };
  }

  // An unusable slug is treated as no slug (empty result), never an error.
  const slug = normalizeOrgSlug(orgSlug);
  if (slug) {
    const orgId = await portalRepository.findActiveOrgIdBySlug(slug);
    return { clientId: null, orgId };
  }

  return { clientId: null, orgId: null };
}

function buildImageMap(
  rows: Array<{ quoteId: string | null; url: string; isPrimary: boolean | null }>,
): Record<string, string> {
  const imageMap: Record<string, string> = {};
  for (const img of rows) {
    if (img.quoteId && (!imageMap[img.quoteId] || img.isPrimary)) {
      imageMap[img.quoteId] = img.url;
    }
  }
  return imageMap;
}

function buildTagMap(rows: Array<{ quoteId: string; tagName: string }>): Record<string, string[]> {
  const tagMap: Record<string, string[]> = {};
  for (const row of rows) {
    if (!tagMap[row.quoteId]) tagMap[row.quoteId] = [];
    tagMap[row.quoteId].push(row.tagName);
  }
  return tagMap;
}

async function enrichDealRows(results: PortalDealRow[]): Promise<PortalDealDto[]> {
  const quoteIds = results.map((r) => r.id);
  const tagMap = buildTagMap(await portalRepository.findTagsForQuotes(quoteIds));
  // Own quote images only — the shared accommodation library is no longer used
  // as a fallback anywhere, so what the client sees in the portal matches what
  // the agent arranged on the quote.
  const imageMap = buildImageMap(await portalRepository.findImagesForQuotes(quoteIds));

  return results.map((r) => ({
    id: r.id,
    token: r.token,
    title: r.title || `${r.destinationName || r.countryName || 'Holiday'} Getaway`,
    destination: r.destinationName && r.countryName
      ? `${r.destinationName}, ${r.countryName}`
      : r.countryName || r.destinationName || 'TBC',
    country: r.countryName || null,
    hotel: r.accommodationName || '',
    price: parseFloat(r.salesPrice || '0'),
    travel_date: r.travelDate,
    num_nights: r.numNights,
    image_url: imageMap[r.id] || '',
    quote_url: r.token ? `/portal/quote/${r.token}` : null,
    tags: tagMap[r.id] ?? [],
    portal_added_at: r.portalAddedAt
      ? (r.portalAddedAt instanceof Date ? r.portalAddedAt.toISOString() : r.portalAddedAt)
      : null,
  }));
}

export const portalDealsService = {
  async getDealFilters(input: DealFiltersInput): Promise<PortalDealFiltersDto> {
    const { orgId } = await resolveAudience(input.authorizationHeader, input.orgSlug);
    if (!orgId) return { countries: [], popularTags: [] };
    return portalRepository.findDealFilters(orgId);
  },

  async listDeals(input: ListDealsInput): Promise<PortalDealDto[]> {
    const { clientId, orgId } = await resolveAudience(input.authorizationHeader, input.orgSlug);
    if (!orgId) return [];

    // interests=1 restricts to deals sharing a tag with the signed-in client's saved
    // Travel Interests. Silently ignored (no filter) without a session or with no
    // saved interests, so the section never blanks out for a brand-new client.
    let clientTagIds: string[] | undefined;
    if (input.interests && clientId) {
      const tagIds = await portalRepository.findClientTagIds(clientId);
      if (tagIds.length > 0) clientTagIds = tagIds;
    }

    const results = await portalRepository.findDeals({
      orgId,
      country: input.country,
      tag: input.tag,
      limit: DEALS_LIMIT,
      recentDays: input.recent ? PORTAL_DEAL_WINDOW_DAYS : undefined,
      clientTagIds,
    });
    return enrichDealRows(results);
  },

  /** Personalised deals for a signed-in client, from their own agency only. */
  async listForYouDeals(clientId: string, recent: boolean): Promise<PortalDealDto[]> {
    const client = await portalRepository.findClientOrg(clientId);
    if (!client?.orgId) return [];

    const clientTagIds = await portalRepository.findClientTagIds(clientId);
    if (clientTagIds.length === 0) return [];

    const results = await portalRepository.findForYouDeals({
      orgId: client.orgId,
      clientTagIds,
      limit: FOR_YOU_LIMIT,
      recentDays: recent ? PORTAL_DEAL_WINDOW_DAYS : undefined,
    });
    return enrichDealRows(results);
  },
};

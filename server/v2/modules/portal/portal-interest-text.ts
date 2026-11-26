/** The message the agent receives when a customer taps "I'm interested" on a deal. */
export const DEAL_INTEREST_PREFIX = '❤️ Interested in deal: ';
export const DEAL_INTEREST_LEGACY_PREFIX = 'Interested in deal: ';

const INTEREST_START = /^(?:❤️ )?Interested in deal: /;

/** The marker that carries the deal id at the very end of a stored "interested" message, e.g. "[deal:<uuid>]". */
export const dealInterestMarker = (dealId: string): string => `[deal:${dealId}]`;
const DEAL_MARKER_AT_END = /\s*\[deal:([^\]\s]+)\]$/;

/** Removes the trailing deal-id marker from an "interested" message so a person only reads the deal's name. Any other text is returned as is. */
export function stripDealInterestMarker(text: string): string {
  return INTEREST_START.test(text) ? text.replace(DEAL_MARKER_AT_END, '') : text;
}

/**
 * The deal id in a stored "interested" message, or null for any other text. Reads the current wording
 * ("Interested in deal: <title> (<destination>) [deal:<id>]") and the two older ones that end with the bare id.
 */
export function dealIdFromInterestText(text: string): string | null {
  if (!INTEREST_START.test(text)) return null;
  const marked = DEAL_MARKER_AT_END.exec(text);
  if (marked) return marked[1];
  const legacy = /^(?:❤️ )?Interested in deal: (\S+)$/.exec(text);
  return legacy ? legacy[1] : null;
}

export interface InterestDealInfo {
  id: string;
  title: string | null;
  destinationName: string | null;
  countryName: string | null;
}

/** "Cyprus Beach Deal (Paphos, Cyprus)": the deal's title, then its destination when it has one. */
export function describeDeal(deal: InterestDealInfo): string {
  const clean = (v: string | null): string => (v ?? '').replace(/[\[\]\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  const title = clean(deal.title) || 'Holiday deal';
  const place = [clean(deal.destinationName), clean(deal.countryName)].filter((p, i, all) => p && all.indexOf(p) === i).join(', ');
  return place ? `${title} (${place})` : title;
}

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface InterestMessages {
  /** Stored for the customer's own chat; ends with the id marker, which is stripped before the customer reads it. */
  portalText: string;
  /** For the agent's inbox: the deal's name as a link to the deal's page. */
  chatHtml: string;
  /** Plain text for the agent's notification. */
  preview: string;
}

export function buildInterestMessages(deal: InterestDealInfo): InterestMessages {
  const label = describeDeal(deal);
  return {
    portalText: `${DEAL_INTEREST_PREFIX}${label} ${dealInterestMarker(deal.id)}`,
    chatHtml: `${escapeHtml(DEAL_INTEREST_PREFIX)}<a href="/quotes/${encodeURIComponent(deal.id)}">${escapeHtml(label)}</a>`,
    preview: `${DEAL_INTEREST_PREFIX}${label}`,
  };
}

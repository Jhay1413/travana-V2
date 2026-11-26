/** The message the agent receives when a customer taps "I'm interested" on a deal. */
export const DEAL_INTEREST_PREFIX = '❤️ Interested in deal: ';
export const DEAL_INTEREST_LEGACY_PREFIX = 'Interested in deal: ';

/**
 * A message longer than this is never an "interested" message (the server builds them from a bounded deal label),
 * so it is never scanned at all: customer text can be thousands of characters and must cost nothing to skip.
 */
export const INTEREST_TEXT_MAX_LENGTH = 600;

/** The marker that carries the deal id at the very end of a stored "interested" message, e.g. "[deal:<uuid>]". */
export const dealInterestMarker = (dealId: string): string => `[deal:${dealId}]`;
const MARKER_OPEN = '[deal:';
const UUID_LENGTH = 36;
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i; // fixed length: linear

/** Where the label starts when the text opens with one of the "interested" prefixes, else -1. Plain string checks, no pattern. */
function interestBodyStart(text: string): number {
  if (text.length > INTEREST_TEXT_MAX_LENGTH) return -1;
  if (text.startsWith(DEAL_INTEREST_PREFIX)) return DEAL_INTEREST_PREFIX.length;
  if (text.startsWith(DEAL_INTEREST_LEGACY_PREFIX)) return DEAL_INTEREST_LEGACY_PREFIX.length;
  return -1;
}

/** The marker at the very end of `text` (after `from`): its position and the deal id, or null. Linear: one lastIndexOf and fixed-size checks. */
function trailingMarker(text: string, from: number): { start: number; id: string } | null {
  if (!text.endsWith(']')) return null;
  const open = text.lastIndexOf(MARKER_OPEN);
  if (open < from) return null;
  const id = text.slice(open + MARKER_OPEN.length, text.length - 1);
  if (id.length !== UUID_LENGTH || !UUID_SHAPE.test(id)) return null;
  return { start: open, id };
}

/** Removes the trailing deal-id marker from an "interested" message so a person only reads the deal's name. Any other text is returned as is. */
export function stripDealInterestMarker(text: string): string {
  const from = interestBodyStart(text);
  if (from < 0) return text;
  const marker = trailingMarker(text, from);
  return marker ? text.slice(0, marker.start).trimEnd() : text;
}

/**
 * The deal id in a stored "interested" message, or null for any other text. Reads the current wording
 * ("Interested in deal: <title> (<destination>) [deal:<id>]") and the two older ones that end with the bare id.
 */
export function dealIdFromInterestText(text: string): string | null {
  const from = interestBodyStart(text);
  if (from < 0) return null;
  const marker = trailingMarker(text, from);
  if (marker) return marker.id;
  const bare = text.slice(from);
  return bare.length > 0 && !/\s/.test(bare) ? bare : null;
}

export interface InterestDealInfo {
  id: string;
  title: string | null;
  destinationName: string | null;
  countryName: string | null;
}

/** "Cyprus Beach Deal (Paphos, Cyprus)": the deal's title, then its destination when it has one. */
export function describeDeal(deal: InterestDealInfo): string {
  // Each part is cut first so the whole label stays far under INTEREST_TEXT_MAX_LENGTH (and the patterns below stay tiny).
  const clean = (v: string | null): string => (v ?? '').slice(0, 150).replace(/[\[\]\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
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

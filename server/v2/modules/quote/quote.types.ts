export type { Quote, InsertQuote } from "@shared/schema";
export type { QuoteFlight, QuoteAccomodation, QuoteTransfer, QuoteCarHire } from "@shared/schema";
export type { QuoteAttractionTicket, QuoteLoungePass, QuoteAirportParking, QuoteCruise } from "@shared/schema";
export type { DealImage, Passenger } from "@shared/schema";

/**
 * Lifecycle bucket for a quote published to the client portal, derived from
 * `quote.portal_added_at`:
 *  - "active"  → added within PORTAL_ACTIVE_WINDOW_DAYS
 *  - "expired" → added longer ago than that (or never stamped)
 *  - "all"     → no age filter
 */
export type PortalStatus = "all" | "active" | "expired";

/** How long a portal post counts as active before it is treated as expired. */
export const PORTAL_ACTIVE_WINDOW_DAYS = 7;

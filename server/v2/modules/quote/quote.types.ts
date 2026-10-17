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

/**
 * Social-post lifecycle of a free quote. DERIVED from travel_deal, never stored:
 *  - "not_generated" -> no travel_deal row
 *  - "draft"         -> travel_deal exists, not yet sent to OnlySocials
 *  - "scheduled"     -> sent to OnlySocials and postSchedule is in the future
 *  - "posted"        -> sent to OnlySocials and postSchedule has passed (or is unset)
 */
export type SocialStatus = "not_generated" | "draft" | "scheduled" | "posted";

export const SOCIAL_STATUSES = ["not_generated", "draft", "scheduled", "posted"] as const satisfies readonly SocialStatus[];

export const ENGAGEMENT_PERIODS = ["today", "yesterday", "week", "all"] as const;
export type EngagementPeriod = (typeof ENGAGEMENT_PERIODS)[number];

export interface RecentEngagementOptions {
  /** Force transaction.user_id = the caller, for every role. */
  mine?: boolean;
  period?: EngagementPeriod;
}

export interface SocialStatusCounts {
  total: number;
  not_generated: number;
  draft: number;
  scheduled: number;
  posted: number;
}

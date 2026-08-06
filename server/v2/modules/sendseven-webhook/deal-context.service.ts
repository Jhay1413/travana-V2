// Pinning + hydration of "the Facebook deal this conversation is about".
//
// When a customer messages us about a deal we posted ("the Tunisia holiday on
// the 29th October"), the reply worker vector-searches the posted-deal
// embeddings (ai_embeddings sourceType "deal" — see social-post/deal-embedding.ts)
// and PINS the winning deal on sendseven_conversation_state.context.dealRef.
// Each sales turn the pin is hydrated LIVE from the DB (never trusted from the
// embedding content, which may be stale) into a RetrievedDealContext the brain
// renders as a customer-visible prompt block.

import { socialPostRepository } from "../social-post/social-post.repository";
import { newQuoteRepository } from "../quote/quote.repository";
import type {
  EnquirySlots,
  RetrievedDealContext,
  RetrievedMatch,
} from "../ai-conversation/ai-conversation.types";

// The deal pinned to a conversation, stored on context.dealRef. `source` records
// HOW it was pinned — stronger sources must never be overwritten by weaker ones
// (meta > marker > vector; Phase 3 adds the first two).
export interface DealRef {
  travelDealId: string;
  quoteId: string;
  title: string;
  source: "vector" | "marker" | "meta";
  matchedAt: string;
  distance?: number;
}

// Stricter than the retrieval default (0.45): pinning the WRONG deal and
// confidently quoting its hotel/price is worse than not matching at all — a
// no-match just falls back to the normal enquiry flow.
export const DEAL_MATCH_MAX_DISTANCE = 0.35;
// Matches within this distance of the best one count as a near-tie, resolved
// by recency: two similar "All Inclusive Tunisia" posts should pin the one the
// customer most plausibly just saw.
const NEAR_TIE_DISTANCE = 0.03;

interface DealCandidate {
  travelDealId: string;
  quoteId: string;
  title: string;
  postScheduleMs: number;
  distance: number;
}

function parseCandidate(match: RetrievedMatch): DealCandidate | null {
  const meta = (match.metadata ?? {}) as Record<string, unknown>;
  const travelDealId = typeof meta.travelDealId === "string" ? meta.travelDealId : null;
  const quoteId = typeof meta.quoteId === "string" ? meta.quoteId : null;
  if (!travelDealId || !quoteId) return null;
  const postSchedule = typeof meta.postSchedule === "string" ? Date.parse(meta.postSchedule) : NaN;
  return {
    travelDealId,
    quoteId,
    title: typeof meta.title === "string" ? meta.title : "",
    postScheduleMs: Number.isNaN(postSchedule) ? 0 : postSchedule,
    distance: match.distance,
  };
}

/** Pick the deal to pin from vector matches (already distance-capped by the
 *  retrieve call): closest wins, near-ties resolved by most recent post. */
export function pickDealMatch(matches: RetrievedMatch[]): DealRef | null {
  const candidates = matches.map(parseCandidate).filter((c): c is DealCandidate => c !== null);
  if (candidates.length === 0) return null;
  const best = Math.min(...candidates.map((c) => c.distance));
  const winner = candidates
    .filter((c) => c.distance - best <= NEAR_TIE_DISTANCE)
    .sort((a, b) => b.postScheduleMs - a.postScheduleMs)[0];
  return {
    travelDealId: winner.travelDealId,
    quoteId: winner.quoteId,
    title: winner.title,
    source: "vector",
    matchedAt: new Date().toISOString(),
    distance: winner.distance,
  };
}

// True for the slot values seedSlotsFromDeal treats as "not yet answered".
function isBlank(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Deterministically seed the enquiry slots from the pinned deal, IN PLACE.
 *
 *  The prompt tells the model to extract the deal's basics into slots, but the
 *  model is unreliable at copying them (observed: it re-asked nights that the
 *  deal answers, and the created enquiry lacked the deal's departure airport).
 *  Seeding in code makes the deal's facts server-truth: they render as "Known
 *  enquiry details" (so the AI stops re-asking them) and land on the created
 *  enquiry. Only BLANK fields are filled — anything the customer stated
 *  themselves always wins, and later customer corrections still override via
 *  the normal mergeSlots(prior, turn) path. Idempotent, so calling it every
 *  sales turn while a deal is pinned is safe. */
export function seedSlotsFromDeal(slots: EnquirySlots, deal: RetrievedDealContext): void {
  const fill = <K extends keyof EnquirySlots>(key: K, value: EnquirySlots[K] | null | undefined) => {
    if (!isBlank(value) && isBlank(slots[key])) slots[key] = value as EnquirySlots[K];
  };
  fill("enquiryTitle", deal.title);
  fill("destinations", deal.destination ? [deal.destination] : null);
  fill("resorts", deal.resort ? [deal.resort] : null);
  fill("countries", deal.country ? [deal.country] : null);
  fill("travelDate", deal.travelDate);
  fill("nights", deal.nights);
  fill("boardBasis", deal.boardBasis ? [deal.boardBasis] : null);
  fill("departureAirports", deal.departureAirport ? [deal.departureAirport] : null);

  // Point the agent at the source deal (hotel + posted price ride along so the
  // created enquiry is self-explanatory). Appended once — the marker guards
  // against per-turn duplication.
  const marker = `From our Facebook deal post "${deal.title}"`;
  if (!slots.notes?.includes(marker)) {
    const detail = [deal.hotelName ? `hotel: ${deal.hotelName}` : null, deal.price ? `posted price ${deal.price}` : null]
      .filter(Boolean)
      .join(", ");
    const dealNote = detail ? `${marker} (${detail}).` : `${marker}.`;
    slots.notes = slots.notes?.trim() ? `${slots.notes.trim()} ${dealNote}` : dealNote;
  }
}

/** Load the pinned deal's live details (posted caption fields + the quote's
 *  hotel/board basis/flight times) for the prompt. Best-effort: null on any
 *  failure or if the deal row is gone — the turn proceeds without the block. */
export async function hydrateDealReplyContext(ref: DealRef): Promise<RetrievedDealContext | null> {
  try {
    const [deal, quoteCtx] = await Promise.all([
      socialPostRepository.findById(ref.travelDealId),
      newQuoteRepository.findDealReplyContext(ref.quoteId),
    ]);
    if (!deal) return null;
    const primaryAccom =
      quoteCtx.accommodations.find((a) => a.is_primary) ?? quoteCtx.accommodations[0] ?? null;
    return {
      title: deal.title,
      travelDate: deal.travelDate ?? null,
      nights: deal.nights ?? null,
      boardBasis: deal.boardBasis ?? primaryAccom?.board_basis_name ?? null,
      departureAirport: deal.departureAirport ?? null,
      price: deal.price ? `from £${deal.price} per person` : null,
      hotelName: primaryAccom?.accomodation_name ?? null,
      resort: primaryAccom?.resort_name ?? null,
      destination: primaryAccom?.destination_name ?? null,
      country: primaryAccom?.country_name ?? null,
      resortSummary: deal.resortSummary ?? null,
      flights: quoteCtx.flights.map((f) => ({
        direction: f.flight_type ?? null,
        flightNumber: f.flight_number ?? null,
        from: f.departing_airport_name ?? null,
        to: f.arrival_airport_name ?? null,
        departs: f.departure_date_time ? new Date(f.departure_date_time).toISOString() : null,
        arrives: f.arrival_date_time ? new Date(f.arrival_date_time).toISOString() : null,
      })),
    };
  } catch (err) {
    console.warn(
      `[deal-context] hydrate failed (deal=${ref.travelDealId} quote=${ref.quoteId}):`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

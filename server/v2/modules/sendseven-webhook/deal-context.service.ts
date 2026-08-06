// Pinning + hydration of "the Facebook deal this conversation is about".
//
// When a customer messages us about a deal we posted ("the Tunisia holiday on
// the 29th October"), the reply worker vector-searches the posted-deal
// embeddings (ai_embeddings sourceType "deal" — see social-post/deal-embedding.ts)
// and PINS the winning deal on sendseven_conversation_state.context.dealRef.
// Each sales turn the pin is hydrated LIVE from the DB (never trusted from the
// embedding content, which may be stale) into a RetrievedDealContext the brain
// renders as a customer-visible prompt block.

import { aiEmbeddingsService } from "../ai-embeddings/ai-embeddings.service";
import { socialPostRepository } from "../social-post/social-post.repository";
import { newQuoteRepository } from "../quote/quote.repository";
import type {
  EnquirySlots,
  RetrievedContext,
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

// Auto-pin cutoff. Pinning the WRONG deal and confidently quoting its
// hotel/price is worse than not matching at all — but observed distances say
// 0.35 was too strict: a message carrying the deal title VERBATIM plus date
// words scored 0.332, and the title alone scored just over the old bar.
// 0.40 keeps verbatim-title messages pinning; vaguer mentions fall to the
// candidate band below instead of silently missing.
export const DEAL_MATCH_MAX_DISTANCE = 0.4;
// Candidate band: matches in (DEAL_MATCH_MAX_DISTANCE, this] are too vague to
// pin ("i saw a deal for tunisia last night") but plausible enough that the AI
// should ask WHICH post they saw, offering these titles. Retrieval runs with
// this wider cutoff; pickDealMatch re-applies the strict one for pinning.
export const DEAL_CANDIDATE_MAX_DISTANCE = 0.6;
// Matches within this distance of the best one count as a near-tie, resolved
// by recency: two similar "All Inclusive Tunisia" posts should pin the one the
// customer most plausibly just saw.
const NEAR_TIE_DISTANCE = 0.03;

interface DealCandidate {
  travelDealId: string;
  quoteId: string;
  title: string;
  travelDate: string | null;
  price: string | null;
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
    travelDate: typeof meta.travelDate === "string" ? meta.travelDate : null,
    price: typeof meta.price === "string" ? meta.price : null,
    postScheduleMs: Number.isNaN(postSchedule) ? 0 : postSchedule,
    distance: match.distance,
  };
}

const MONTH_NAMES_LOWER = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function ordinal(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  const suffix = ["th", "st", "nd", "rd"][day % 10] ?? "th";
  return `${day}${["st", "nd", "rd"].includes(suffix) ? suffix : "th"}`;
}

// The common ways a deal's travel date gets written in a message or appears in
// a screenshot's extracted text: ISO, dd/mm/yyyy, "12 April", "12th April",
// "April 12". All lowercase — callers compare against a lowercased query.
function dateVariants(iso: string): string[] {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return [];
  const day = d.getUTCDate();
  const month = d.getUTCMonth();
  const year = d.getUTCFullYear();
  const monthName = MONTH_NAMES_LOWER[month];
  const dd = String(day).padStart(2, "0");
  const mm = String(month + 1).padStart(2, "0");
  return [
    d.toISOString().slice(0, 10),
    `${dd}/${mm}/${year}`,
    `${day}/${month + 1}/${year}`,
    `${day} ${monthName}`,
    `${ordinal(day)} ${monthName}`,
    `${monthName} ${day}`,
  ];
}

// The deal's posted price appearing as a standalone number ("£369", "369.00",
// "from 369") — digit-boundary guarded so phone numbers/references can't hit.
function priceAppearsIn(q: string, price: string): boolean {
  const whole = price.replace(/[^\d.]/g, "").split(".")[0];
  if (whole.length < 2) return false;
  return new RegExp(`(?<!\\d)${whole}(?:\\.\\d{2})?(?!\\d)`).test(q);
}

// A distinctive fact from the post appearing verbatim in the query: the exact
// travel date or the exact posted price. Nights deliberately excluded — "4
// nights" is shared by too many deals to identify one.
function strongSignalHit(c: DealCandidate, q: string): boolean {
  if (c.price && priceAppearsIn(q, c.price)) return true;
  if (c.travelDate && dateVariants(c.travelDate).some((v) => q.includes(v))) return true;
  return false;
}

function toDealRef(winner: DealCandidate): DealRef {
  return {
    travelDealId: winner.travelDealId,
    quoteId: winner.quoteId,
    title: winner.title,
    source: "vector",
    matchedAt: new Date().toISOString(),
    distance: winner.distance,
  };
}

/** Pick the deal to pin from vector matches.
 *
 *  1. TITLE RESCUE (deterministic, beats distance): if exactly ONE deal's full
 *     title appears verbatim (case-insensitive) in the query text — the
 *     customer named it, or a screenshot's extracted text contains it — that
 *     IS the deal. Distance ranking is unreliable between sibling posts
 *     (observed: a "Spring Time in Rome" screenshot scored 0.461, ranked
 *     BEHIND "Late Rome Deal"@0.443); a verbatim title is not.
 *  2. Otherwise only matches within the strict pin cutoff qualify (retrieval
 *     runs at the wider candidate cutoff); closest wins, near-ties resolved
 *     by most recent post. */
export function pickDealMatch(matches: RetrievedMatch[], queryText?: string): DealRef | null {
  const all = matches.map(parseCandidate).filter((c): c is DealCandidate => c !== null);
  if (all.length === 0) return null;

  if (queryText?.trim()) {
    const q = queryText.toLowerCase().replace(/\s+/g, " ");
    const titleHits = all.filter((c) => {
      const t = c.title.trim().toLowerCase().replace(/\s+/g, " ");
      // Very short titles substring-match too easily ("rome" would hit every
      // Rome message) — require some substance before trusting the rescue.
      return t.length >= 6 && q.includes(t);
    });
    if (new Set(titleHits.map((c) => c.travelDealId)).size === 1) {
      return toDealRef([...titleHits].sort((a, b) => a.distance - b.distance)[0]);
    }
    // 1b. FIELD RESCUE: no (unique) title in the text, but exactly one deal's
    // distinctive facts — its exact travel date or posted price — appear in
    // it. A screenshot's extracted fields carry these even when the headline
    // is stylised or cropped, and they identify sibling posts far better than
    // embedding distance does.
    const fieldHits = all.filter((c) => strongSignalHit(c, q));
    if (new Set(fieldHits.map((c) => c.travelDealId)).size === 1) {
      return toDealRef([...fieldHits].sort((a, b) => a.distance - b.distance)[0]);
    }
  }

  const candidates = all.filter((c) => c.distance <= DEAL_MATCH_MAX_DISTANCE);
  if (candidates.length === 0) return null;
  const best = Math.min(...candidates.map((c) => c.distance));
  const winner = candidates
    .filter((c) => c.distance - best <= NEAR_TIE_DISTANCE)
    .sort((a, b) => b.postScheduleMs - a.postScheduleMs)[0];
  return toDealRef(winner);
}

// What the candidates prompt block shows per possible deal — enough for the
// customer to recognise which post they saw (title/date/nights/price), pulled
// from embedding metadata so no DB hit happens before a real pin.
export interface DealCandidateInfo {
  title: string;
  travelDate?: string | null;
  nights?: number | null;
  price?: string | null;
  distance: number;
}

/** The possible-but-unconfirmed deals to offer when nothing pinned: every
 *  parseable match (retrieval already capped at DEAL_CANDIDATE_MAX_DISTANCE),
 *  closest first, deduped by deal. Call only when pickDealMatch returned null. */
export function pickDealCandidates(matches: RetrievedMatch[], limit = 3): DealCandidateInfo[] {
  const seen = new Set<string>();
  const out: DealCandidateInfo[] = [];
  for (const match of [...matches].sort((a, b) => a.distance - b.distance)) {
    const c = parseCandidate(match);
    if (!c || seen.has(c.travelDealId)) continue;
    seen.add(c.travelDealId);
    const meta = (match.metadata ?? {}) as Record<string, unknown>;
    out.push({
      title: c.title,
      travelDate: typeof meta.travelDate === "string" ? meta.travelDate : null,
      nights: typeof meta.nights === "number" ? meta.nights : null,
      price: typeof meta.price === "string" ? meta.price : null,
      distance: c.distance,
    });
    if (out.length >= limit) break;
  }
  return out;
}

// "2027-04-12T07:05:00.000Z" → "12/04/2027 07:05" — UK-format date+time for
// the agent-facing Post reference note.
function ukDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  return `${date} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
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

  // The agent-facing "Post reference" note: the deal facts that have NO slot
  // of their own — hotel, flight numbers/times, posted price, luggage &
  // transfers — so they reach the created enquiry even though the customer
  // never asked about them in chat. Slot-mapped facts (date/nights/board/
  // airport/destination) are deliberately NOT repeated here; they surface as
  // proper enquiry fields via the seeds above. Dates in UK format. Appended
  // once — the marker guards per-turn duplication.
  const marker = `Post reference: "${deal.title}"`;
  if (!slots.notes?.includes(marker)) {
    const detailLines: string[] = [];
    if (deal.hotelName) detailLines.push(`• Hotel: ${deal.hotelName}`);
    if (deal.price) detailLines.push(`• Posted price: ${deal.price}`);
    for (const f of deal.flights ?? []) {
      const label = f.direction
        ? `${f.direction.charAt(0).toUpperCase()}${f.direction.slice(1)} flight`
        : "Flight";
      const route = f.from && f.to ? `${f.from} → ${f.to}` : f.from || f.to || null;
      const bits = [
        f.flightNumber ? `${label} ${f.flightNumber}` : label,
        route,
        f.departs ? `departs ${ukDateTime(f.departs)}` : null,
        f.arrives ? `arrives ${ukDateTime(f.arrives)}` : null,
      ].filter(Boolean);
      if (bits.length > 1) detailLines.push(`• ${bits.join(", ")}`);
    }
    if (deal.luggageTransfers) detailLines.push(`• Luggage & transfers: ${deal.luggageTransfers}`);
    const dealNote = detailLines.length ? `${marker}\n${detailLines.join("\n")}` : marker;
    slots.notes = slots.notes?.trim() ? `${slots.notes.trim()}\n\n${dealNote}` : dealNote;
  }
}

export interface DealTurnResolution {
  // Set ONLY when this turn pinned a new deal — the caller persists it onto
  // its conversation context (each driver has its own context store).
  pinnedNow: DealRef | null;
  deal: RetrievedDealContext | null;
  dealCandidates?: RetrievedContext["dealCandidates"];
}

/** The complete per-turn deal step, shared by BOTH drivers (reply-worker and
 *  internal-chat-testflow) so the live bot and the Test AI sandbox cannot
 *  drift: retrieval at the candidate cutoff (only while unpinned), pinning
 *  (title rescue → field rescue → strict distance), candidate collection,
 *  live hydration, the tweak-check flag, and slot seeding (mutates `slots`).
 *
 *  Drivers differ ONLY in how they assemble `query` (their message stores
 *  differ) and in persisting the returned pin / consuming the tweak check —
 *  both driver-side, both one line. */
export async function resolveDealTurn(input: {
  orgId: string;
  // Log prefix, e.g. "conv=<id>" (live) or "session=<id>" (test flow).
  logLabel: string;
  existingRef?: DealRef;
  checkAsked?: boolean;
  query: string;
  slots: EnquirySlots;
}): Promise<DealTurnResolution> {
  const { orgId, logLabel, existingRef, checkAsked, query, slots } = input;
  let ref = existingRef ?? null;
  let pinnedNow: DealRef | null = null;
  let dealCandidates: DealTurnResolution["dealCandidates"];

  if (!ref) {
    const matches = await aiEmbeddingsService.retrieve({
      orgId,
      sourceType: "deal",
      query,
      limit: 3,
      maxDistance: DEAL_CANDIDATE_MAX_DISTANCE,
    });
    const pinned = pickDealMatch(matches, query);
    if (pinned) {
      ref = pinned;
      pinnedNow = pinned;
      console.log(
        `[deal-context] ${logLabel} pinned deal=${pinned.travelDealId} "${pinned.title}" ` +
          `source=${pinned.source} distance=${pinned.distance?.toFixed(3) ?? "n/a"}`,
      );
    } else {
      const candidates = pickDealCandidates(matches);
      if (candidates.length) {
        dealCandidates = candidates.map(({ distance: _d, ...c }) => c);
        console.log(
          `[deal-context] ${logLabel} deal candidates offered: ` +
            candidates.map((c) => `"${c.title}"@${c.distance.toFixed(3)}`).join(", "),
        );
      }
    }
  }

  // Hydrated fresh every turn (cheap: two small queries) so the AI always
  // quotes CURRENT hotel/flight detail, never the embedding's snapshot.
  const deal = ref ? await hydrateDealReplyContext(ref) : null;
  if (deal) {
    deal.tweakCheckPending = !checkAsked;
    seedSlotsFromDeal(slots, deal);
  }
  return { pinnedNow, deal, dealCandidates };
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
      luggageTransfers: deal.luggageTransfers ?? null,
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

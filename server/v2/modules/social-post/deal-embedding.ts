// Pure text/metadata builders for the SendSeven AI vector store
// (ai_embeddings, sourceType = "deal"). No DB access here — see
// social-post.service.ts for the schedule/reschedule/update/delete sync hooks
// and scripts/backfill-deal-embeddings.ts for the one-off backfill.
//
// Unlike quote embeddings (internal-only, price deliberately stripped — see
// quote-embedding.ts), a travel deal is the caption we PUBLISHED on Facebook.
// Every field here is already public, so price is embedded on purpose:
// customers quote it back ("the £299 Tunisia one") and the AI is allowed to
// repeat it in replies.
//
// Built from the structured travel_deal columns, NOT the `post` HTML —
// formatPostHTML assembles the caption from these same columns, so the columns
// carry identical information without the emoji/markup/contact-block noise.

import type { TravelDeal } from "@shared/schema";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// "2026-10-29" → "2026-10-29 (29 October 2026)". Customers echo the caption's
// human wording ("the 29th October one"), so the spelled-out form is what makes
// date mentions match; the ISO form keeps it unambiguous.
function formatTravelDateLine(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const iso = date.toISOString().slice(0, 10);
  const human = `${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  return `${iso} (${human})`;
}

/** Build the human-readable text blob for embedding. All public caption data —
 *  price included. Empty/missing fields are skipped cleanly. */
export function buildDealEmbeddingText(deal: TravelDeal): string {
  const lines: Array<[string, string | null]> = [
    ["Title", deal.title || null],
    ["Subtitle", deal.subtitle || null],
    ["Travel date", formatTravelDateLine(deal.travelDate)],
    ["Nights", deal.nights ? String(deal.nights) : null],
    ["Board basis", deal.boardBasis || null],
    ["Departure airport", deal.departureAirport || null],
    ["Luggage & transfers", deal.luggageTransfers || null],
    ["Price", deal.price ? `from £${deal.price} per person` : null],
    ["Resort", deal.resortSummary || null],
    ["Hashtags", deal.hashtags?.length ? deal.hashtags.join(" ") : null],
  ];

  return lines
    .filter((entry): entry is [string, string] => !!entry[1])
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

/** Structured metadata for pinning/filtering: ids to hydrate live quote detail
 *  from (hotel, flight times), plus the post schedule for recency ranking. */
export function buildDealEmbeddingMetadata(deal: TravelDeal): Record<string, unknown> {
  return {
    travelDealId: deal.id,
    quoteId: deal.quote_id,
    onlySocialsId: deal.onlySocialsId ?? null,
    postSchedule: deal.postSchedule ? deal.postSchedule.toISOString() : null,
    travelDate: deal.travelDate ?? null,
    nights: deal.nights ?? null,
    price: deal.price ?? null,
    title: deal.title,
  };
}

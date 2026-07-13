// Pure text/metadata builders for the SendSeven AI vector store
// (ai_embeddings, sourceType = "quote"). No DB access here — see
// quote.service.ts for the create/update/delete sync hooks and
// scripts/backfill-quote-embeddings.ts for the one-off backfill.
//
// IMPORTANT: `content` is embedded and may be surfaced verbatim in an AI reply,
// so it must be built from RESOLVED NAMES ONLY (never raw ids) and must NEVER
// include the firm sales price — price lives in metadata for internal
// filtering only.

export interface QuoteEmbeddingFlight {
  departing_airport_name?: string | null;
}

export interface QuoteEmbeddingAccommodation {
  accomodation_name?: string | null;
  board_basis_name?: string | null;
}

// Shape accepted by the builders below. Covers both the array-based projection
// returned by quote.repository#findWithDetails and the single-value projection
// used by findFreeQuotesPaginated / the backfill's dedicated batch query — only
// the fields that actually exist in those projections are included.
export interface QuoteEmbeddingDetails {
  id: string;
  quote_ref?: string | null;
  title?: string | null;
  quote_status?: string | null;
  isFreeQuote?: boolean | null;
  sales_price?: string | number | null;
  price_per_person?: string | number | null;
  num_of_nights?: number | null;
  adult?: number | null;
  child?: number | null;
  infant?: number | null;
  travel_date?: string | Date | null;
  holiday_type_name?: string | null;
  main_tour_operator_name?: string | null;
  country_name?: string | null;
  destination_name?: string | null;
  resort_name?: string | null;
  // Single-value readable-name fields (findFreeQuotesPaginated / backfill query).
  board_basis_name?: string | null;
  departing_airport_name?: string | null;
  // Array-shaped readable-name fields (findWithDetails).
  accommodations?: QuoteEmbeddingAccommodation[] | null;
  flights?: QuoteEmbeddingFlight[] | null;
}

function formatDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function resolveBoardBasisName(details: QuoteEmbeddingDetails): string | null {
  const fromList = details.accommodations?.find((a) => !!a.board_basis_name)?.board_basis_name;
  return fromList || details.board_basis_name || null;
}

function resolveAccommodationName(details: QuoteEmbeddingDetails): string | null {
  return details.accommodations?.find((a) => !!a.accomodation_name)?.accomodation_name || null;
}

function resolveDepartingAirportNames(details: QuoteEmbeddingDetails): string[] {
  const names = new Set<string>();
  for (const flight of details.flights ?? []) {
    if (flight.departing_airport_name) names.add(flight.departing_airport_name);
  }
  if (names.size === 0 && details.departing_airport_name) names.add(details.departing_airport_name);
  return [...names];
}

function resolveDestinationLine(details: QuoteEmbeddingDetails): string | null {
  const parts = [details.resort_name, details.destination_name, details.country_name].filter(
    (part, index, arr): part is string => !!part && arr.indexOf(part) === index,
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

function resolvePartyLine(details: QuoteEmbeddingDetails): string | null {
  const parts: string[] = [];
  if (details.adult) parts.push(`${details.adult} adult${details.adult === 1 ? "" : "s"}`);
  if (details.child) parts.push(`${details.child} child${details.child === 1 ? "" : "ren"}`);
  if (details.infant) parts.push(`${details.infant} infant${details.infant === 1 ? "" : "s"}`);
  return parts.length > 0 ? parts.join(", ") : null;
}

/** Build a human-readable text blob for embedding, from resolved names only.
 *  Never includes the firm price. Empty/missing fields are skipped cleanly. */
export function buildQuoteEmbeddingText(details: QuoteEmbeddingDetails): string {
  const lines: Array<[string, string | null]> = [
    ["Title", details.title ?? null],
    ["Holiday type", details.holiday_type_name ?? null],
    ["Destination", resolveDestinationLine(details)],
    ["Accommodation", resolveAccommodationName(details)],
    ["Board basis", resolveBoardBasisName(details)],
    ["Departure airport", resolveDepartingAirportNames(details).join(", ") || null],
    ["Nights", details.num_of_nights ? String(details.num_of_nights) : null],
    ["Party", resolvePartyLine(details)],
    ["Travel date", formatDate(details.travel_date)],
    ["Tour operator", details.main_tour_operator_name ?? null],
  ];

  return lines
    .filter((entry): entry is [string, string] => !!entry[1])
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

/** Build structured metadata for internal filtering only. Price lives HERE,
 *  never in the embedded content. */
export function buildQuoteEmbeddingMetadata(details: QuoteEmbeddingDetails): Record<string, unknown> {
  return {
    quoteRef: details.quote_ref ?? null,
    status: details.quote_status ?? null,
    isFreeQuote: details.isFreeQuote ?? true,
    destination: details.destination_name ?? null,
    resort: details.resort_name ?? null,
    country: details.country_name ?? null,
    nights: details.num_of_nights ?? null,
    adults: details.adult ?? null,
    children: details.child ?? null,
    infants: details.infant ?? null,
    travelDate: formatDate(details.travel_date),
    price: details.sales_price ?? null,
    pricePerPerson: details.price_per_person ?? null,
  };
}

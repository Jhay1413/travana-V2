import type { ImportValidation, ImportValidationIssue } from "@/features/quote/api/use-page-capture-import";

// Money fields the API will never auto-fill when an issue on them is an
// `error` — the agent types the number instead of trusting one that failed
// validation (EXTRACTION_STATUS.md §2, "Validation blocking" decision).
export const MONEY_FIELDS = ["sales_price", "price_per_person"] as const;
export type MoneyField = (typeof MONEY_FIELDS)[number];

function isMoneyField(field: string | undefined): field is MoneyField {
  return !!field && (MONEY_FIELDS as readonly string[]).includes(field);
}

// Which raw scraped keys does a money field's server-side name correspond to
// on the quote object handed to the form importer? Both are read verbatim
// from `ScrapedQuoteJson` (server/v2/modules/scraper/extraction/extraction.validate.ts),
// so the key on `quote` is the same string as `issue.field`.
export function getMoneyFieldsNeedingAttention(validation: ImportValidation | undefined): Set<MoneyField> {
  const needsAttention = new Set<MoneyField>();
  if (!validation) return needsAttention;
  for (const issue of validation.issues) {
    if (issue.level === "error" && isMoneyField(issue.field)) {
      needsAttention.add(issue.field);
    }
  }
  return needsAttention;
}

// Removes money fields that failed validation from the quote payload before
// it reaches the form importer, so they're left blank rather than populated
// with a value that might be wrong. Everything else (including fields with
// only a WARNING) still auto-fills.
export function withMoneyFieldsQuarantined(
  quote: Record<string, unknown>,
  validation: ImportValidation | undefined,
): Record<string, unknown> {
  const needsAttention = getMoneyFieldsNeedingAttention(validation);
  if (needsAttention.size === 0) return quote;
  const sanitized = { ...quote };
  for (const field of needsAttention) delete sanitized[field];
  return sanitized;
}

// Human labels for the field names the validator names — falls back to the
// raw field string for anything not in this list (e.g. `flights[0].foo`),
// so a new server-side code naming a field we haven't labelled yet still
// renders something readable rather than nothing.
const FIELD_LABELS: Record<string, string> = {
  sales_price: "Sales price",
  price_per_person: "Price per person",
  currency: "Currency",
  travel_date: "Travel date",
  no_of_nights: "Nights",
  itinerary: "Itinerary",
  ship_name: "Ship name",
  accommodation: "Accommodation",
  quote_title: "Quote title",
  cruise_title: "Cruise title",
};

export function fieldLabel(field: string | undefined): string | undefined {
  if (!field) return undefined;
  return FIELD_LABELS[field] ?? field;
}

// Copy written from the agent's side of the screen — what's wrong and what to
// do about it — rather than the raw code. Codes not listed here (a
// server-side addition the client doesn't know about yet) fall back to the
// issue's own message, so an unrecognised code still renders something
// useful instead of nothing.
const ISSUE_COPY: Record<string, string> = {
  PRICE_ZERO: "The price didn't extract — the capture may have been taken before the page finished loading. Re-capture, or enter the price manually.",
  PRICE_PARTY_MISMATCH: "The total price doesn't match price-per-person × travellers — one of the two extracted wrong (this is the bug where a per-person fare gets recorded as the total). Check both and enter the total manually.",
  PRICE_BELOW_PER_PERSON: "The total price is lower than the per-person price, which can't be right. Check both and enter the total manually.",
  CURRENCY_MISMATCH: "The currency on the form doesn't match what the page or link actually says. Check the price is in the right currency before saving.",
  CURRENCY_UNVERIFIED: "Nothing on the page confirmed the currency, so it's a guess. Check it's correct before saving.",
  DATE_NOT_ISO: "The date didn't come through in a format we could read. Enter it manually.",
  DATE_OUT_OF_RANGE: "This date falls outside a plausible booking window — the extraction likely grabbed the wrong text. Check and correct it.",
  NIGHTS_ITINERARY_MISMATCH: "The number of nights doesn't match the day-by-day itinerary on the page. Check the nights against the itinerary.",
  NIGHTS_SOURCE_CONFLICT: "Two different parts of the page disagree on how many nights this is. Check and correct it.",
  FIELD_LOOKS_LIKE_PROSE: "This field pulled in what reads like marketing text, not a name — it may have grabbed the wrong part of the page. Check and correct it.",
  SPEC_COVERAGE_LOW: "Most of this supplier's fields came back empty — its extraction rules may be out of date. Check the whole form before saving, and flag this supplier for review.",
  CAPTURE_INCOMPLETE: "The capture looks incomplete — it may have been taken before the page finished loading. Re-capture with the deal fully loaded (and any details panel or drawer open), or fill in the missing fields manually.",
  CRUISE_ITINERARY_MISSING: "This looks like a cruise with a day-by-day itinerary, but none came through — it's usually hidden behind a collapsed panel or drawer. Re-capture with that panel open.",
};

export interface ImportIssueDisplay {
  level: ImportValidationIssue["level"];
  fieldLabel?: string;
  text: string;
}

export function describeImportIssue(issue: ImportValidationIssue): ImportIssueDisplay {
  return {
    level: issue.level,
    fieldLabel: fieldLabel(issue.field),
    text: ISSUE_COPY[issue.code] ?? issue.message,
  };
}

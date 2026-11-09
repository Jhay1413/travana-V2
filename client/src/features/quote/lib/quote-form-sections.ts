// Side-menu sections of the quote form per holiday type, and when each counts as done.
// Pure so it can be unit tested; the form feeds it values from useWatch.

export type QuoteHolidayKind = "package" | "hot-tub" | "cruise";

export type QuoteSectionKey =
  | "overview"
  | "travel"
  | "hotel"
  | "lodge"
  | "cruise"
  | "flights"
  | "extras"
  | "images"
  | "costings"
  | "tags";

export interface QuoteSectionDef {
  key: QuoteSectionKey;
  label: string;
  /** Optional sections are not counted in "N of M" and tick when they have content. */
  optional?: boolean;
}

/** The package type is matched by its lookup name (same names the form already uses). */
export function holidayKindFromName(name: string | undefined | null): QuoteHolidayKind {
  if (name === "Hot Tub Break") return "hot-tub";
  if (name === "Cruise Package") return "cruise";
  return "package";
}

const OVERVIEW: QuoteSectionDef = { key: "overview", label: "Overview" };
const TRAVEL: QuoteSectionDef = { key: "travel", label: "Travel" };
const FLIGHTS: QuoteSectionDef = { key: "flights", label: "Flights" };
const EXTRAS: QuoteSectionDef = { key: "extras", label: "Extras", optional: true };
const IMAGES: QuoteSectionDef = { key: "images", label: "Images" };
const COSTINGS: QuoteSectionDef = { key: "costings", label: "Costings" };
const TAGS: QuoteSectionDef = { key: "tags", label: "Tags", optional: true };

/** Sections shown for a holiday type, in page order. Cruise-only quotes have no flights. */
export function quoteSectionsFor(kind: QuoteHolidayKind, opts: { cruiseOnly?: boolean } = {}): QuoteSectionDef[] {
  if (kind === "hot-tub") {
    return [OVERVIEW, TRAVEL, { key: "lodge", label: "Lodge" }, EXTRAS, IMAGES, COSTINGS, TAGS];
  }
  if (kind === "cruise") {
    return [OVERVIEW, TRAVEL, { key: "cruise", label: "Cruise" }, ...(opts.cruiseOnly ? [] : [FLIGHTS]), EXTRAS, IMAGES, COSTINGS, TAGS];
  }
  return [OVERVIEW, TRAVEL, { key: "hotel", label: "Hotel" }, FLIGHTS, EXTRAS, IMAGES, COSTINGS, TAGS];
}

export interface QuoteSectionInputs {
  packageType?: string | null;
  quoteTitle?: string | null;
  tourOperatorId?: string | null;
  travelDate?: string | null;
  nights?: number | string | null;
  passengersAdults?: number | string | null;
  accommodationId?: string | null;
  parkId?: string | null;
  lodgeId?: string | null;
  cruiseLine?: string | null;
  shipName?: string | null;
  outboundDepartAirportId?: string | null;
  outboundArriveAirportId?: string | null;
  outboundDepartDate?: string | null;
  inboundDepartAirportId?: string | null;
  inboundDepartDate?: string | null;
  price?: number | string | null;
  /** Number of images currently in the picker. */
  imageCount: number;
  /** Number of extra rows (transfers, car hire, ...). */
  extrasCount: number;
  tagCount: number;
}

const filled = (v: string | null | undefined): boolean => typeof v === "string" && v.trim() !== "";
const num = (v: number | string | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Whether each section has what it needs. Keys not shown for the holiday type are still computed. */
export function sectionsDone(i: QuoteSectionInputs): Record<QuoteSectionKey, boolean> {
  return {
    overview: filled(i.packageType) && filled(i.quoteTitle) && filled(i.tourOperatorId),
    travel: filled(i.travelDate) && num(i.nights) >= 1 && num(i.passengersAdults) >= 1,
    hotel: filled(i.accommodationId),
    lodge: filled(i.parkId) && filled(i.lodgeId),
    cruise: filled(i.cruiseLine) && filled(i.shipName),
    flights:
      filled(i.outboundDepartAirportId) &&
      filled(i.outboundArriveAirportId) &&
      filled(i.outboundDepartDate) &&
      filled(i.inboundDepartAirportId) &&
      filled(i.inboundDepartDate),
    extras: i.extrasCount > 0,
    images: i.imageCount >= 1,
    costings: num(i.price) > 0,
    tags: i.tagCount > 0,
  };
}

/** The visible sections with their done flag, ready for the side menu and countDone. */
export function quoteSectionState(
  kind: QuoteHolidayKind,
  opts: { cruiseOnly?: boolean },
  inputs: QuoteSectionInputs,
): Array<QuoteSectionDef & { done: boolean }> {
  const done = sectionsDone(inputs);
  return quoteSectionsFor(kind, opts).map((s) => ({ ...s, done: done[s.key] }));
}

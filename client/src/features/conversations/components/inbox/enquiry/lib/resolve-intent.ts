import type { Airport } from "@/features/airport/types";
import type {
  LookupBoardBasis,
  LookupCountry,
  LookupDestination,
  LookupPackageType,
} from "@/features/lookups";
import type { EnquiryIntent } from "../../../../api/ai-enquiry.api";
import {
  BUDGET_TYPES,
  DEFAULT_FORM,
  DEFAULT_NIGHTS,
  MAX_NIGHTS,
  FIELD_KEYS,
  ISO_DATE,
  STAR_RATINGS,
  autoTitle,
  fitChildAges,
  flexibilityOptionsFor,
  holidayKind,
  type EnquiryForm,
  type FieldKey,
  type LeadSource,
  type Sources,
} from "./enquiry-form";

export interface IntentLookups {
  packageTypes: LookupPackageType[];
  countries: LookupCountry[];
  destinations: LookupDestination[];
  boardBasis: LookupBoardBasis[];
  airports: Airport[];
}

export interface ResolvedIntent {
  form: EnquiryForm;
  sources: Sources;
  /** The title is still the auto "{destination} holiday" (or empty), so it may follow the destination. */
  titleIsAuto: boolean;
  /** The AI supplied at least one usable value. */
  hasIntent: boolean;
}

const norm = (s: string | null | undefined): string => (s ?? "").trim().toLowerCase();

export function airportLabel(a: Airport): string {
  return `${a.airport_name}${a.airport_code ? ` (${a.airport_code})` : ""}`;
}

export function destinationLabel(d: LookupDestination, countries: LookupCountry[]): string {
  const country = countries.find((c) => c.id === d.country_id)?.country_name;
  return country ? `${d.name}, ${country}` : d.name;
}

function findBy<T>(rows: T[], q: string, exact: (r: T) => boolean, loose: (r: T) => boolean): T | undefined {
  if (!q) return undefined;
  return rows.find(exact) ?? rows.find(loose);
}

function intentHasValue(i: EnquiryIntent): boolean {
  return Boolean(
    i.enquiryTitle || i.holidayType || i.countries?.length || i.destinations?.length || i.resorts?.length ||
      i.departureAirports?.length || i.boardBasis?.length || i.starRating || i.travelDate || i.flexibility ||
      i.nights || i.adults || i.children || i.infants || i.budget || i.notes?.trim(),
  );
}

/**
 * Maps the AI intent onto the drawer form. A field is "chat" when the intent
 * supplied it and it matched, "check" when it was supplied but did not match
 * (or the AI is not confident), and "set" for defaults.
 */
export function resolveIntent(
  intent: EnquiryIntent | null,
  lk: IntentLookups,
  ctx: { leadSource: LeadSource },
): ResolvedIntent {
  const sources = Object.fromEntries(FIELD_KEYS.map((k) => [k, "set"])) as Sources;
  const defaultType = lk.packageTypes.find((p) => p.name === "Package Holiday");
  const base: EnquiryForm = {
    ...DEFAULT_FORM,
    leadSource: ctx.leadSource,
    holidayType: defaultType?.id ?? "",
    holidayTypeName: defaultType?.name ?? "",
  };
  if (!intent || !intentHasValue(intent)) return { form: base, sources, titleIsAuto: true, hasIntent: false };

  const labels: Record<string, string> = {};
  const countryOf: Record<string, string> = {};
  const unmapped: string[] = [];
  const mark = (key: FieldKey, supplied: boolean, matched: boolean) => {
    if (supplied) sources[key] = matched ? "chat" : "check";
  };

  let holidayType = base.holidayType;
  let holidayTypeName = base.holidayTypeName;
  const typeQ = norm(intent.holidayType);
  if (typeQ) {
    const pt = findBy(lk.packageTypes, typeQ, (p) => norm(p.name) === typeQ, (p) => norm(p.name).includes(typeQ));
    if (pt) {
      holidayType = pt.id;
      holidayTypeName = pt.name;
    }
    if (!pt) unmapped.push(`Holiday type: ${intent.holidayType}`);
    mark("holidayType", true, !!pt);
  }

  const countries: string[] = [];
  for (const name of intent.countries ?? []) {
    const q = norm(name);
    const c = findBy(lk.countries, q, (x) => norm(x.country_name) === q, (x) => norm(x.country_name).includes(q));
    if (c) {
      if (!countries.includes(c.id)) countries.push(c.id);
    } else if (q) unmapped.push(`Country: ${name}`);
  }

  const destinations: string[] = [];
  let destUnmatched = false;
  for (const name of intent.destinations ?? []) {
    const q = norm(name);
    if (!q) continue;
    const d = findBy(
      lk.destinations,
      q,
      (x) => norm(x.name) === q,
      (x) => norm(x.name).includes(q) || q.includes(norm(x.name)),
    );
    if (d) {
      if (!destinations.includes(d.id)) destinations.push(d.id);
      labels[d.id] = destinationLabel(d, lk.countries);
      if (d.country_id) {
        countryOf[d.id] = d.country_id;
        if (!countries.includes(d.country_id)) countries.push(d.country_id);
      }
    } else {
      destUnmatched = true;
      unmapped.push(`Destination: ${name}`);
    }
  }
  // Only a country was named: the destination still needs picking.
  const destSupplied = (intent.destinations ?? []).some((n) => norm(n)) || (intent.countries ?? []).some((n) => norm(n));
  mark("destinations", destSupplied, destinations.length > 0 && !destUnmatched);

  const boardBasis: string[] = [];
  let boardUnmatched = false;
  for (const name of intent.boardBasis ?? []) {
    const q = norm(name);
    if (!q) continue;
    const b = findBy(lk.boardBasis, q, (x) => norm(x.type) === q, (x) => norm(x.type).includes(q));
    if (b) boardBasis.push(b.id);
    else {
      boardUnmatched = true;
      unmapped.push(`Board basis: ${name}`);
    }
  }
  mark("boardBasis", (intent.boardBasis ?? []).some((n) => norm(n)), boardBasis.length > 0 && !boardUnmatched);

  const airports: string[] = [];
  let airportUnmatched = false;
  for (const name of intent.departureAirports ?? []) {
    const q = norm(name);
    if (!q) continue;
    const a = findBy(
      lk.airports,
      q,
      (x) => norm(x.airport_name) === q || norm(x.airport_code) === q,
      (x) => norm(x.airport_name).includes(q),
    );
    if (a) {
      if (!airports.includes(a.id)) airports.push(a.id);
      labels[a.id] = airportLabel(a);
    } else {
      airportUnmatched = true;
      unmapped.push(`Departure airport: ${name}`);
    }
  }
  mark("airports", (intent.departureAirports ?? []).some((n) => norm(n)), airports.length > 0 && !airportUnmatched);

  // Resorts live behind a search, so they are never resolved up front.
  const resortNames = (intent.resorts ?? []).filter((n) => norm(n));
  for (const r of resortNames) unmapped.push(`Resort: ${r}`);
  mark("resorts", resortNames.length > 0, false);

  const starRating = STAR_RATINGS.find((r) => norm(r) === norm(intent.starRating)) ?? "";
  mark("starRating", !!norm(intent.starRating), !!starRating);
  const flexibility = flexibilityOptionsFor(holidayKind(holidayTypeName)).find((f) => norm(f) === norm(intent.flexibility)) ?? "";
  mark("flexibility", !!norm(intent.flexibility), !!flexibility);
  const travelDateOk = ISO_DATE.test(intent.travelDate ?? "");
  if (intent.travelDate && !travelDateOk) unmapped.push(`Travel date: ${intent.travelDate}`);
  mark("travelDate", !!intent.travelDate, travelDateOk);

  const nights = typeof intent.nights === "number" && intent.nights > 0 ? Math.min(MAX_NIGHTS, intent.nights) : undefined;
  if (nights) {
    const clamped = (intent.nights ?? 0) > MAX_NIGHTS;
    sources.nights = clamped ? "check" : "chat";
    if (clamped) unmapped.push(`Nights: ${intent.nights}`);
  }

  const adults = intent.adults > 0 ? intent.adults : 2;
  const children = intent.children > 0 ? intent.children : 0;
  const infants = intent.infants > 0 ? intent.infants : 0;
  if (intent.adults > 0 || children > 0 || infants > 0) sources.travellers = "chat";

  mark("budget", !!intent.budget?.trim(), true);
  const budgetType = BUDGET_TYPES.find((b) => norm(b) === norm(intent.budgetType));
  mark("budgetType", !!norm(intent.budgetType), !!budgetType);

  const noteParts: string[] = [];
  const aiNotes = intent.notes?.trim() ?? "";
  if (aiNotes) noteParts.push(aiNotes);
  if (unmapped.length) noteParts.push(`To confirm manually: ${unmapped.join("; ")}`);
  const notes = noteParts.join("\n\n");
  if (notes) sources.notes = aiNotes ? "chat" : "check";

  let title = intent.enquiryTitle?.trim() ?? "";
  let titleIsAuto = false;
  if (title) sources.title = "chat";
  else {
    title = autoTitle(labels[destinations[0]]);
    titleIsAuto = true;
  }

  // A hesitant AI means every value it gave should be checked.
  if (intent.confidence === "low") {
    for (const k of FIELD_KEYS) if (sources[k] === "chat") sources[k] = "check";
  }

  const form: EnquiryForm = {
    ...base,
    title,
    holidayType,
    holidayTypeName,
    destinations,
    resorts: [],
    countries,
    airports,
    travelDate: travelDateOk ? (intent.travelDate ?? "") : "",
    flexibility,
    nights: nights ?? DEFAULT_NIGHTS,
    adults,
    children,
    infants,
    childAges: fitChildAges(Array.isArray(intent.childAges) ? intent.childAges : [], children),
    budget: intent.budget?.trim() ?? "",
    budgetType: budgetType ?? base.budgetType,
    boardBasis,
    starRating,
    notes,
    labels,
    countryOf,
  };
  return { form, sources, titleIsAuto, hasIntent: true };
}

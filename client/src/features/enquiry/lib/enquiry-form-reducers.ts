// Pure pieces of the form state: country / destination / resort / accommodation linkage,
// title following, holiday-type changes and source chips. No React.
import type { LookupCountry, LookupDestination, LookupResort } from "@/features/lookups";
import type { LookupAccommodation } from "@/features/lookups/api/lookup.api";
import {
  autoTitle,
  flexibilityOptionsFor,
  holidayKind,
  type ChipKind,
  type EnquiryForm,
  type FieldKey,
  type Sources,
} from "./enquiry-form";

const IS_EMPTY: Record<FieldKey, (f: EnquiryForm) => boolean> = {
  title: (f) => !f.title.trim(),
  holidayType: (f) => !f.holidayType,
  leadSource: () => false,
  destinations: (f) => f.destinations.length === 0,
  resorts: (f) => f.resorts.length === 0,
  airports: (f) => f.airports.length === 0,
  travelDate: (f) => !f.travelDate,
  flexibility: (f) => !f.flexibility,
  nights: () => false,
  travellers: () => false,
  budget: (f) => !f.budget.trim(),
  budgetType: () => false,
  boardBasis: (f) => f.boardBasis.length === 0,
  starRating: (f) => !f.starRating,
  notes: (f) => !f.notes.trim(),
};

const unique = (ids: (string | undefined)[]): string[] => Array.from(new Set(ids.filter((x): x is string => !!x)));

/** Existing countries first, then any newly implied ones. */
const addCountries = (current: string[], implied: (string | undefined)[]): string[] => unique([...current, ...implied]);

/** "Lanzarote" + Spain -> "Lanzarote, Spain". */
export function destinationLabel(d: Pick<LookupDestination, "name" | "country_id">, countries: LookupCountry[]): string {
  const country = countries.find((c) => c.id === d.country_id)?.country_name;
  return country ? `${d.name}, ${country}` : d.name;
}

/** Chip to show for a field: null while empty (unless flagged), "checked" after an edit. */
export function chipForField(
  form: EnquiryForm,
  sources: Sources,
  touched: ReadonlySet<FieldKey>,
  key: FieldKey,
): ChipKind | null {
  const empty = IS_EMPTY[key](form);
  if (empty && sources[key] !== "check") return null;
  if (touched.has(key)) return empty ? null : "checked";
  return sources[key];
}

/** The auto title for a destination label, or no change when the title was edited by hand. */
function followTitle(titleIsAuto: boolean, label: string | undefined): Partial<EnquiryForm> {
  return titleIsAuto ? { title: autoTitle(label) } : {};
}

/** Form patch for a new country selection; destinations / resorts that belonged only to removed countries drop out. */
export function countriesPatch(form: EnquiryForm, next: string[]): Partial<EnquiryForm> {
  const removed = form.countries.filter((c) => !next.includes(c));
  if (removed.length === 0) return { countries: next };
  const keep = (id: string) => {
    const c = form.countryOf[id];
    return !c || next.includes(c);
  };
  return { countries: next, destinations: form.destinations.filter(keep), resorts: form.resorts.filter(keep) };
}

/** Form patch for a new destination selection; resorts of removed destinations drop out. */
export function destinationsPatch(
  form: EnquiryForm,
  next: string[],
  known: Pick<LookupDestination, "id" | "name" | "country_id">[],
  countries: LookupCountry[],
  titleIsAuto: boolean,
): Partial<EnquiryForm> {
  const labels = { ...form.labels };
  const countryOf = { ...form.countryOf };
  for (const id of next) {
    const d = known.find((x) => x.id === id);
    if (!d) continue;
    labels[id] = destinationLabel(d, countries);
    if (d.country_id) countryOf[id] = d.country_id;
  }
  const resorts = form.resorts.filter((r) => {
    const dest = form.destinationOf[r];
    return !dest || next.includes(dest);
  });
  return {
    destinations: next,
    resorts,
    labels,
    countryOf,
    countries: addCountries(form.countries, next.map((id) => countryOf[id])),
    ...followTitle(titleIsAuto, labels[next[0]]),
  };
}

/** Form patch for a new resort selection; a new resort also adds its destination and country. */
export function resortsPatch(
  form: EnquiryForm,
  next: string[],
  known: LookupResort[],
  countries: LookupCountry[],
  titleIsAuto: boolean,
): Partial<EnquiryForm> {
  const labels = { ...form.labels };
  const countryOf = { ...form.countryOf };
  const destinationOf = { ...form.destinationOf };
  const destinations = [...form.destinations];
  for (const id of next.filter((r) => !form.resorts.includes(r))) {
    const r = known.find((x) => x.id === id);
    if (!r) continue;
    labels[id] = r.name;
    if (r.country_id) countryOf[id] = r.country_id;
    if (r.destination_id) {
      destinationOf[id] = r.destination_id;
      if (!destinations.includes(r.destination_id)) {
        destinations.push(r.destination_id);
        const country = countries.find((c) => c.id === r.country_id)?.country_name;
        if (r.destination_name) labels[r.destination_id] = country ? `${r.destination_name}, ${country}` : r.destination_name;
        if (r.country_id) countryOf[r.destination_id] = r.country_id;
      }
    }
  }
  return {
    resorts: next,
    destinations,
    labels,
    countryOf,
    destinationOf,
    countries: addCountries(form.countries, [...destinations, ...next].map((id) => countryOf[id])),
    ...(destinations.length !== form.destinations.length ? followTitle(titleIsAuto, labels[destinations[0]]) : {}),
  };
}

/** Form patch for a new accommodation selection; a new accommodation also adds its resort, destination and country. */
export function accommodationsPatch(
  form: EnquiryForm,
  next: string[],
  known: Pick<LookupAccommodation, "id" | "name" | "resorts_id" | "resort_name" | "destination_id" | "destination_name" | "country_id">[],
  countries: LookupCountry[],
): Partial<EnquiryForm> {
  const labels = { ...form.labels };
  const countryOf = { ...form.countryOf };
  const destinationOf = { ...form.destinationOf };
  const resorts = [...form.resorts];
  const destinations = [...form.destinations];
  const implied: (string | undefined)[] = [];
  for (const id of next.filter((a) => !form.accommodations.includes(a))) {
    const a = known.find((x) => x.id === id);
    if (!a) continue;
    labels[id] = a.name;
    if (a.resorts_id) {
      if (!resorts.includes(a.resorts_id)) resorts.push(a.resorts_id);
      if (a.resort_name) labels[a.resorts_id] = a.resort_name;
    }
    if (a.destination_id) {
      destinationOf[id] = a.destination_id;
      if (!destinations.includes(a.destination_id)) {
        destinations.push(a.destination_id);
        const country = countries.find((c) => c.id === a.country_id)?.country_name;
        if (a.destination_name) labels[a.destination_id] = country ? `${a.destination_name}, ${country}` : a.destination_name;
      }
      if (a.country_id) countryOf[a.destination_id] = a.country_id;
    }
    if (a.country_id) {
      countryOf[id] = a.country_id;
      implied.push(a.country_id);
    }
  }
  return {
    accommodations: next,
    resorts,
    destinations,
    labels,
    countryOf,
    destinationOf,
    countries: addCountries(form.countries, implied),
  };
}

/**
 * Form patch for a holiday type change; drops a flexibility the new type does not offer.
 * Crossing the cruise boundary also clears the destination (and its resorts / country links): the
 * old wizard kept a separate cruise destination that started empty, so a package destination must
 * not carry over as the cruise destination, nor the reverse.
 */
export function holidayTypePatch(form: EnquiryForm, id: string, name: string): Partial<EnquiryForm> {
  const offered = flexibilityOptionsFor(holidayKind(name));
  const crossesCruise = !!form.holidayTypeName && (holidayKind(form.holidayTypeName) === "cruise") !== (holidayKind(name) === "cruise");
  return {
    ...(crossesCruise ? { destinations: [], resorts: [], countries: [], destinationOf: {} } : {}),
    holidayType: id,
    holidayTypeName: name,
    ...(form.flexibility && !offered.includes(form.flexibility) ? { flexibility: "" } : {}),
  };
}
